/**
 * 홍보 이미지 생성기 공용 상수·측정 도구.
 *
 * 왜 뽑아냈는가 —
 *   생성기가 둘(`build-promo-image.mjs` · `build-promo-images-2.mjs`)인데
 *   팔레트와 폰트를 **각자 복제**하고 있었다. 그러다 `faint` 가 어긋났다 —
 *   1차는 옛 `#8e9aa6`(흰 배경 대비 **2.87:1**), 2차는 `#687380`(4.82:1).
 *   그 결과 `check-three` 두 장의 마무리 문장이 본문 기준은커녕 큰 글자 3:1 도
 *   못 넘는 회색으로 찍혔다. **PNG 라 `contrast-audit.js` 에 영원히 안 걸린다** —
 *   화면 DOM 을 훑는 감사기는 이미지 안 픽셀을 보지 못한다.
 *
 *   상수를 한 곳에 두면 같은 어긋남이 다시 생기지 않는다.
 *
 * ⚠ 여기 값은 `FE/app/globals.css` 의 `:root` 토큰과 같아야 한다.
 *   토큰을 바꾸면 여기도 바꾸고 **이미지를 다시 생성**해야 한다
 *   (이미지는 빌드 산출물이 아니라 저장소에 커밋된 파일이다).
 */

/** globals.css :root 와 같은 값 */
export const C = {
  ink: "#17191c",
  muted: "#5b6670",
  /** 흰 배경 4.82:1. 옛 `#8e9aa6` 는 2.87:1 이라 폐기했다 */
  faint: "#687380",
  brand: "#07b040",
  brandDark: "#0a8230",
  brandDeep: "#07521f",
  brandLight: "#dff7e6",
  line: "#e4eaf0",
  surface: "#f5f8fa",
  white: "#ffffff",
};

/**
 * 폰트 스택. 한 이름만 적으면 그 폰트가 없는 기계에서 Pango 가 기본 산세리프로
 * 떨어지고, 글자 폭이 달라져 **레이아웃이 조용히 틀어진다**.
 * 대체 스택을 명시해 어디서 생성해도 비슷한 폭이 나오게 한다.
 */
export const FONT =
  "Apple SD Gothic Neo, Pretendard, Noto Sans KR, Malgun Gothic, sans-serif";

/** XML 특수문자 이스케이프 */
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
  );

/** 글자 폭 추정. SVG 에는 측정 API 가 없어 글리프 종류별 평균폭으로 근사한다 */
export function charW(ch, size) {
  const cp = ch.codePointAt(0);
  if (ch === " ") return size * 0.27;
  if (cp >= 0xac00 && cp <= 0xd7a3) return size * 1.0; // 한글 음절
  if (cp >= 0x3130 && cp <= 0x318f) return size * 1.0; // 한글 자모
  if (cp >= 0x4e00 && cp <= 0x9fff) return size * 1.0; // 한자
  if ("·.,'\"()[]:;!|".includes(ch)) return size * 0.4;
  if ("—–~".includes(ch)) return size * 0.75;
  if (/[A-Z]/.test(ch)) return size * 0.7;
  if (/[a-z0-9]/.test(ch)) return size * 0.58;
  return size * 0.55;
}
export const textW = (s, size) =>
  [...String(s)].reduce((a, c) => a + charW(c, size), 0);

const WARN = [];

/** 상자 폭을 넘는 줄을 잡아낸다. 넘으면 기록 — 줄을 더 끊으라는 신호 */
export function fit(label, s, size, maxW) {
  const w = textW(s, size);
  if (w > maxW) {
    WARN.push(
      `  넘침  ${label}  "${s}"  추정 ${Math.round(w)}px > 허용 ${Math.round(maxW)}px`,
    );
  }
  return w;
}

/**
 * **PNG 를 쓰기 전에** 부른다. 넘침이 있으면 아무것도 쓰지 않고 끝낸다.
 *
 * `finish()` 만 있던 시절의 구멍 — 종료 코드는 1 이 됐지만 그건
 * `toFile()` 루프가 **이미 다 돌고 난 뒤**였다. 잘린 PNG 가 디스크에 남고
 * 종료 코드만 1 이라, 막겠다고 선언한 "잘린 PNG 커밋" 을 정작 못 막았다.
 * SVG 를 다 만든 직후(= fit 호출이 전부 끝난 시점) 여기서 끊는다.
 */
export function assertFit() {
  if (WARN.length === 0) return;
  console.error("\nFIT 실패 — 줄을 더 끊으세요. **파일을 쓰지 않았습니다.**");
  console.error([...new Set(WARN)].join("\n"));
  process.exit(1);
}

/**
 * 생성 끝에 부른다. 여기까지 왔으면 넘침이 없다는 뜻이다.
 * (`assertFit()` 이 앞에서 끊으므로 이 함수는 통과 메시지만 찍는다.)
 */
export function finish() {
  if (WARN.length === 0) {
    console.log("\nFIT 검사 통과 — 상자를 넘는 줄 없음");
    return;
  }
  console.error("\nFIT 실패 — 줄을 더 끊으세요:");
  console.error([...new Set(WARN)].join("\n"));
  process.exitCode = 1;
}
