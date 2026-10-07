/**
 * 홍보 이미지 생성기 2차 — 빈 슬롯 3곳 채우기
 *
 *   node scripts/build-promo-images-2.mjs
 *
 * 만드는 것 (슬롯 → 파일)
 *   afterPromoBand   public/promo/what-we-do.png        / -m.png
 *   afterPriceCompare  public/promo/choose-criteria.png / -m.png
 *   beforeFooter     public/promo/before-call.png       / -m.png
 *
 * `scripts/build-promo-image.mjs`(1차, check-three) 와 같은 방식이다 —
 * SVG 문자열을 만들어 sharp 로 PNG 를 굽는다. 톤·토큰·조판도 1차에 맞췄다.
 *
 * 1차에서 겪은 문제: SVG 는 자동 줄바꿈이 없고, 카드 높이를 상수로 박으면
 * 본문 줄 수가 늘었을 때 글자가 테두리를 넘는다. 그래서 2차는
 *   - 카드·패널 높이를 **내용에서 계산**하고
 *   - 글자 폭을 추정해 상자를 넘으면 콘솔에 경고를 찍는다 (FIT 검사)
 * 두 장치를 넣었다. 문구를 고친 뒤 경고가 뜨면 줄을 더 끊으면 된다.
 *
 * 문구는 아래 COPY 만 고친다. 배열 한 칸이 화면 한 줄이다.
 * `*M` 으로 끝나는 키는 모바일 전용 줄바꿈이다 — 모바일은 데스크톱 축소본이
 * 아니라 세로 재조판이라, 같은 문장을 더 잘게 끊어 쓴다.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "promo");

/* 팔레트·폰트·측정 도구는 공용 모듈 한 곳에서 온다 (scripts/promo-kit.mjs).
   예전에는 생성기마다 복제해 두었고, 그러다 `faint` 가 어긋나
   1차 생성기가 만든 이미지의 마무리 문장만 2.87:1 로 찍혔다. */
import { C, FONT, esc, fit, finish, assertFit } from "./promo-kit.mjs";

/* =====================================================================
   COPY — 운영자가 고치는 유일한 자리
   ===================================================================== */

