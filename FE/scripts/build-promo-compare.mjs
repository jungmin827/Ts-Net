/**
 * `afterHero` 슬롯용 — "비교하실 때 이 네 가지를 같이 보세요".
 *
 * 왜 이 자리에 이 내용인가 —
 *   히어로 왼쪽 카피가 "다른 곳과 비교하고 오셔도 됩니다 / 챗지피티에게 견적을
 *   물어보고 오셔도 됩니다" 로 끝난다. 그 바로 아래 자리이므로, **비교하라고
 *   해놓고 무엇을 비교해야 하는지는 안 알려주는 공백**을 메우는 게 가장 자연스럽다.
 *   덧붙이는 블록이 아니라 앞 문장의 뒷말이 되게 썼다.
 *
 * 왜 얇은 스트립인가 —
 *   메인이 이미 10,243px 로 레퍼런스(8,819px)보다 길다. 여기에 다른 홍보 이미지들
 *   (1,000~1,900px)과 같은 덩치를 하나 더 얹으면 길이만 늘고 밀도는 떨어진다.
 *   가로로 눕혀 2x2 로 배치해 **렌더 폭 1120px 기준 약 280px**만 쓴다.
 *
 * 문구 원칙 — 숫자를 지어내지 않는다. 네 항목은 전부 FAQ·요금 고지에 이미 있는
 * 사실의 요약이고, "더 싸다 / 더 좋다" 류의 비교우위 주장은 넣지 않는다
 * (CLAUDE.md 규칙 5·6).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { C, FONT, esc, fit, finish, assertFit } from "./promo-kit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "promo");

const COPY = {
  eyebrow: "비교하실 때",
  title: ["다른 곳과 비교하실 때", "이 네 가지를 같이 보세요"],
  /** 데스크톱은 한 줄, 모바일은 두 줄로 쓴다 (폭이 좁아 한 줄이면 넘친다) */
  sub: ["월 요금이 같아도 조건이 다르면", "실제 부담은 달라집니다."],
  items: [
    { n: "01", t: "월 요금", b: "약정·결합 조건을 맞춰야 같은 비교가 됩니다" },
    { n: "02", t: "약정 기간", b: "중간에 해지하면 할인반환금이 생깁니다" },
    { n: "03", t: "설치비·장비", b: "설치 환경과 구성에 따라 달라집니다" },
    { n: "04", t: "사은품 조건", b: "지급 시점과 반환 조건까지 확인하세요" },
  ],
  closing: "비교해 보신 뒤에 결정하셔도 됩니다.",
};

const T = (x, y, s, { size, weight = 400, fill = C.ink, anchor = "start" }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;

/** 번호 + 제목 + 본문 한 덩어리 */
function item(x, y, w, it, numSize, titleSize, bodySize) {
  fit(`항목 제목 "${it.t}"`, it.t, titleSize, w);
  fit(`항목 본문 "${it.t}"`, it.b, bodySize, w);
  return `
    <g>
      ${/* 번호는 글자다 — `--brand`(흰 배경 2.88:1)를 쓰면 큰 글자 3:1 도 못 넘는다.
            장식 면에만 쓰라고 CLAUDE.md 색 표에 적어 둔 그 색이다. */ ""}
      ${T(x, y, it.n, { size: numSize, weight: 800, fill: C.brandDark })}
      ${T(x, y + titleSize * 1.5, it.t, { size: titleSize, weight: 800 })}
      ${T(x, y + titleSize * 1.5 + bodySize * 1.75, it.b, { size: bodySize, fill: C.muted })}
      <rect x="${x}" y="${y - numSize * 1.05}" width="${Math.round(numSize * 1.5)}" height="4" rx="2" fill="${C.brandLight}"/>
    </g>`;
}

function desktop() {
  const W = 2240, H = 620;
  const M = 110;                 // 좌우 여백
  const colX = 1060;             // 오른쪽 격자 시작
  const colW = 520;              // 한 칸 폭
  const gap = 60;
  COPY.title.forEach((t) => fit("제목", t, 62, colX - M - 60));
  const subOne = COPY.sub.join(" ");
  fit("보조설명", subOne, 30, colX - M - 60);
  fit("맺음말", COPY.closing, 28, W - M * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.white}"/>
    <rect x="${M}" y="88" width="88" height="9" rx="4.5" fill="${C.brand}"/>
    ${T(M, 160, COPY.eyebrow, { size: 30, weight: 800, fill: C.brandDark })}
    ${T(M, 240, COPY.title[0], { size: 62, weight: 900 })}
    ${T(M, 318, COPY.title[1], { size: 62, weight: 900 })}
    ${T(M, 384, subOne, { size: 30, fill: C.muted })}
    ${T(M, 540, COPY.closing, { size: 28, weight: 700, fill: C.brandDeep })}
    ${COPY.items
      .map((it, i) =>
        item(colX + (i % 2) * (colW + gap), 160 + Math.floor(i / 2) * 196, colW, it, 34, 36, 26),
      )
      .join("")}
  </svg>`;
}

function mobile() {
  const W = 750, H = 1215;
  const M = 56;
  const inner = W - M * 2;
  COPY.title.forEach((t) => fit("모바일 제목", t, 52, inner));
  COPY.sub.forEach((t) => fit("모바일 보조설명", t, 26, inner));
  fit("모바일 맺음말", COPY.closing, 25, inner);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.white}"/>
    <rect x="${M}" y="70" width="76" height="8" rx="4" fill="${C.brand}"/>
    ${T(M, 132, COPY.eyebrow, { size: 27, weight: 800, fill: C.brandDark })}
    ${T(M, 202, COPY.title[0], { size: 52, weight: 900 })}
    ${T(M, 268, COPY.title[1], { size: 52, weight: 900 })}
    ${COPY.sub.map((t, i) => T(M, 328 + i * 38, t, { size: 26, fill: C.muted })).join("")}
    ${COPY.items
      .map((it, i) => item(M, 458 + i * 178, inner, it, 30, 34, 25))
      .join("")}
    ${T(M, 1168, COPY.closing, { size: 25, weight: 700, fill: C.brandDeep })}
  </svg>`;
}

// SVG 를 먼저 전부 만들고, 넘쳤으면 파일을 한 장도 쓰지 않고 끊는다
const JOBS = [
  ["compare-four.png", desktop()],
  ["compare-four-m.png", mobile()],
];
assertFit();

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of JOBS) {
  const info = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  console.log(`public/promo/${name}  ${info.width}x${info.height}`);
}

finish();
