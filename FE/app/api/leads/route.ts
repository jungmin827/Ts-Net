import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation";
import {
  normalizePhone,
  hashPhone,
  encryptPhone,
  maskPhone,
} from "@/lib/crypto";
import { verifyTurnstile } from "@/lib/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";

// 접수 파이프라인 — docs/SPEC.md §2 순서 그대로. 하나라도 실패하면 즉시 중단.
// 알림 발송 단계는 없다 (운영자가 어드민에서만 확인).

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : null;
}

export async function POST(req: NextRequest) {
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

  const supabase = createAdminClient();

  // 4. Rate limit — 동일 IP 10분 내 3건 초과 시 429
  if (ip) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if (countError) {
      return NextResponse.json(
        { ok: false, error: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요" },
        { status: 500 },
      );
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요" },
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