const COPY = {
  /* A. afterPriceCompare — 요금 비교표 아래 (통신사 4카드 바로 밑이 아니다).
     "KT? SK? 뭘 골라야 하지"에서 막힌 방문자에게 **고르는 기준**만 준다.
     어느 통신사가 더 낫다는 말은 한 줄도 쓰지 않는다 (비교 광고 회피). */
  chooseCriteria: {
    base: "choose-criteria",
    eyebrow: "통신사 고르기",
    title: ["통신사는 어디가 더 좋은지가 아니라", "무엇이 맞는지로 고릅니다"],
    titleM: ["어디가 더 좋은지보다", "무엇이 맞는지를", "먼저 봅니다"],
    sub: ["설치 주소·TV 구성·휴대폰 회선. 이 세 가지가 정해지면 선택지는 저절로 좁혀집니다."],
    subM: ["설치 주소·TV 구성·휴대폰 회선.", "이 세 가지가 정해지면", "선택지는 저절로 좁혀집니다."],
    cards: [
      {
        n: "1",
        title: "설치할 주소",
        body: ["주소마다 들어와 있는", "회선 종류가 다릅니다.", "가능한 속도부터 확인합니다"],
        bodyM: ["주소마다 들어와 있는 회선", "종류가 다릅니다. 가능한", "속도부터 확인합니다"],
      },
      {
        n: "2",
        title: "보려는 TV 채널",
        body: ["즐겨 보시는 채널이", "어느 상품에 들어 있는지,", "셋톱은 어떤 종류인지"],
        bodyM: ["즐겨 보시는 채널이 어느", "상품에 들어 있는지,", "셋톱은 어떤 종류인지"],
      },
      {
        n: "3",
        title: "묶을 휴대폰 회선",
        body: ["가족 회선이 몇 개이고", "어느 통신사인지에 따라", "결합 방식이 달라집니다"],
        bodyM: ["가족 회선이 몇 개이고 어느", "통신사인지에 따라 결합", "방식이 달라집니다"],
      },
    ],
    footer: "어느 통신사가 더 낫다고 말하지 않습니다. 조건에 맞는 쪽을 함께 찾습니다.",
    footerM: ["어느 통신사가 더 낫다고 말하지", "않습니다. 맞는 쪽을 함께 찾습니다."],
    alt: "통신사는 어디가 더 좋은지가 아니라 무엇이 맞는지로 고릅니다 — 설치할 주소, 보려는 TV 채널, 묶을 휴대폰 회선 세 가지가 기준입니다",
  },

  /* B. beforeFooter — 스크롤 끝, 전환 직전.
     통화를 짧고 정확하게 만드는 준비물. 읽고 나면 "일 제대로 하네"가 되어야 한다. */
  beforeCall: {
    base: "before-call",
    eyebrow: "상담 전 준비",
    title: ["이 네 가지를 알고 계시면", "통화가 짧아집니다"],
    titleM: ["이 네 가지를 알고", "계시면 통화가", "짧아집니다"],
    sub: ["미리 확인해 두시면 한 번의 통화로 가능한 조건까지 정리해 드릴 수 있습니다."],
    subM: ["미리 확인해 두시면 한 번의 통화로", "가능한 조건까지 정리해 드립니다."],
    cards: [
      {
        n: "1",
        title: "설치할 주소",
        body: ["동·호수까지 알려주시면", "그 주소에 가능한", "회선을 바로 확인합니다"],
        bodyM: ["동·호수까지 알려주시면 그 주소에", "가능한 회선을 바로 확인합니다"],
      },
      {
        n: "2",
        title: "지금 쓰는 통신사",
        body: ["어느 회사인지와", "약정이 언제 끝나는지.", "위약금 기준이 됩니다"],
        bodyM: ["어느 회사인지와 약정이 언제", "끝나는지. 위약금 기준이 됩니다"],
      },
      {
        n: "3",
        title: "원하는 인터넷 속도",
        body: ["쓰시는 기기 수와", "용도를 말씀해 주시면", "맞는 속도를 찾습니다"],
        bodyM: ["쓰시는 기기 수와 용도를", "말씀해 주시면 맞는 속도를 찾습니다"],
      },
      {
        n: "4",
        title: "결합할 휴대폰 회선",
        body: ["같이 묶을 회선이", "몇 개인지, 명의가", "누구 앞으로 되어 있는지"],
        bodyM: ["같이 묶을 회선이 몇 개인지,", "명의가 누구 앞으로 되어 있는지"],
      },
    ],
    footer: "모르셔도 상담은 됩니다. 아시는 것만 알려주시면 나머지는 저희가 확인합니다.",
    footerM: ["모르셔도 상담은 됩니다. 아시는 것만", "알려주시면 나머지는 저희가 확인합니다."],
    alt: "상담 전에 알고 계시면 통화가 짧아지는 네 가지 — 설치할 주소, 지금 쓰는 통신사와 약정 남은 기간, 원하는 인터넷 속도, 결합할 휴대폰 회선",
  },

  /* C. afterPromoBand — 히어로 직후. 이 업종의 불신을 정면으로 다루는 자리.
     "하지 않는 일"은 남 얘기가 아니라 우리 약속으로 쓴다 (주어가 우리다).
     세 줄 모두 코드로 실제 지키고 있는 것만 적었다 —
     실시간 현황은 실제 leads 만 마스킹해 노출하고(가짜 시딩 금지),
     연락처는 AES-256-GCM 암호화 + 열람 시 access_logs 기록,
     마케팅 수신 동의는 개인정보 동의와 체크박스를 분리해 받는다. */
  whatWeDo: {
    base: "what-we-do",
    eyebrow: "일하는 방식",
    title: ["하는 일과 하지 않는 일을", "먼저 적어둡니다"],
    titleM: ["하는 일과", "하지 않는 일을", "먼저 적어둡니다"],
    sub: ["이 업종에 대한 불신에는 이유가 있습니다. 그래서 저희가 지키는 선부터 밝힙니다."],
    subM: ["이 업종에 대한 불신에는 이유가", "있습니다. 그래서 저희가 지키는", "선부터 밝힙니다."],
    doHead: "합니다",
    dontHead: "하지 않습니다",
    do: [
      {
        lines: ["KT·SK·LG·스카이라이프 네 곳의", "조건을 같은 기준으로 비교해 드립니다"],
        linesM: ["KT·SK·LG·스카이라이프 네 곳의", "조건을 같은 기준으로 비교합니다"],
      },
      {
        lines: ["요금·약정·설치비를 먼저 말씀드리고", "상담을 시작합니다"],
        linesM: ["요금·약정·설치비를 먼저 말씀드리고", "상담을 시작합니다"],
      },
      {
        lines: ["남겨주신 연락처는 암호화해 보관하고", "열람 기록을 남깁니다"],
        linesM: ["남겨주신 연락처는 암호화해 보관하고", "열람 기록을 남깁니다"],
      },
    ],
    dont: [
      {
        lines: ["지어낸 접수 내역을 실시간인 것처럼", "띄우지 않습니다"],
        linesM: ["지어낸 접수 내역을 실시간인 것처럼", "띄우지 않습니다"],
      },
      {
        lines: ["근거 없는 지원금·보상률을", "숫자로 내걸지 않습니다"],
        linesM: ["근거 없는 지원금·보상률을", "숫자로 내걸지 않습니다"],
      },
      {
        lines: ["동의하지 않으신 마케팅 연락은", "드리지 않습니다"],
        linesM: ["동의하지 않으신 마케팅 연락은", "드리지 않습니다"],
      },
    ],
    footer: "지키지 못할 약속은 적지 않았습니다.",
    footerM: ["지키지 못할 약속은 적지 않았습니다."],
    alt: "태산넷이 하는 일과 하지 않는 일 — KT·SK·LG·스카이라이프 네 곳의 조건을 같은 기준으로 비교하고, 요금·약정·설치비를 먼저 말씀드리고, 연락처는 암호화해 보관합니다. 지어낸 접수 내역을 띄우거나, 근거 없는 지원금을 내걸거나, 동의 없는 마케팅 연락을 하지 않습니다",
  },
};

