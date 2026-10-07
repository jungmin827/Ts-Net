/**
 * 홍보 이미지 생성기 — "가입 전, 이 세 가지만 확인하세요"
 *
 *   node scripts/build-promo-image.mjs
 *
 * 만드는 것
 *   public/promo/check-three.png     데스크톱 2240x920 (표시 1120x460 의 2배)
 *   public/promo/check-three-m.png   모바일   750x1260 (표시 375x630 의 2배)
 *
 * 왜 이 내용인가 —
 * 레퍼런스 사이트는 같은 자리에서 "최대 ○○만원", "업계 최저가" 처럼 숫자로 소리친다.
 * 우리는 그 반대를 쓴다. 가입 상담에서 방문자가 **나중에 분쟁이 되는 세 가지**
 * (약정·위약금 / 설치비·장비 / 사은품 조건)를 먼저 밝히겠다고 말하는 쪽이,
 * 신뢰도가 낮은 이 업종에서 실제 차별점이 된다.
 * 숫자를 한 글자도 쓰지 않으므로 표시광고법 리스크도 없다 (CLAUDE.md 규칙 6).
 *
 * 문구를 바꾸려면 아래 COPY 만 고친다. 줄바꿈은 배열 한 칸이 한 줄이다
 * (SVG text 는 자동 줄바꿈이 없어 직접 끊어야 한다).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "promo");

// globals.css 토큰과 같은 값 — 사이트와 이미지의 초록이 어긋나면 바로 티가 난다
const C = {
  ink: "#17191c",
  muted: "#5b6670",
  faint: "#8e9aa6",
  brand: "#07b040",
  brandDark: "#0a8230",
  brandLight: "#dff7e6",
  line: "#e4eaf0",
  surface: "#f5f8fa",
  white: "#ffffff",
};
const FONT = "Apple SD Gothic Neo";

const COPY = {
  eyebrow: "상담 전에 알려드립니다",
  title: ["가입 전, 이 세 가지만", "확인하세요"],
  sub: "나중에 분쟁이 되는 건 늘 같은 세 가지입니다. 상담 때 먼저 짚어 드립니다.",
  cards: [
    {
      n: "1",
      title: "약정과 위약금",
      body: ["몇 년 약정인지,", "중간에 해지하면", "얼마를 물어야 하는지"],
    },
    {
      n: "2",
      title: "설치비와 장비",
      body: ["설치비·공유기 임대료가", "월 요금에 포함인지", "따로 붙는지"],
    },
    {
      n: "3",
      title: "사은품 조건",
      body: ["언제 받는지,", "어떤 조건을 채워야", "지급되는지"],
    },
  ],
  footer: "숫자부터 말하지 않습니다. 조건부터 말씀드립니다.",
};

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 여러 줄 텍스트. SVG 는 자동 줄바꿈이 없어 tspan 으로 직접 쌓는다 */
const lines = (arr, x, y, lh, attrs) =>
  arr
    .map(
      (t, i) =>
        `<text x="${x}" y="${y + i * lh}" ${attrs}>${esc(t)}</text>`,
    )
    .join("");

/**
 * 카드가 본문을 담는 데 필요한 높이를 **내용에서 계산한다.**
 *
 * 예전에는 데스크톱 330 / 모바일 222 로 박아 뒀는데, 본문이 3줄인 카드에서
 * 마지막 줄이 테두리를 넘어 잘렸다(모바일은 푸터 문구와 겹치기까지 했다).
 * 줄 수가 바뀌면 높이도 따라가야 한다 — 숫자를 손으로 맞추면 다음에 또 어긋난다.
 *
 * card() 의 좌표 계산과 **같은 식**을 쓴다. 한쪽만 고치면 다시 틀어지므로
 * 수정할 때는 반드시 두 곳을 함께 본다.
 */
function cardHeight(lineCount, w, numSize, titleSize, bodySize) {
  const pad = Math.round(w * 0.082);
  const titleBaseline = pad + numSize * 1.05 + titleSize;
  const bodyStart = titleBaseline + Math.round(bodySize * 2.15);
  const lastBaseline = bodyStart + (lineCount - 1) * Math.round(bodySize * 1.6);
  // 마지막 줄의 디센더 여유 + 아래 여백
  return Math.ceil(lastBaseline + bodySize * 0.32 + pad);
}

