import { NextRequest, NextResponse } from "next/server";
import { reviewSubmitSchema } from "@/lib/validation";
import { verifyTurnstile, TURNSTILE_FAILURE } from "@/lib/turnstile";
import { readJsonBody, noStore, issueMessage } from "@/lib/http";
import { publicClient } from "@/lib/supabase/public";
import { clientIp } from "@/lib/client-ip";

/**
 * 후기 제출 — `/api/leads` 와 같은 자리에 같은 순서로 둔다.
 * (honeypot → zod → Turnstile → 폭증 상한 → INSERT)
 *
 * ── 왜 이 라우트가 필요했는가 (전문: docs/REVIEW_AUTHORSHIP.md) ──
 * `reviews` 에는 anon INSERT 정책도, 작성 폼도 없었다. 쓰기는 어드민뿐이고
 * 어드민은 단일 계정 1개(운영자)다. 즉 `/review` 에 "가입 후기" 로 뜰 수
 * 있는 글은 **전부 운영자가 쓴 글**이었다 — 소비자가 제3자의 경험으로
 * 읽도록 배치한 자리에 사업자의 자기 서술이 들어가면 표시광고법상
 * 거짓·과장 광고 소지가 있다. CLAUDE.md 규칙 1 이 `leads` 를 두고 막으려던
 * 것과 같은 종류다.
 *
 * ── 승인 전 글이 새지 않는 보장은 여기가 아니라 RLS 에 있다 ──────
 * 이 라우트가 `is_published: false` 를 넣지만, 그걸 **믿지 않는다.**
 * `008` 의 `reviews_public_insert` 가 `is_published = false` 인 행만
 * 통과시키고 anon 에게 UPDATE 를 주지 않는다. 라우트가 틀려도 DB 가 막는다.
 */

/** 폭증 창·임계치. 판정은 DB 함수 `review_submit_flood()` 안에서 한다 */
const FLOOD_WINDOW_MIN = 10;

export async function POST(req: NextRequest) {
  return noStore(await respond(req));
}

async function respond(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error(
      "[/api/reviews] 처리 중 예외:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }
}

async function handlePost(req: NextRequest) {
  // JSON 이 아니거나 상한(32KB)을 넘는 본문은 파싱 전에 거절한다
  const read = await readJsonBody(req);
  if (!read.ok) return read.response;
  const body = read.body;

  // 1. honeypot — 채워져 있으면 성공처럼 응답하고 조용히 폐기
  if (
    typeof body === "object" &&
    body !== null &&
    "website" in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true });
  }

  // 2. zod
  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: issueMessage(parsed.error.issues) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 3. Turnstile
  const { ip } = clientIp(req.headers);
  const human = await verifyTurnstile(input.turnstileToken, ip ?? undefined);
  if (human !== "ok") {
    const { status, error } = TURNSTILE_FAILURE[human];
    return NextResponse.json({ ok: false, error }, { status });
  }

  const supabase = publicClient();
  if (!supabase) {
    console.error("[/api/reviews] Supabase anon 키 미설정 — 등록 불가");
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  /*
   * 4. 폭증 상한.
   *
   * 후기는 IP 를 저장하지 않는다 — 익명 제출이고, 넣을 이유가 없다.
   * 그래서 **전역 창**으로 본다: 짧은 시간에 전체 제출이 폭증하면 사람이
   * 아니라 스크립트다. 개별 공격자를 막는 건 Turnstile 과 Cloudflare
   * 레이트리밋의 일이고, 이건 그 둘이 뚫렸을 때의 마지막 상한이다.
   *
   * 함수를 못 부르면 **막지 않되 조용히 넘어가지 않는다** — 통제가 꺼진
   * 상태는 운영자가 반드시 알아야 한다 (`/api/leads` 와 같은 판단).
   */
  const { data: flooded, error: floodError } = await supabase.rpc(
    "review_submit_flood",
  );
  if (floodError) {
    console.error(
      "[/api/reviews] 폭증 상한 미작동 — review_submit_flood 호출 실패 " +
        "(008 미적용 가능):",
      floodError.code,
      floodError.message,
    );
  } else if (flooded === true) {
    return NextResponse.json(
      {
        ok: false,
        error: `등록 요청이 많습니다. ${FLOOD_WINDOW_MIN}분 후 다시 시도해 주세요`,
      },
      { status: 429 },
    );
  }

  /*
   * 5. INSERT.
   *
   * `author` 를 넣지 않는다 — 받지 않았다. `view_count`·`admin_reply` 도
   * 명시하지 않는다(기본값). 008 의 정책이 이 셋을 검사하므로, 실수로
   * 넣으면 INSERT 자체가 거부된다.
   */
  const { error } = await supabase.from("reviews").insert({
    title: input.title,
    content: input.content,
    rating: input.rating ?? null,
    carrier: input.carrier ?? null,
    is_published: false,
  });

  if (error) {
    // 42501 = RLS 거부. 008 미적용이면 이걸 받는다 — 원인을 이름으로 찍는다.
    if (error.code === "42501") {
      console.error(
        "[/api/reviews] RLS 가 INSERT 를 거부했습니다 — " +
          "008_review_public_submit.sql 미적용 가능:",
        error.message,
      );
    } else {
      console.error("[/api/reviews] INSERT 실패:", error.code, error.message);
    }
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  /*
   * 성공 응답에 **"바로 공개된다" 고 말하지 않는다.** 승인 후 노출이고,
   * 제출자는 자기 글을 다시 볼 수 없다(본인 확인 수단을 안 받는다).
   * 그 사실을 여기서 분명히 말해야 "올렸는데 안 보인다" 는 오해가 안 생긴다.
   */
  return NextResponse.json({ ok: true });
}