/* =====================================================================
   조판 헬퍼
   ===================================================================== */



const T = (x, y, s, { size, weight = 400, fill = C.ink, anchor = "start" }) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;

const TL = (arr, x, y, lh, opts) =>
  arr.map((s, i) => T(x, y + i * lh, s, opts)).join("");

/** 머리글 블록 — 초록 막대 / 아이브로우 / 큰 제목 / 보조 문장.
 *  1차(check-three) 와 같은 수직 리듬을 쓴다. */
function header(M, maxW, s, { eyebrow, title, sub }, tag) {
  let svg = `<rect x="${M}" y="${s.accentY}" width="${s.accentW}" height="${s.accentH}" rx="${s.accentH / 2}" fill="${C.brand}"/>`;

  const eyeB = s.accentY + s.accentH + s.eyebrowGap + s.eyebrow;
  fit(`${tag} eyebrow`, eyebrow, s.eyebrow, maxW);
  svg += T(M, eyeB, eyebrow, {
    size: s.eyebrow,
    weight: 700,
    fill: C.brandDark,
  });

  const titleB = eyeB + s.titleGap + s.title;
  title.forEach((t) => fit(`${tag} title`, t, s.title, maxW));
  svg += TL(title, M, titleB, s.titleLh, {
    size: s.title,
    weight: 800,
    fill: C.ink,
  });

  const titleLast = titleB + (title.length - 1) * s.titleLh;
  const subB = titleLast + s.subGap + s.sub;
  sub.forEach((t) => fit(`${tag} sub`, t, s.sub, maxW));
  svg += TL(sub, M, subB, s.subLh, { size: s.sub, weight: 400, fill: C.muted });

  const bottom = subB + (sub.length - 1) * s.subLh + s.sub * 0.32;
  return { svg, bottom };
}

