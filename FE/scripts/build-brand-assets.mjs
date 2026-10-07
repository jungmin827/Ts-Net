/**
 * 브랜드 에셋 생성기 — 원본 로고 한 장에서 웹용 워드마크와 아이콘 세트를 만든다.
 *
 *   node scripts/build-brand-assets.mjs
 *
 * 만드는 것
 *   public/logo.png       헤더·푸터 워드마크 (여백 트림 + 투명 + 팔레트 색)
 *   app/icon.png          512px 파비콘
 *   app/apple-icon.png    180px 홈화면 아이콘
 *   app/favicon.ico       16/32/48 을 담은 ico
 *
 * 로고를 교체할 때는 SOURCE 만 바꾸고 다시 돌리면 된다. 원본이 흰 배경 위 2도 인쇄가
 * 아니라면 MEASURED 값을 실측해 고쳐야 한다 (아래 주석 참고).
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "..", "docs", "TS-Net 로고.jpg");

// 원본에서 실측한 잉크 2종. 다른 원본을 쓰면 이 값을 다시 재야 한다
// (비배경 픽셀을 색상별로 군집화해 최빈 2개의 평균을 구하면 된다).
const MEASURED = [
  [105, 167, 44], // #69a72c 밝은 초록 (원본 잉크 — 바꾸지 말 것)
  [5, 73, 42], //   #05492a 진초록
];
// 찍히는 색은 사이트 팔레트를 따른다 (globals.css --brand / --brand-deep).
// 원본의 밝은 초록은 올리브 쪽이라 주조색과 색상각이 49° 벌어진다.
const BRAND = [
  [7, 176, 64], // #07b040  --brand
  [7, 82, 31], //  #07521f  --brand-deep
];

const ICON = 512;
const ICON_RADIUS = 0.22 * ICON;
const ICON_TEXT = "TS";
const ICON_FONT = "Avenir Next Heavy 400"; // 로고의 각진 S 종단에 가장 가까운 시스템 폰트
const ICON_SHEAR = -0.13; // 워드마크의 기울기
const ICON_FILL = 0.66; // 글자가 차지하는 타일 폭 비율

/**
 * 흰 배경 위 2도 인쇄를 알파 있는 평면 2도로 되돌린다.
 * 픽셀마다 `observed = ink·a + 255·(1−a)` 를 알파에 대해 풀고, 두 잉크 중 오차가
 * 작은 쪽을 고른다. 임계값으로 자르는 방식과 달리 안티에일리어싱이 그대로 살아남아
 * 흰색이 아닌 면 위에 얹어도 가장자리가 튀지 않는다.
 */
async function unmatte(src) {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // 잉크마다 흰색과 가장 크게 벌어지는 채널을 알파 계산 기준으로 쓴다 (가장 안정적)
  const basis = MEASURED.map((c) => {
    const d = c.map((v) => 255 - v);
    return d.indexOf(Math.max(...d));
  });

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const px = [data[i * channels], data[i * channels + 1], data[i * channels + 2]];
    let best = 0;
    let bestErr = Infinity;
    let bestAlpha = 0;
    for (let k = 0; k < MEASURED.length; k++) {
      const c = basis[k];
      const a = Math.max(0, Math.min(1, (255 - px[c]) / (255 - MEASURED[k][c])));
      let err = 0;
      for (let j = 0; j < 3; j++) err += (px[j] - (MEASURED[k][j] * a + 255 * (1 - a))) ** 2;
      if (err < bestErr) {
        bestErr = err;
        best = k;
        bestAlpha = a;
      }
    }
    if (bestAlpha < 0.02) bestAlpha = 0; // JPEG 노이즈로 생긴 옅은 헤일로 제거
    const o = i * 4;
    const ink = BRAND[best];
    out[o] = ink[0];
    out[o + 1] = ink[1];
    out[o + 2] = ink[2];
    out[o + 3] = Math.round(bestAlpha * 255);
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png();
}

/** PNG 여러 장을 하나의 .ico 로 묶는다 (Vista 이후 표준 — 현행 브라우저 전부 지원) */
function packIco(pngs, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((n, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(n === 256 ? 0 : n, 0);
    e.writeUInt8(n === 256 ? 0 : n, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

async function buildWordmark() {
  const flat = await unmatte(SOURCE);
  // 원본은 캔버스의 78% 가 여백이라 반드시 트림한다
  const trimmed = await flat.trim({ threshold: 1 }).toBuffer();
  await sharp(trimmed)
    .resize({ height: 200, fit: "inside", kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(ROOT, "public", "logo.png"));

  const { width, height } = await sharp(join(ROOT, "public", "logo.png")).metadata();
  console.log(`public/logo.png ${width}x${height}  ← SITE.logo 의 width/height 와 맞출 것`);
}

async function buildIcons() {
  const tile = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="rgb(${BRAND[0]})"/><stop offset="1" stop-color="rgb(${BRAND[1]})"/>
      </linearGradient></defs>
      <rect width="${ICON}" height="${ICON}" rx="${ICON_RADIUS}" ry="${ICON_RADIUS}" fill="url(#g)"/>
    </svg>`),
  )
    .png()
    .toBuffer();

  let label = await sharp({
    text: { text: `<span foreground="white">${ICON_TEXT}</span>`, font: ICON_FONT, rgba: true },
  })
    .png()
    .toBuffer();
  label = await sharp(label)
    .affine([[1, ICON_SHEAR], [0, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .trim({ threshold: 1 })
    .resize({ width: Math.round(ICON * ICON_FILL), kernel: "lanczos3" })
    .toBuffer();

  const lm = await sharp(label).metadata();
  const icon = await sharp(tile)
    .composite([
      { input: label, left: Math.round((ICON - lm.width) / 2), top: Math.round((ICON - lm.height) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(join(ROOT, "app", "icon.png"), icon);
  await sharp(icon).resize(180, 180, { kernel: "lanczos3" }).png().toFile(join(ROOT, "app", "apple-icon.png"));

  const sizes = [16, 32, 48];
  const pngs = [];
  for (const n of sizes) {
    pngs.push(await sharp(icon).resize(n, n, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer());
  }
  writeFileSync(join(ROOT, "app", "favicon.ico"), packIco(pngs, sizes));
  console.log(`app/icon.png ${ICON}px · app/apple-icon.png 180px · app/favicon.ico ${sizes.join("/")}`);
}

await buildWordmark();
await buildIcons();
