/**
 * 메인 포스터 생성기 — docs/ 의 운영자 제작 원본에서 웹용 포스터를 만든다.
 *
 *   node scripts/build-posters.mjs
 *
 * 하는 일 (포스터마다)
 *   1. 바깥 빈 여백을 잘라낸다 — 내용 경계에서 PAD 비율만큼만 남긴다.
 *      원본은 위아래 여백이 넉넉해 같은 폭에 그리면 화면 높이를 많이 먹었다.
 *   2. 바탕색을 페이지 배경(`--background` #fafaf8)으로 맞춘다.
 *      원본 바탕은 흰색(254)과 오프화이트(248~250)가 섞여 있어 그대로 깔면
 *      포스터마다 옅은 사각형 경계가 보인다. 가장자리 색 → 목표색 비율을
 *      **채널별 곱셈**으로 전체에 적용한다 — 바탕만 칠하면 글자·그림 테두리의
 *      안티에일리어싱 픽셀에 흰 테가 남지만, 곱셈은 1~2% 톤 이동이라 경계가 없다.
 *   3. 출력 크기를 찍는다 → `lib/site-config.ts` 의 width/height 에 반영할 것.
 *
 * 포스터를 교체하면 원본을 docs/ 에 넣고 JOBS 의 파일명만 바꿔 다시 돌린다.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "..", "docs");
const OUT = join(ROOT, "public", "poster");

/** globals.css `--background` 와 같아야 한다 */
const PAGE_BG = [250, 250, 248];
/** 내용 경계 밖으로 남길 여백 — 짧은 변 기준 비율 */
const PAD = 0.035;
/** 바탕으로 볼 허용 오차 (채널별) */
const TOL = 14;

const JOBS = [
  ["메인 포스터 수정본 막.jpg", "main-v3.jpg"],
  ["서브포스터.jpg", "carriers.jpg"],
  ["상담 포스터.jpg", "consult.jpg"],
  ["과정안내 포스터.jpg", "process.jpg"],
];

for (const [src, out] of JOBS) {
  const { data, info } = await sharp(join(DOCS, src))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const at = (x, y) => (y * W + x) * C;

  // 네 귀퉁이 중앙값(채널별)을 바탕색으로 본다 — 평균이면 그림이 귀퉁이 하나에
  // 닿을 때(메인 포스터의 초록 원) 바탕색이 그 색으로 끌려간다
  const corners = [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5]];
  const edge = [0, 1, 2].map((k) => {
    const v = corners.map(([x, y]) => data[at(x, y) + k]).sort((a, b) => a - b);
    return (v[1] + v[2]) / 2;
  });
  const isBg = (i) => Math.abs(data[i] - edge[0]) < TOL &&
    Math.abs(data[i + 1] - edge[1]) < TOL && Math.abs(data[i + 2] - edge[2]) < TOL;

  // 내용 경계 (2px 간격 표본이면 충분하다)
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (isBg(at(x, y))) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const pad = Math.round(Math.min(W, H) * PAD);
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  const width = Math.min(W, x1 + pad) - left;
  const height = Math.min(H, y1 + pad) - top;

  const gain = PAGE_BG.map((t, k) => t / edge[k]);
  const res = await sharp(join(DOCS, src))
    .removeAlpha()
    .extract({ left, top, width, height })
    .linear(gain, [0, 0, 0])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(join(OUT, out));

  console.log(
    `${out.padEnd(13)} ${W}×${H} → ${res.width}×${res.height}  ` +
      `바탕 ${edge.map((v) => Math.round(v)).join(",")} → ${PAGE_BG.join(",")}  ${Math.round(res.size / 1024)}KB`,
  );
}
