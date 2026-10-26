"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewImageUrl, reviewThumbUrl } from "@/lib/review-images";
import { patchReview } from "./patch-review";

/**
 * 승인 화면의 사진 칸 — 사진 확인, 한 장 빼기, 설명 쓰기(선택).
 *
 * ── 운영자는 승인만 누르면 된다 (011, 2026-10-26 사용자 결정) ────
 * 이 칸에서 아무것도 안 해도 게시된다. 설명이 없으면 화면이 자동 문구
 * ("작성자가 올린 사진 1/3")를 대체 텍스트로 쓴다(`reviewImageAlt`).
 * 설명을 적으면 그게 우선한다 — 화면을 못 보는 방문자에게 더 정확하다.
 *
 * ── 빼기에 확인 단계를 두는 이유 ───────────────────────────────
 * 파일까지 지워져 되돌릴 수 없다. 브라우저 확인창 대신 버튼 자리에서 한 번 더
 * 묻는다 — 확인창은 화면 흐름을 끊고, 습관적으로 "확인" 을 누르게 만든다.
 */
export default function ReviewPhotoEditor({
  id,
  paths,
  alts,
}: {
  id: number;
  paths: string[];
  alts: string[] | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<string[]>(() => paths.map((_, i) => alts?.[i] ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const dirty = drafts.some((d, i) => d.trim() !== (alts?.[i] ?? ""));

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await patchReview(id, body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-lg border-2 border-line p-3.5">
      <p className="text-xs font-black">
        첨부 사진 {paths.length}장
        <span className="ml-1.5 font-medium text-muted">
          · 이름·주소·번호가 보이는 사진만 빼고 승인하시면 돼요
        </span>
      </p>

      <ul className="mt-3 grid gap-4 sm:grid-cols-3">
        {paths.map((p, i) => (
          <li key={p} className="flex flex-col gap-2">
            <a
              href={reviewImageUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface-muted"
            >
              <Image
                src={reviewThumbUrl(p)}
                alt={`사진 ${i + 1} 원본 크게 보기`}
                fill
                sizes="(min-width: 640px) 240px, 100vw"
                unoptimized
                className="object-cover"
              />
            </a>
            <label htmlFor={`alt-${id}-${i}`} className="text-xs font-bold text-muted">
              사진 {i + 1} 설명 <span className="font-medium">(선택)</span>
            </label>
            <input
              id={`alt-${id}-${i}`}
              value={drafts[i]}
              onChange={(e) =>
                setDrafts((prev) => prev.map((d, j) => (j === i ? e.target.value : d)))
              }
              maxLength={200}
              placeholder="예) 설치 후 거실 공유기 모습"
              className="w-full rounded-lg border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
            {confirming === p ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run({ remove_image: p })}
                  className="min-h-11 flex-1 rounded-lg border-2 border-red-600 bg-red-600 px-3 text-sm font-bold text-white"
                >
                  {busy ? "빼는 중…" : "빼고 지우기"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(null)}
                  className="min-h-11 rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-muted"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(p)}
                className="min-h-11 rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-muted transition-colors hover:border-red-600 hover:text-red-600"
              >
                사진 빼기
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ image_alts: drafts.map((d) => d.trim()) })}
          className="min-h-11 rounded-lg border-2 border-foreground bg-white px-4 text-sm font-bold"
        >
          {busy ? "저장 중…" : "설명 저장"}
        </button>
        {dirty && !busy && <span className="text-xs text-muted">저장하지 않은 설명이 있어요</span>}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
