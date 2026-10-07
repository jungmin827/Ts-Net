"use client";

import { useState } from "react";

// "번호 보기"를 눌러야 복호화된다. 서버가 access_logs 에 DECRYPT 를 남긴 뒤에만
// 평문을 내려주므로, 이 컴포넌트는 버튼을 누르기 전까지 마스킹값만 들고 있다.

interface Props {
  leadId: number;
  masked: string;
}

export default function PhoneReveal({ leadId, masked }: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/decrypt`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; phone?: string; error?: string };
      if (!res.ok || !data.ok || !data.phone) {
        setError(data.error ?? "번호를 불러오지 못했습니다");
      } else {
        setPhone(data.phone);
      }
    } catch {
      setError("네트워크 오류입니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-bold tabular-nums">
          {phone ?? masked}
        </span>
        {phone ? (
          <>
            <a
              href={`tel:${phone}`}
              className="rounded-lg bg-brand-dark px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
            >
              전화 걸기
            </a>
            <button
              type="button"
              onClick={() => setPhone(null)}
              className="cursor-pointer rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-dark"
            >
              가리기
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={reveal}
            disabled={loading}
            className="cursor-pointer rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-brand transition-colors duration-200 hover:border-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:text-faint"
          >
            {loading ? "확인 중…" : "번호 보기"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-faint">
        번호 보기는 개인정보 접속기록(access_logs)에 남습니다.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
