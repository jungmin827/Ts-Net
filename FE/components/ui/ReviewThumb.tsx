import Image from "next/image";
import { reviewThumbUrl } from "@/lib/review-images";

/**
 * 후기 카드의 사진 썸네일 — 첫 장만, 나머지는 `+N` 으로.
 * 목록(`ReviewList`)과 메인 섹션(`Reviews`)이 같이 쓴다.
 *
 * ── 썸네일을 따로 굽는 이유 ────────────────────────────────────
 * 카드는 최대 약 360px 폭이다. 1600px 원본을 깔면 목록 한 페이지(15건)가
 * 수 MB 가 되고, 무료 플랜 전송량(월 5GB)을 목록이 다 먹는다. 브라우저가
 * 올릴 때 720px 짜리를 같이 구워 보낸다(`lib/review-image-encode.ts`).
 *
 * ── `alt=""` 인 이유 ───────────────────────────────────────────
 * 이 그림은 카드 링크 안에 있고, 링크의 이름은 제목이다. 사진 내용은 상세에서
 * 운영자가 쓴 대체 텍스트와 함께 나온다 — 여기서는 "사진이 있다" 는 사실만
 * 전하면 된다. 그래서 그림은 장식으로 두고 장수를 글자로 읽힌다.
 * (CLAUDE.md 가 경계하는 "일괄 alt=''" 는 정보의 본체가 그 이미지일 때다.
 *  여기의 본체는 상세 페이지에 있고, 거기엔 장마다 설명이 있다.)
 */
export default function ReviewThumb({
  paths,
  sizes,
  className = "",
}: {
  paths: string[] | null | undefined;
  /** 카드 폭에 맞춘 `sizes` — 레이아웃이 곳마다 다르다 */
  sizes: string;
  className?: string;
}) {
  const first = paths?.[0];
  if (!first) return null;
  const count = paths.length;
  return (
    <div
      className={`relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-muted ${className}`}
    >
      {/* 무작위 이름이라 내용이 바뀌지 않는 정적 파일 — 최적화를 끄고 그대로 받는다 */}
      <Image
        src={reviewThumbUrl(first)}
        alt=""
        fill
        sizes={sizes}
        unoptimized
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <span className="sr-only">사진 {count}장</span>
      {count > 1 && (
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 rounded-md bg-foreground/85 px-1.5 py-0.5 text-[11px] font-bold text-white"
        >
          +{count - 1}
        </span>
      )}
    </div>
  );
}
