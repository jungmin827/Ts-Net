"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { fieldBase } from "@/components/ui/Field";

interface Props {
  /** 로그인 후 돌아갈 어드민 경로 (미들웨어가 붙여준 next 파라미터) */
  nextPath: string;
}

interface LoginResponse {
  ok: boolean;
  mfaRequired?: boolean;
  /** TOTP 가 아직 등록되지 않은 계정 — 등록 페이지로 보내야 한다 */
  enrollRequired?: boolean;
  error?: string;
}

export default function LoginForm({ nextPath }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          // 2차 단계에서만 코드를 보낸다
          ...(mfaRequired && code ? { code } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as LoginResponse;

      if (res.ok && data.ok && data.enrollRequired) {
        // 비밀번호는 맞았고 TOTP 만 아직 없다. 세션(aal1)은 살아 있으므로
        // 등록 페이지로 보낸다 — 여기서 끊으면 등록할 방법이 없어진다.
        router.replace("/admin/enroll-2fa");
        router.refresh();
        return;
      }

      if (res.ok && data.ok && data.mfaRequired) {
        // 1차 인증 통과 — TOTP 코드 입력 단계로
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      if (!res.ok || !data.ok) {
        if (data.mfaRequired) setMfaRequired(true);
        setError(data.error ?? "로그인에 실패했습니다");
        setLoading(false);
        return;
      }

      // 세션 쿠키는 서버가 이미 심었다 — 서버 컴포넌트를 다시 그리게 한다
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("네트워크 오류입니다. 잠시 후 다시 시도해 주세요");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">이메일</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mfaRequired}
          className={fieldBase}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={mfaRequired}
          className={fieldBase}
        />
      </label>

      {mfaRequired && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">
            2단계 인증코드 (6자리)
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${fieldBase} tracking-[0.4em]`}
          />
        </label>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} fullWidth size="md">
        {mfaRequired ? "인증코드 확인" : "로그인"}
      </Button>

      {mfaRequired && (
        <button
          type="button"
          onClick={() => {
            setMfaRequired(false);
            setCode("");
            setError(null);
          }}
          className="cursor-pointer text-xs text-muted underline-offset-2 hover:underline"
        >
          이메일 다시 입력
        </button>
      )}
    </form>
  );
}
