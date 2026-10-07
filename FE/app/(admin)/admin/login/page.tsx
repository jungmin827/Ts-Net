import LoginForm from "./LoginForm";

// Supabase Auth 이메일 + 비밀번호 로그인. 계정은 1개이며 2FA(TOTP)를 등록하면
// 1차 인증 후 코드 입력 단계가 자동으로 추가된다 (/api/admin/login).

const ERROR_MESSAGE: Record<string, string> = {
  not_admin: "어드민으로 등록되지 않은 계정입니다. 다른 계정으로 로그인해 주세요.",
  mfa: "2단계 인증을 완료해야 어드민에 접근할 수 있습니다.",
  config: "Supabase 환경변수가 설정되지 않아 인증을 진행할 수 없습니다.",
};

/** 오픈 리다이렉트 방지 — 어드민 내부 경로만 허용한다 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/admin") || raw.startsWith("//")) return "/admin";
  if (raw.startsWith("/admin/login")) return "/admin";
  return raw;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const notice = ERROR_MESSAGE[pick("error") ?? ""];

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-lg bg-brand-dark px-2.5 py-1 text-xs font-bold text-white">
            TS-Net
          </span>
          <h1 className="mt-3 text-xl font-bold">어드민 로그인</h1>
          <p className="mt-1 text-xs text-muted">
            상담신청 데이터를 다루는 화면입니다. 접속 기록이 남습니다.
          </p>
        </div>

        {notice && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <LoginForm nextPath={safeNext(pick("next"))} />
        </div>
      </div>
    </div>
  );
}
