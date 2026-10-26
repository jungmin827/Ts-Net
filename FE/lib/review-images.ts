/**
 * 후기 사진 — 경로·크기·주소 규칙의 **단일 출처** (010 마이그레이션과 짝).
 *
 * 브라우저(`ReviewForm`)·라우트(`/api/reviews`)·화면(목록·상세·어드민)이
 * 전부 여기서 읽는다. 상한이 두 군데 적혀 있으면 한쪽만 고쳐져서 "브라우저는
 * 통과시켰는데 서버가 거절" 이 생긴다 — 사용자에게는 이유 없는 실패다.
 *
 * 비밀이 없는 모듈이라 클라이언트 번들에 들어가도 된다.
 */

export const REVIEW_IMAGE_BUCKET = "review-images";

/** 후기 한 건에 붙일 수 있는 장수 (2026-10-26 사용자 결정) */
export const MAX_REVIEW_IMAGES = 3;

/**
 * 원본 한 장 상한. 010 의 버킷 `file_size_limit`(1258291)과 같은 값이다.
 *
 * Vercel 함수 본문 상한이 4.5MB 라서 3장 × (원본 + 썸네일) + 글이 그 안에
 * 들어가야 한다: 3 × (1.2MB + 0.15MB) ≈ 4.05MB. 실제로는 브라우저가 1600px
 * 로 줄여 보내 한 장 300KB 안팎이고, 이 상한은 줄이기를 건너뛴 요청을 막는 선이다.
 */
export const MAX_FULL_BYTES = 1_258_291;
export const MAX_THUMB_BYTES = 150 * 1024;
/** multipart 본문 전체 상한 — Vercel 4.5MB 보다 조금 낮게 */
export const MAX_UPLOAD_BODY = 4_400_000;

/** 원본 긴 변 · 썸네일 긴 변(px). 목록 카드는 최대 약 360px 폭 × 2배 밀도 */
export const FULL_EDGE = 1600;
export const THUMB_EDGE = 720;

export type ReviewImageExt = "webp" | "jpg";

/** 010 의 `reviews_image_paths_format` 과 같은 모양 */
const PATH_RE = /^r\/[0-9a-f]{32}\.(webp|jpg)$/;

export function isReviewImagePath(p: unknown): p is string {
  return typeof p === "string" && PATH_RE.test(p);
}

/** 원본 경로 → 썸네일 경로. `r/ab…cd.webp` → `r/ab…cd.t.webp` */
export function thumbPath(path: string): string {
  return path.replace(/\.(webp|jpg)$/, ".t.$1");
}

/**
 * 공개 주소. public 버킷이라 서명이 필요 없다 — 그래서 ISR 로 구운 HTML 에
 * 넣어도 만료되지 않는다. (비공개 버킷 + 서명 URL 이면 5분 캐시된 페이지의
 * 이미지가 서명 만료로 깨진다.)
 */
export function reviewImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/storage/v1/object/public/${REVIEW_IMAGE_BUCKET}/${path}`;
}

export function reviewThumbUrl(path: string): string {
  return reviewImageUrl(thumbPath(path));
}

/**
 * 사진 한 장의 대체 텍스트. 운영자가 적은 설명이 있으면 그것, 없으면 자동 문구.
 *
 * 설명은 **선택**이다(011, 2026-10-26 사용자 결정 — 운영자는 승인만 누른다).
 * 비었다고 `alt=""` 로 두지 않는다. 그건 "정보 없는 장식" 이라는 선언이고,
 * 후기 사진에선 거의 항상 거짓이다(CLAUDE.md). 자동 문구는 사진 내용을 말하지
 * 못하지만 "작성자가 올린 사진이 여기 있다" 는 사실은 정확히 전한다.
 */
export function reviewImageAlt(
  alts: readonly string[] | null | undefined,
  index: number,
  count: number,
): string {
  const written = alts?.[index]?.trim();
  if (written) return written;
  return count > 1 ? `작성자가 올린 사진 ${index + 1}/${count}` : "작성자가 올린 사진";
}

/**
 * 파일 앞 몇 바이트로 형식을 판정한다. **브라우저가 붙인 Content-Type 은
 * 믿지 않는다** — 요청을 직접 만들면 아무 값이나 붙일 수 있다.
 * 캔버스가 만드는 두 형식(WebP, JPEG)만 받는다.
 */
export function sniffImage(bytes: Uint8Array): ReviewImageExt | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  // WebP: "RIFF" ???? "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export const CONTENT_TYPE: Record<ReviewImageExt, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
};
