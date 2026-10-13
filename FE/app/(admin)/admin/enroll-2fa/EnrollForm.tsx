"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * TOTP 등록 — enroll(QR 발급) → 사용자가 앱에 등록 → challengeAndVerify(6자리).
 *
 * 등록·검증 모두 브라우저의 Supabase 클라이언트가 수행한다. 비밀값이 서버를
 * 거치지 않으며, 검증에 성공하면 그 세션이 곧바로 aal2 로 올라간다.
 */
export default function EnrollForm({
  nextPath,
}: {
  nextPath: string;
  enrollPath: string;
}) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 페이지에 들어오면 바로 factor 를 하나 만들어 QR 을 띄운다
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      // 이전에 만들다 만 미검증 factor 가 있으면 정리한다 — 쌓이면 어느 것이
      // 유효한지 알 수 없고, Supabase 쪽 factor 개수 상한에도 걸린다
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error: e } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `admin-${Date.now()}`,
      });
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message ?? "등록 코드를 발급하지 못했습니다");
        return;
      }
      setFactorId(data.id);
      /*
       * `qr_code` 는 `data:image/svg+xml;utf-8,<svg …</svg>\n` 형태로 오고
       * **끝에 개행이 붙어 있다.** `next/image` 는 src 가 공백·제어문자로
       * 끝나면 거부하므로(런타임 에러) 받는 지점에서 다듬는다.
       * 렌더 쪽에서 `trimEnd()` 하지 않는 이유 — 같은 값을 다른 곳에서 쓰면
       * 거기서 또 터진다. 상태에 들어가는 값을 정상화하는 게 맞다.
       */
      setQr(data.totp.qr_code.trim() || null);
      setSecret(data.totp.secret);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || busy) return;
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setError("인증코드가 올바르지 않습니다. 앱의 현재 숫자를 다시 확인해 주세요");
      setCode("");
      setBusy(false);
      return;
    }
    // 이 세션은 이제 aal2 다 — 서버 가드를 통과한다
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      {qr ? (
        <>
          <Image
            src={qr}
            alt="2단계 인증 등록용 QR 코드"
            width={200}
            height={200}
            unoptimized
            className="mx-auto h-[200px] w-[200px]"
          />
          {secret && (
            <p className="mt-3 text-center text-xs text-muted">
              QR 을 찍을 수 없으면 이 키를 직접 입력하세요
              <br />
              <code className="mt-1 inline-block rounded bg-surface-muted px-2 py-1 font-mono text-[11px] tracking-wider text-foreground">
                {secret}
              </code>
            </p>
          )}
        </>
      ) : (
        !error && <p className="py-10 text-center text-sm text-muted">등록 코드를 발급하는 중…</p>
      )}

      <form onSubmit={verify} className="mt-5 flex flex-col gap-2">
        <label htmlFor="totp-code" className="text-xs font-bold text-muted">
          인증 앱에 표시된 6자리
        </label>
        <input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(ev) => setCode(ev.target.value.replace(/\D/g, ""))}
          className="tabular w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
        <button
          type="submit"
          disabled={busy || code.length !== 6 || !factorId}
          className="mt-1 cursor-pointer rounded-lg bg-brand-dark px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
        >
          {busy ? "확인 중…" : "등록 완료"}
        </button>
      </form>
    </div>
  );
}
