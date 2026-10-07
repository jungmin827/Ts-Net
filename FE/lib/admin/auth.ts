import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 어드민은 단일 계정 + 2FA. 상담사 계정·권한 분기는 의도적으로 없다 (CLAUDE.md).
// 모든 어드민 경로는 (1) 미들웨어, (2) 레이아웃/페이지의 requireAdmin,
// (3) Route Handler 의 requireAdminApi 3중으로 가드한다.

export const LOGIN_PATH = "/admin/login";
/** TOTP 등록 페이지. 어드민 경로 중 유일하게 aal1 으로 들어올 수 있다 */
export const ENROLL_PATH = "/admin/enroll-2fa";

export interface AdminIdentity {
  userId: string;
  email: string;
  displayName: string | null;
  role: "OWNER" | "VIEWER";
}

export type AdminGuardFailure =
  | { reason: "ANONYMOUS" }
  | { reason: "NOT_ADMIN" }
  /** 2FA 를 등록했지만 아직 추가 인증을 통과하지 않은 세션 */
  | { reason: "MFA_REQUIRED" }
  /** TOTP 가 아직 등록되지 않은 계정 — 등록 페이지로 보내야 한다 */
  | { reason: "ENROLL_REQUIRED" };

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AdminGuardSuccess {
  ok: true;
  supabase: SupabaseServerClient;
  admin: AdminIdentity;
}

export type AdminGuardResult =
  | AdminGuardSuccess
  | ({ ok: false } & AdminGuardFailure);

/**
 * 세션 → admin_users 확인 → 2FA 단계 확인.
 * leads 조회는 이 세션 클라이언트로 수행해 RLS(is_admin())를 그대로 통과시킨다.
 */
export interface AdminGuardOptions {
  /**
   * aal1(비밀번호만) 세션도 통과시킨다. **TOTP 등록 페이지 전용.**
   * 다른 곳에 쓰면 2FA 가 무력화된다.
   */
  allowAal1?: boolean;
}

export async function checkAdmin(
  options?: AdminGuardOptions,
): Promise<AdminGuardResult> {
  const supabase = await createClient();

  // getUser() 는 토큰을 서버에서 검증한다. 쿠키의 세션 값을 그대로 믿지 않는다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "ANONYMOUS" };

  const { data: row } = await supabase
    .from("admin_users")
    .select("id, email, display_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!row || row.is_active !== true) return { ok: false, reason: "NOT_ADMIN" };

  /**
   * 2FA 는 **선택이 아니다** (CLAUDE.md: 단일 계정 1개 + 2FA).
   *
   * 예전 판정은 `nextLevel === "aal2"` 였다. 이건 "등록된 TOTP 가 있을 때만"
   * 2단계를 요구한다는 뜻이라, **TOTP 미등록 계정은 비밀번호만으로 통과**했다.
   * 2FA 를 켜 둔 줄 알지만 실제로는 꺼져 있는 상태다.
   *
   * 그렇다고 미등록 계정을 그냥 막으면 안 된다 — Supabase 는 TOTP 등록을
   * **로그인된 세션에서 `mfa.enroll()` 로만** 제공한다. 로그인을 막으면
   * 등록할 방법이 사라져 계정이 영구 잠긴다.
   *
   * 그래서 두 단계로 가른다.
   *   - TOTP 미등록 → `ENROLL_REQUIRED` → 등록 페이지(aal1 로 접근 가능)
   *   - 등록했지만 2단계 미통과 → `MFA_REQUIRED` → 로그인 페이지의 코드 입력
   * 등록 페이지만 `allowAal1` 로 열어 두고, 나머지 어드민 화면은 aal2 를 요구한다.
   */
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = !!factors?.totp?.some((f) => f.status === "verified");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const atAal2 = aal?.currentLevel === "aal2";

  if (!atAal2) {
    if (!hasVerifiedTotp) {
      // 등록 페이지 자체는 aal1 로 들어와야 한다
      if (!options?.allowAal1) return { ok: false, reason: "ENROLL_REQUIRED" };
    } else {
      return { ok: false, reason: "MFA_REQUIRED" };
    }
  }

  return {
    ok: true,
    supabase,
    admin: {
      userId: row.id as string,
      email: row.email as string,
      displayName: (row.display_name as string | null) ?? null,
      role: (row.role as "OWNER" | "VIEWER") ?? "VIEWER",
    },
  };
}

/** 서버 컴포넌트용 — 실패 시 로그인 페이지로 */
export async function requireAdmin(
  nextPath?: string,
): Promise<AdminGuardSuccess> {
  const result = await checkAdmin();
  if (result.ok) return result;

  // TOTP 미등록은 '권한 없음'이 아니라 '아직 설정이 안 끝남'이다.
  // 로그인 페이지로 되돌리면 비밀번호만 반복 입력하는 루프가 된다.
  if (result.reason === "ENROLL_REQUIRED") redirect(ENROLL_PATH);

  const sp = new URLSearchParams();
  if (nextPath) sp.set("next", nextPath);
  if (result.reason === "NOT_ADMIN") sp.set("error", "not_admin");
  if (result.reason === "MFA_REQUIRED") sp.set("error", "mfa");
  const qs = sp.toString();
  redirect(qs ? `${LOGIN_PATH}?${qs}` : LOGIN_PATH);
}

/** Route Handler 용 — 실패 시 401/403 JSON */
export async function requireAdminApi(): Promise<
  AdminGuardSuccess | { ok: false; response: Response }
> {
  const result = await checkAdmin();
  if (result.ok) return result;

  const status = result.reason === "ANONYMOUS" ? 401 : 403;
  const message =
    result.reason === "ANONYMOUS"
      ? "로그인이 필요합니다"
      : result.reason === "MFA_REQUIRED"
        ? "2단계 인증이 필요합니다"
        : result.reason === "ENROLL_REQUIRED"
          ? "2단계 인증(TOTP) 등록이 필요합니다"
          : "어드민 권한이 없습니다";

  return {
    ok: false,
    response: Response.json({ ok: false, error: message }, { status }),
  };
}