/** 번호 카드. 높이는 본문 줄 수에서 계산한다 (상수로 박으면 글자가 테두리를 넘는다) */
function numCard(x, y, w, c, body, g) {
  const { pad, num, title, bodySize, bodyLh } = g;
  const r = num * 0.58;
  const cx = x + pad + r;
  const cy = y + pad + r;
  const titleB = y + pad + r * 2 + g.titleGap + title;
  const bodyB = titleB + g.bodyGap + bodySize;
  const bodyLast = bodyB + (body.length - 1) * bodyLh;
  const h = Math.round(bodyLast + bodySize * 0.32 + pad - y);
  const inner = w - pad * 2;

  fit(`${g.tag} card-title`, c.title, title, inner);
  body.forEach((t) => fit(`${g.tag} card-body`, t, bodySize, inner));

  const svg = `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(w * 0.055)}"
            fill="${C.white}" stroke="${C.line}" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.brandLight}"/>
      ${T(cx, cy + num * 0.34, c.n, { size: num, weight: 800, fill: C.brandDark, anchor: "middle" })}
      ${T(x + pad, titleB, c.title, { size: title, weight: 800, fill: C.ink })}
      ${TL(body, x + pad, bodyB, bodyLh, { size: bodySize, weight: 400, fill: C.muted })}
    </g>`;
  return { svg, h };
}

/** 체크 표시 — 글리프 폰트에 기대지 않고 패스로 그린다 */
const checkMark = (cx, cy, r, color) =>
  `<path d="M ${cx - r * 0.38} ${cy + r * 0.02} L ${cx - r * 0.09} ${cy + r * 0.31} L ${cx + r * 0.4} ${cy - r * 0.3}"
         fill="none" stroke="${color}" stroke-width="${r * 0.26}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** 가새표 — "하지 않습니다" 쪽 */
const crossMark = (cx, cy, r, color) =>
  `<g stroke="${color}" stroke-width="${r * 0.24}" stroke-linecap="round">
     <line x1="${cx - r * 0.3}" y1="${cy - r * 0.3}" x2="${cx + r * 0.3}" y2="${cy + r * 0.3}"/>
     <line x1="${cx + r * 0.3}" y1="${cy - r * 0.3}" x2="${cx - r * 0.3}" y2="${cy + r * 0.3}"/>
   </g>`;

/** 대조 패널 한 짝. 높이는 항목 줄 수에서 계산한다 */
function panel(x, y, w, kind, heading, items, g) {
  const { pad, head, itemSize, itemLh, itemGap, iconR } = g;
  const isDo = kind === "do";
  const fillBg = isDo ? C.white : C.surface;
  const badgeBg = isDo ? C.brandLight : "#e9eef3";
  const markColor = isDo ? C.brandDark : C.faint;
  const headColor = isDo ? C.brandDark : C.ink;
  const textCol = x + pad + iconR * 2 + g.iconGap;
  const inner = x + w - pad - textCol;

  const headB = y + pad + head;
  fit(`${g.tag} panel-head`, heading, head, w - pad * 2);
  let svg = `
    <rect x="${x}" y="${y}" width="${w}" height="__H__" rx="${Math.round(w * 0.028)}"
          fill="${fillBg}" stroke="${C.line}" stroke-width="2"/>
    <circle cx="${x + pad + head * 0.42}" cy="${headB - head * 0.32}" r="${head * 0.42}" fill="${badgeBg}"/>
    ${isDo ? checkMark(x + pad + head * 0.42, headB - head * 0.32, head * 0.42, markColor) : crossMark(x + pad + head * 0.42, headB - head * 0.32, head * 0.42, markColor)}
    ${T(x + pad + head * 1.06, headB, heading, { size: head, weight: 800, fill: headColor })}`;

  const divY = Math.round(headB + head * 0.52);
  svg += `<line x1="${x + pad}" y1="${divY}" x2="${x + w - pad}" y2="${divY}" stroke="${C.line}" stroke-width="2"/>`;

  let cur = divY + g.afterDiv;
  for (const it of items) {
    const first = cur + itemSize;
    const cy = first - itemSize * 0.34;
    const cxx = x + pad + iconR;
    svg += `<circle cx="${cxx}" cy="${cy}" r="${iconR}" fill="${badgeBg}"/>`;
    svg += isDo
      ? checkMark(cxx, cy, iconR, markColor)
      : crossMark(cxx, cy, iconR, markColor);
    it.forEach((t) => fit(`${g.tag} panel-item`, t, itemSize, inner));
    svg += TL(it, textCol, first, itemLh, {
      size: itemSize,
      weight: 400,
      fill: isDo ? C.ink : C.muted,
    });
    cur = first + (it.length - 1) * itemLh + itemSize * 0.32 + itemGap;
  }

  const h = Math.round(cur - itemGap + pad - y);
  return { svg: svg.replace("__H__", String(h)), h };
}

/* =====================================================================
   치수 — 데스크톱 2240 / 모바일 750
   ===================================================================== */

const HD = {
  accentY: 104,
  accentW: 96,
  accentH: 10,
  eyebrowGap: 30,
  eyebrow: 34,
  titleGap: 16,
  title: 72,
  titleLh: 88,
  subGap: 34,
  sub: 32,
  subLh: 46,
};
const HM = {
  accentY: 72,
  accentW: 76,
  accentH: 9,
  eyebrowGap: 25,
  eyebrow: 28,
  titleGap: 20,
  title: 54,
  titleLh: 68,
  subGap: 20,
  sub: 29,
  subLh: 44,
};

const frame = (W, H, sw) =>
  `<rect width="${W}" height="${H}" fill="${C.white}"/>
   <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${C.line}" stroke-width="${sw}"/>`;