/** 카드 한 장 */
function card(x, y, w, h, c, numSize, titleSize, bodySize) {
  const pad = Math.round(w * 0.082);
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(w * 0.055)}"
            fill="${C.white}" stroke="${C.line}" stroke-width="2"/>
      <circle cx="${x + pad + numSize * 0.55}" cy="${y + pad + numSize * 0.55}"
              r="${numSize * 0.55}" fill="${C.brandLight}"/>
      <text x="${x + pad + numSize * 0.55}" y="${y + pad + numSize * 0.55 + numSize * 0.33}"
            text-anchor="middle" font-family="${FONT}" font-weight="800"
            font-size="${numSize}" fill="${C.brandDark}">${c.n}</text>
      <text x="${x + pad}" y="${y + pad + numSize * 1.05 + titleSize}"
            font-family="${FONT}" font-weight="800" font-size="${titleSize}"
            fill="${C.ink}">${esc(c.title)}</text>
      ${lines(
        c.body,
        x + pad,
        y + pad + numSize * 1.05 + titleSize + Math.round(bodySize * 2.15),
        Math.round(bodySize * 1.6),
        `font-family="${FONT}" font-weight="400" font-size="${bodySize}" fill="${C.muted}"`,
      )}
    </g>`;
}

function desktopSvg() {
  const W = 2240;
  // 전체 높이도 카드 높이에서 따라온다
  const M = 110; // 바깥 여백
  const cardW = Math.round((W - M * 2 - 48 * 2) / 3);
  const cardY = 468;
  const maxLines = Math.max(...COPY.cards.map((c) => c.body.length));
  const cardH = cardHeight(maxLines, cardW, 52, 38, 27);
  const H = cardY + cardH + 118; // 카드 아래 푸터 한 줄 + 여백
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.white}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${C.line}" stroke-width="4"/>
    <rect x="${M}" y="104" width="96" height="10" rx="5" fill="${C.brand}"/>
    <text x="${M}" y="178" font-family="${FONT}" font-weight="700" font-size="34" fill="${C.brandDark}">${esc(COPY.eyebrow)}</text>
    ${lines(COPY.title, M, 266, 88, `font-family="${FONT}" font-weight="800" font-size="72" fill="${C.ink}"`)}
    <text x="${M}" y="420" font-family="${FONT}" font-weight="400" font-size="32" fill="${C.muted}">${esc(COPY.sub)}</text>
    ${COPY.cards
      .map((c, i) =>
        card(M + i * (cardW + 48), cardY, cardW, cardH, c, 52, 38, 27),
      )
      .join("")}
    <text x="${M}" y="${cardY + cardH + 72}" font-family="${FONT}" font-weight="700"
          font-size="30" fill="${C.faint}">${esc(COPY.footer)}</text>
  </svg>`;
}

function mobileSvg() {
  const W = 750;

  const M = 56;
  const cardW = W - M * 2;
  const gap = 22;
  const cardY0 = 436;
  const maxLinesM = Math.max(...COPY.cards.map((c) => c.body.length));
  const cardH = cardHeight(maxLinesM, cardW, 46, 33, 25);
  const H = cardY0 + 3 * (cardH + gap) + 96; // 푸터 한 줄 + 여백
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.white}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${C.line}" stroke-width="3"/>
    <rect x="${M}" y="72" width="76" height="9" rx="4.5" fill="${C.brand}"/>
    <text x="${M}" y="134" font-family="${FONT}" font-weight="700" font-size="28" fill="${C.brandDark}">${esc(COPY.eyebrow)}</text>
    ${lines(COPY.title, M, 212, 70, `font-family="${FONT}" font-weight="800" font-size="58" fill="${C.ink}"`)}
    ${lines(
      ["나중에 분쟁이 되는 건 늘 같은 세 가지입니다.", "상담 때 먼저 짚어 드립니다."],
      M,
      330,
      44,
      `font-family="${FONT}" font-weight="400" font-size="29" fill="${C.muted}"`,
    )}
    ${COPY.cards
      .map((c, i) =>
        card(M, cardY0 + i * (cardH + gap), cardW, cardH, c, 46, 33, 25),
      )
      .join("")}
    <text x="${M}" y="${cardY0 + 3 * (cardH + gap) + 50}" font-family="${FONT}"
          font-weight="700" font-size="25" fill="${C.faint}">${esc(COPY.footer)}</text>
  </svg>`;
}

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of [
  ["check-three.png", desktopSvg()],
  ["check-three-m.png", mobileSvg()],
]) {
  const info = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  console.log(`public/promo/${name}  ${info.width}x${info.height}`);
}
