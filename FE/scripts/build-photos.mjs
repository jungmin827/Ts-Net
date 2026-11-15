/**
 * 메인 섹션 사진 생성기 — docs/photo/ 의 원본에서 웹용 사진을 만든다.
 *
 *   node scripts/build-photos.mjs
 *
 * 포스터(`build-posters.mjs`)와 다른 점 — 이 사진들은 **글자 없는 생성 이미지**다.
 * 문구는 `lib/site-config.ts` 의 `promises`·`journey` 에 있고 코드(Promises·Journey)가
 * 사진 옆에 얹는다. 그래서 여백 트림·바탕색 보정이 없다 — 사진은 카드 안에 갇히고
 * 페이지 면과 이어질 일이 없다. 하는 일은 크기 맞춤과 JPEG 압축뿐이다.
 *
 * 교체할 때
 *   · 원본을 docs/photo/ 에 넣고 JOBS 의 파일명을 바꾼다. 출력 파일명도 **바꾼다**
 *     — 같은 이름으로 덮으면 이미지 최적화 캐시가 옛 그림을 계속 내준다
 *     (`site-config.ts` 의 hero.poster 주석과 같은 규칙).
 *   · 출력 크기를 바꾸면 `site-config.ts` 의 width/height 도 같이 고친다
 *     — next/image 가 그 값으로 자리를 미리 잡는다.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "..", "docs", "photo");
const OUT = join(ROOT, "public", "photo");

/** [원본, 출력, 폭, 높이] — 상담 방식 3장(3:2) · 가입 절차 4장(1:1) */
const JOBS = [
  ["A1.png", "promise-calculator.jpg", 1200, 800],
  ["A2.png", "promise-remote.jpg", 1200, 800],
  ["A3.png", "promise-jar.jpg", 1200, 800],
  ["B1.png", "step-apply.jpg", 900, 900],
  ["B2.png", "step-call.jpg", 900, 900],
  ["B3.png", "step-install.jpg", 900, 900],
  ["B4.png", "step-gift.jpg", 900, 900],
];

for (const [src, out, w, h] of JOBS) {
  const meta = await sharp(join(DOCS, src)).metadata();
  const res = await sharp(join(DOCS, src))
    .resize(w, h, { fit: "cover" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(join(OUT, out));

  console.log(
    `${out.padEnd(23)} ${meta.width}×${meta.height} → ${res.width}×${res.height}  ` +
      `${Math.round(res.size / 1024)}KB`,
  );
}