const open = (W, H, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;

/* ── 번호 카드형 (A, B) ───────────────────────────────────────────── */

function cardsDesktop(copy, cols, gap) {
  const W = 2240;
  const M = 110;
  const inner = W - M * 2;
  const cardW = Math.floor((inner - gap * (cols - 1)) / cols);
  const tag = `${copy.base}/D`;

  const h = header(M, inner, HD, copy, tag);
  const cardY = Math.round(h.bottom + 60);
  const g = {
    pad: 48,
    num: cols === 4 ? 46 : 52,
    titleGap: 22,
    title: cols === 4 ? 33 : 38,
    bodyGap: 26,
    bodySize: cols === 4 ? 25 : 27,
    bodyLh: cols === 4 ? 40 : 43,
    tag,
  };

  const built = copy.cards.map((c, i) =>
    numCard(M + i * (cardW + gap), cardY, cardW, c, c.body, g),
  );
  const cardH = Math.max(...built.map((b) => b.h));
  // 모든 카드를 가장 큰 높이에 맞춰 다시 그린다 (한 줄에 선 카드는 키가 같아야 한다)
  const redraw = copy.cards
    .map((c, i) => {
      const b = numCard(M + i * (cardW + gap), cardY, cardW, c, c.body, g);
      return b.svg.replace(
        /height="\d+" rx=/,
        `height="${cardH}" rx=`,
      );
    })
    .join("");

  const footB = cardY + cardH + 72;
  fit(`${tag} footer`, copy.footer, 30, inner);
  const H = Math.round(footB + 30 * 0.32 + 76);

  return open(
    W,
    H,
    frame(W, H, 4) +
      h.svg +
      redraw +
      T(M, footB, copy.footer, { size: 30, weight: 700, fill: C.faint }),
  );
}

function cardsMobile(copy) {
  const W = 750;
  const M = 56;
  const inner = W - M * 2;
  const gap = 22;
  const tag = `${copy.base}/M`;

  const h = header(M, inner, HM, {
    eyebrow: copy.eyebrow,
    title: copy.titleM,
    sub: copy.subM,
  }, tag);

  const g = {
    pad: 42,
    num: 46,
    titleGap: 20,
    title: 33,
    bodyGap: 24,
    bodySize: 25,
    bodyLh: 40,
    tag,
  };

  let y = Math.round(h.bottom + 56);
  let svg = "";
  for (const c of copy.cards) {
    const b = numCard(M, y, inner, c, c.bodyM, g);
    svg += b.svg;
    y += b.h + gap;
  }

  const footB = y - gap + 62;
  copy.footerM.forEach((t) => fit(`${tag} footer`, t, 25, inner));
  const footLast = footB + (copy.footerM.length - 1) * 38;
  const H = Math.round(footLast + 25 * 0.32 + 58);

  return open(
    W,
    H,
    frame(W, H, 3) +
      h.svg +
      svg +
      TL(copy.footerM, M, footB, 38, {
        size: 25,
        weight: 700,
        fill: C.faint,
      }),
  );
}

/* ── 좌우 대조형 (C) ──────────────────────────────────────────────── */

function contrastDesktop(copy) {
  const W = 2240;
  const M = 110;
  const inner = W - M * 2;
  const gap = 56;
  const panelW = Math.floor((inner - gap) / 2);
  const tag = `${copy.base}/D`;

  const h = header(M, inner, HD, copy, tag);
  const y = Math.round(h.bottom + 60);
  const g = {
    pad: 52,
    head: 42,
    itemSize: 28,
    itemLh: 42,
    itemGap: 34,
    iconR: 17,
    iconGap: 22,
    afterDiv: 34,
    tag,
  };

  const a = panel(M, y, panelW, "do", copy.doHead, copy.do.map((d) => d.lines), g);
  const b = panel(M + panelW + gap, y, panelW, "dont", copy.dontHead, copy.dont.map((d) => d.lines), g);
  const ph = Math.max(a.h, b.h);
  const fix = (s) => s.replace(/height="\d+" rx=/, `height="${ph}" rx=`);

  const footB = y + ph + 72;
  fit(`${tag} footer`, copy.footer, 30, inner);
  const H = Math.round(footB + 30 * 0.32 + 76);

  return open(
    W,
    H,
    frame(W, H, 4) +
      h.svg +
      fix(a.svg) +
      fix(b.svg) +
      T(M, footB, copy.footer, { size: 30, weight: 700, fill: C.faint }),
  );
}

function contrastMobile(copy) {
  const W = 750;
  const M = 56;
  const inner = W - M * 2;
  const tag = `${copy.base}/M`;

  const h = header(M, inner, HM, {
    eyebrow: copy.eyebrow,
    title: copy.titleM,
    sub: copy.subM,
  }, tag);

  const g = {
    pad: 40,
    head: 36,
    itemSize: 25,
    itemLh: 38,
    itemGap: 30,
    iconR: 15,
    iconGap: 18,
    afterDiv: 30,
    tag,
  };

  let y = Math.round(h.bottom + 52);
  const a = panel(M, y, inner, "do", copy.doHead, copy.do.map((d) => d.linesM), g);
  y += a.h + 24;
  const b = panel(M, y, inner, "dont", copy.dontHead, copy.dont.map((d) => d.linesM), g);
  y += b.h;

  const footB = y + 62;
  copy.footerM.forEach((t) => fit(`${tag} footer`, t, 25, inner));
  const footLast = footB + (copy.footerM.length - 1) * 38;
  const H = Math.round(footLast + 25 * 0.32 + 58);

  return open(W, H, frame(W, H, 3) + h.svg + a.svg + b.svg +
    TL(copy.footerM, M, footB, 38, { size: 25, weight: 700, fill: C.faint }));
}

/* =====================================================================
   굽기
   ===================================================================== */

const JOBS = [
  [`${COPY.whatWeDo.base}.png`, contrastDesktop(COPY.whatWeDo)],
  [`${COPY.whatWeDo.base}-m.png`, contrastMobile(COPY.whatWeDo)],
  [`${COPY.chooseCriteria.base}.png`, cardsDesktop(COPY.chooseCriteria, 3, 48)],
  [`${COPY.chooseCriteria.base}-m.png`, cardsMobile(COPY.chooseCriteria)],
  [`${COPY.beforeCall.base}.png`, cardsDesktop(COPY.beforeCall, 4, 40)],
  [`${COPY.beforeCall.base}-m.png`, cardsMobile(COPY.beforeCall)],
];

// JOBS 를 만드는 동안 fit 검사가 끝난다. 넘쳤으면 파일을 쓰지 않고 끊는다.
assertFit();

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of JOBS) {
  const info = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(OUT, name));
  console.log(`public/promo/${name}  ${info.width}x${info.height}`);
}

finish();
