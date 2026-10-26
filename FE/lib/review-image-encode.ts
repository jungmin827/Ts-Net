import {
  FULL_EDGE,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  THUMB_EDGE,
  type ReviewImageExt,
} from "@/lib/review-images";

/**
 * 후기 사진을 **브라우저에서** 줄이고 다시 굽는다 — 클라이언트 전용.
 *
 * ── 왜 서버가 아니라 여기서 하는가 ─────────────────────────────
 *   · 휴대폰 원본은 3~10MB 다. 그대로 보내면 Vercel 함수 본문 상한(4.5MB)에
 *     한 장도 안 들어가고, 무료 플랜 저장·전송량을 원본이 다 먹는다.
 *   · 유료 이미지 변환(Supabase Transform · Vercel Image Optimization)을 쓰지
 *     않기로 했다. 줄인 결과를 그대로 저장하면 변환할 것이 없다.
 *
 * ── 위치정보가 여기서 지워진다 ─────────────────────────────────
 * 캔버스에 그려서 새로 인코딩하면 원본의 EXIF(촬영 위치 GPS·기기명)가 따라오지
 * 않는다. 집에서 찍은 설치 사진에는 집 좌표가 박혀 있다 — 후기에 그게 붙어
 * 게시되면 주소를 공개한 것과 같다. 회전값만 먼저 반영한다(`from-image`).
 */

export interface EncodedPhoto {
  full: Blob;
  thumb: Blob;
  ext: ReviewImageExt;
}

/** 이 크기를 넘는 원본은 열지 않는다 — 디코딩만으로 저사양 폰의 메모리가 바닥난다 */
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export class PhotoError extends Error {}

async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch {
      // 일부 브라우저는 옵션 객체나 특정 형식을 못 받는다 — <img> 로 한 번 더
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 올려 주세요");
  }
  return {
    src: img,
    w: img.naturalWidth,
    h: img.naturalHeight,
    done: () => URL.revokeObjectURL(url),
  };
}

function draw(src: CanvasImageSource, w: number, h: number, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("사진을 처리하지 못했어요. 다른 브라우저로 시도해 주세요");
  // 투명 PNG 를 JPEG 로 구우면 투명한 곳이 검게 나온다 — 흰 바탕을 먼저 깐다
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

const QUALITIES: Record<ReviewImageExt, number[]> = {
  webp: [0.82, 0.72, 0.6, 0.5],
  jpg: [0.85, 0.75, 0.62, 0.5],
};
const MIME: Record<ReviewImageExt, string> = { webp: "image/webp", jpg: "image/jpeg" };

/** 상한 안에 들 때까지 품질을 낮춰 굽는다. 그 형식을 못 만들면 `null` */
async function encodeAs(
  canvas: HTMLCanvasElement,
  ext: ReviewImageExt,
  maxBytes: number,
): Promise<Blob | null> {
  for (const q of QUALITIES[ext]) {
    const blob = await toBlob(canvas, MIME[ext], q);
    // 요청한 형식을 못 만들면(Safari 의 WebP) 브라우저는 PNG 를 돌려준다 —
    // 그걸 WebP 라고 올리면 서버 판정에서 거절된다
    if (!blob || blob.type !== MIME[ext]) return null;
    if (blob.size <= maxBytes) return blob;
  }
  throw new PhotoError("사진이 너무 커요. 다른 사진으로 올려 주세요");
}

export async function encodeReviewPhoto(file: File): Promise<EncodedPhoto> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new PhotoError("사진 파일만 올릴 수 있어요");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PhotoError("30MB 넘는 사진은 올릴 수 없어요");
  }

  const { src, w, h, done } = await decode(file);
  try {
    const big = draw(src, w, h, FULL_EDGE);
    const small = draw(src, w, h, THUMB_EDGE);

    let ext: ReviewImageExt = "webp";
    let full = await encodeAs(big, "webp", MAX_FULL_BYTES);
    if (!full) {
      ext = "jpg";
      full = await encodeAs(big, "jpg", MAX_FULL_BYTES);
    }
    // 썸네일은 원본과 **같은 형식**이어야 한다 — 경로를 원본에서 유도한다(`thumbPath`)
    const thumb = full ? await encodeAs(small, ext, MAX_THUMB_BYTES) : null;
    if (!full || !thumb) {
      throw new PhotoError("이 브라우저에서는 사진을 처리하지 못했어요. 다른 브라우저로 시도해 주세요");
    }
    return { full, thumb, ext };
  } finally {
    done();
  }
}
