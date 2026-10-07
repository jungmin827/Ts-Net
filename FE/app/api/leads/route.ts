import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation";
import {
  normalizePhone,
  hashPhone,
  encryptPhone,
  maskPhone,
} from "@/lib/crypto";
import { verifyTurnstile } from "@/lib/turnstile";
import { publicClient } from "@/lib/supabase/public";
import { clientIp as sharedClientIp } from "@/lib/client-ip";

// 접수 파이프라인 — docs/SPEC.md §2 순서 그대로. 하나라도 실패하면 즉시 중단.
// 알림 발송 단계는 없다 (운영자가 어드민에서만 확인).

/**
 * 레이트리밋 창·임계치. **실제 판정은 DB 함수 `lead_rate_exceeded()` 안에서 한다** —
 * 여기 값은 화면 문구·문서를 위한 사본이다.
 *
 * 창을 호출자가 넘기지 않는 이유: 넘길 수 있게 두면 공개 anon 키로
 * 시간 축을 이분 탐색해 특정 IP 의 접수 시각을 초 단위까지 좁힐 수 있다.
 * 함수는 boolean 한 비트만 돌려준다 (`006_lead_rate_count.sql` 참고).
 * 임계치를 바꾸려면 FE 상수가 아니라 새 마이그레이션이 필요하다.
 */
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;

/**
 * 접수 레이트리밋·기록용 IP.
 *
 * `x-forwarded-for` 맨 앞 값만 보면 클라이언트가 매 요청 다른 값을 적어
 * 레이트리밋 키를 무한히 회전시킬 수 있다. 플랫폼이 직접 쓰는 헤더를
 * 먼저 본다 (`lib/client-ip.ts`).
 */
function clientIp(req: NextRequest): string | null {
  return sharedClientIp(req.headers).ip ?? null;
}

/**
 * 어떤 예외가 나도 **JSON 으로 응답한다.**
 *
 * 예전에는 라우트 안에서 던져진 예외가 그대로 올라가 Next 기본 HTML 에러
 * 페이지가 나갔다. 클라이언트는 `res.json()` 을 호출하므로 거기서 다시 터져,
 * 사용자는 아무 안내 없이 폼이 멈춘 것처럼 보였다.
 * 접수 실패는 조용히 끝나면 안 된다 — 이 사이트의 유일한 기능이기 때문이다.
 */
export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    // 전화번호 등 개인정보는 로그에 남기지 않는다 — 예외 메시지만
    console.error(
      "[/api/leads] 처리 중 예외:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, error: "접수에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }
}

async function handlePost(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }

  // 1. honeypot — 채워져 있으면 성공처럼 응답하고 조용히 폐기
  if (
    typeof body === "object" &&
    body !== null &&
    "website" in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true });
  }

  const ip = clientIp(req);

  // 2. Turnstile 검증 ← 3. zod 검증 (토큰 형식을 스키마가 함께 검증)
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  const input = parsed.data;

  const human = await verifyTurnstile(input.turnstileToken, ip ?? undefined);
  if (!human) {
    return NextResponse.json(
      { ok: false, error: "보안 검증에 실패했습니다. 새로고침 후 다시 시도해 주세요" },
      { status: 400 },
    );
  }

  /**
   * 접수 경로는 **anon 키 하나로 완결된다.**
   *
   * INSERT 는 `leads_public_insert` 정책이 허용하고, 레이트리밋 건수는
   * `lead_rate_exceeded()` (security definer, boolean 만 반환) 가 판정한다.
   * 공개 엔드포인트가 RLS 를 통째로 우회하는 service_role 키를 쥘 이유가 없다.
   *
   * 예전에는 라우트 첫 줄에서 `createAdminClient()` 를 불러, 키가 없으면
   * **접수 자체가 500 으로 전면 중단**됐다. 사이트의 유일한 목적이 연락처
   * 수집인데 부가 통제 하나 때문에 본 기능이 죽는 구조였다.
   */
  const supabase = publicClient();
  if (!supabase) {
    console.error("[/api/leads] Supabase anon 키 미설정 — 접수 불가");
    return NextResponse.json(
      { ok: false, error: "접수에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  // 4. Rate limit — 동일 IP 10분 내 3건 초과 시 429
  if (ip) {
    const { data: exceeded, error: countError } = await supabase.rpc(
      "lead_rate_exceeded",
      { p_ip: ip },
    );

    if (countError) {
      // 마이그레이션 006 미적용 등으로 함수를 못 부르는 경우.
      // 접수를 막지는 않되 **조용히 넘어가지 않는다** — 통제가 꺼진 상태는
      // 운영자가 반드시 알아야 한다 (console.warn 이 아니라 error).
      console.error(
        "[/api/leads] 레이트리밋 미작동 — lead_rate_exceeded 호출 실패:",
        countError.code,
        countError.message,
      );
    } else if (exceeded === true) {
      // "잠시 후"는 얼마나 기다려야 하는지 알려주지 않는다 — 창 길이를 그대로 말한다
      return NextResponse.json(
        {
          ok: false,
          error: `요청이 너무 많습니다. ${RATE_LIMIT_WINDOW_MIN}분 내 ${RATE_LIMIT_MAX}건까지 접수할 수 있습니다. 잠시 후 다시 시도해 주세요`,
        },
        { status: 429 },
      );
    }
  }

  // 5~7. 전화번호 3종 생성 후 INSERT — 당일 중복은 unique index가 차단(23505 → 409)
  const phone = normalizePhone(input.phone);
  const now = new Date().toISOString();

  const { error } = await supabase.from("leads").insert({
    name: input.name,
    phone_enc: encryptPhone(phone),
    phone_hash: hashPhone(phone),
    phone_masked: maskPhone(phone),
    carrier: input.carrier ?? null,
    product: input.product ?? null,
    memo: input.memo ?? null,
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_content: input.utm_content ?? null,
    landing_path: input.landing_path ?? null,
    referrer: input.referrer ?? req.headers.get("referer"),
    ip,
    user_agent: req.headers.get("user-agent"),
    consent_privacy: input.consent_privacy,
    consent_marketing: input.consent_marketing,
    consent_at: now,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "오늘 이미 접수되었습니다. 순차적으로 연락드리겠습니다" },
        { status: 409 },
      );
    }
    // 전화번호 등 개인정보는 어떤 로그에도 남기지 않는다 — 에러 코드만
    console.error("[/api/leads] insert 실패:", error.code, error.message);
    return NextResponse.json(
      { ok: false, error: "접수에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  // 8. 성공 — 전환 이벤트(GA4·네이버·메타·카카오)는 프론트에서 발화
  return NextResponse.json({ ok: true }, { status: 201 });
}
