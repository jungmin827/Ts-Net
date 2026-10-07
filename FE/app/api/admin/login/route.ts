import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logAccessSoft } from "@/lib/admin/audit";
import { clientIp } from "@/lib/client-ip";
import {
  checkLogin,
  clearFailures,
  recordFailure,
  throttleKey,
} from "@/lib/admin/login-throttle";

// 어드민 로그인. 폼 제출은 Server Action 이 아니라 Route Handler 로 받는다
// (검증·감사로그를 한 곳에 모으기 위함 — CLAUDE.md 코딩 규칙).
// 계정은 1개. 상담사 계정 개념은 없다.

const loginSchema = z.object({
  email: z.string().trim().email("이메일 형식을 확인해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요").max(200),
  /** 2FA(TOTP) 코드. 1차 인증 후 필요할 때만 받는다 */
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "인증코드 6자리를 입력해 주세요")
    .optional(),
});

export async function POST(req: NextRequest) {
  // IP 가 **플랫폼이 쓴 값인지**가 정책을 가른다.
  // 클라이언트가 적어 보낸 XFF 로는 잠그지 않는다 — 공격자는 헤더를 바꿔
  // 그냥 통과하고 정당한 운영자만 걸리기 때문이다 (lib/client-ip.ts 참고).
  const { ip, trusted: ipTrusted } = clientIp(req.headers);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" },
      { status: 400 },
    );
  }
  const { email, password, code } = parsed.data;

  // 시도 횟수 제한 — 단일 계정 + 알려진 로그인 URL 조합은 대입 공격의 표적이 된다.
  // (한계는 lib/admin/login-throttle.ts 주석 참고)
  const tk = throttleKey(ip, email);
  const gate = checkLogin(tk, email, ipTrusted);

  // 지연(tarpit) — 차단이 아니라 **대입 1회의 비용**이다.
  // 정당한 로그인도 이만큼 늦어지지만 최대 4초이고, 한 번 성공하면 즉시 사라진다.
  // 계정을 잠가 버리면 단일 계정인 이 사이트는 복구 수단이 없다.
  if (gate.delayMs > 0) {
    await new Promise((r) => setTimeout(r, gate.delayMs));
  }

  if (!gate.allowed) {
    await logAccessSoft({
      actorEmail: email,
      action: "LOGIN_FAIL",
      target: "admin",
      detail: { stage: "throttled", retryAfter: gate.retryAfter },
      ip,
    });
    return NextResponse.json(
      {
        ok: false,
        error: `로그인 시도가 많습니다. ${Math.ceil(gate.retryAfter / 60)}분 후 다시 시도해 주세요`,
      },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const supabase = await createClient();

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signIn.user) {
    await logAccessSoft({
      actorEmail: email,
      action: "LOGIN_FAIL",
      target: "admin",
      detail: { stage: "password" },
      ip,
    });
    recordFailure(tk, email);
    // 계정 존재 여부가 드러나지 않도록 실패 사유는 하나로 묶는다
    return NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다" },
      { status: 401 },
    );
  }

  // admin_users 등록 + 활성 상태 확인. 아니면 세션을 즉시 폐기한다
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, email, is_active")
    .eq("id", signIn.user.id)
    .maybeSingle();

  if (!adminRow || adminRow.is_active !== true) {
    await supabase.auth.signOut();
    await logAccessSoft({
      actorId: signIn.user.id,
      actorEmail: email,
      action: "LOGIN_FAIL",
      target: "admin",
      detail: { stage: "not_admin" },
      ip,
    });
    return NextResponse.json(
      { ok: false, error: "어드민 권한이 없는 계정입니다" },
      { status: 403 },
    );
  }

  /**
   * 2FA 는 **무조건** 거친다.
   *
   * 예전에는 `nextLevel === "aal2"` 로 판정했다. 이건 "등록된 TOTP 가 있을 때만"
   * 2단계를 요구한다는 뜻이라, TOTP 미등록 계정은 비밀번호만으로 통과했다.
   * 게다가 `checkAdmin()` 쪽은 aal2 를 요구하므로, 로그인은 되는데 화면 진입에서
   * 튕기는 루프가 생긴다. 등록 여부를 여기서 먼저 끊는다.
   */
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === "verified");

  if (!totp) {
    // **세션을 끊지 않는다.** Supabase 는 TOTP 등록을 로그인된 세션에서
    // `mfa.enroll()` 로만 제공한다. 여기서 로그아웃하면 등록할 방법이 사라져
    // 계정이 영구 잠긴다. aal1 세션을 유지한 채 등록 페이지로 보낸다.
    clearFailures(tk, email);
    await logAccessSoft({
      actorId: signIn.user.id,
      actorEmail: email,
      action: "LOGIN",
      target: "admin",
      detail: { stage: "enroll_required" },
      ip,
    });
    return NextResponse.json({ ok: true, enrollRequired: true });
  }

  {
    if (!code) {
      return NextResponse.json({ ok: true, mfaRequired: true });
    }

    const factorId = totp.id;

    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (mfaError) {
      await logAccessSoft({
        actorId: signIn.user.id,
        actorEmail: email,
        action: "LOGIN_FAIL",
        target: "admin",
        detail: { stage: "mfa" },
        ip,
      });
      recordFailure(tk, email);
      return NextResponse.json(
        { ok: false, mfaRequired: true, error: "인증코드가 올바르지 않습니다" },
        { status: 401 },
      );
    }
  }

  // 성공했으니 시도 기록을 지운다
  clearFailures(tk, email);

  await logAccessSoft({
    actorId: signIn.user.id,
    actorEmail: adminRow.email as string,
    action: "LOGIN",
    target: "admin",
    detail: { mfa: true },
    ip,
  });

  return NextResponse.json({ ok: true, mfaRequired: false });
}
