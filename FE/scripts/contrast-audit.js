/**
 * 대비 감사기 — DevTools 콘솔에 통째로 붙여넣어 실행한다.
 *
 * 왜 캔버스로 합성하는가 —
 *   이전 판은 `getComputedStyle(el).color` 를 정규식 `[\d.]+` 으로 파싱했다.
 *   Tailwind v4 의 `text-white/95` 는 `oklab(0.999994 0.0000455678 … / 0.95)`
 *   로 계산되므로 그 정규식은 첫 세 숫자를 r,g,b 로 읽어 **거의 검정**으로
 *   오판한다. 그 탓에 통과한 자리를 17건 위반으로 보고했다.
 *   캔버스에 실제로 칠하면 색 공간·알파 합성을 브라우저가 처리해 준다.
 *
 * 배경 판정 —
 *   · 불투명한 배경색을 만날 때까지 부모를 거슬러 올라간다.
 *   · 그라디언트를 만나면 **모든 색 정지점**을 뽑아 가장 나쁜 쪽으로 판정한다.
 *     CTA 버튼처럼 위아래 밝기가 다른 면은 밝은 끝이 기준이 되어야 한다.
 *   · 완전 투명한 정지점은 건너뛴다. 밑줄·형광펜 효과
 *     (`linear-gradient(transparent 62%, #dff7e6 62%)`)의 투명 구간을
 *     검정으로 세면 멀쩡한 글자가 위반으로 잡힌다.
 *
 * 기준 — 본문 4.5:1 / 큰 글씨 3:1 (24px 이상, 또는 18.66px 이상 굵게).
 *   18px 굵은 글씨는 **큰 글씨가 아니다.** 반올림해 통과시키지 말 것.
 */
(() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });

  const px = (bg, fg) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1, 1);
    if (fg) {
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, 1, 1);
    }
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /** 두 다른 바탕 위에 칠해 같은 값이 나오면 불투명 */
  const opaque = (c) => {
    const a = px("rgb(255,0,255)", c);
    const b = px("rgb(0,255,0)", c);
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  };
  /** 완전 투명(알파 0)인가 */
  const transparent = (c) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data[3] === 0;
  };

  const bad = [];
  /** 콘솔에서 바로 집어볼 수 있게 요소 참조는 표와 분리해 둔다 */
  const elements = [];
  for (const el of document.querySelectorAll("body *")) {
    // 자기 자신이 직접 글자를 갖는 요소만 — 컨테이너는 자식이 따로 검사된다
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0)
      continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;

    let n = el;
    let stops = null;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n);
      if (c.backgroundImage && c.backgroundImage !== "none") {
        const m = c.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi);
        const solid = (m ?? []).filter((s) => !transparent(s));
        if (solid.length) {
          stops = solid;
          break;
        }
      }
      if (opaque(c.backgroundColor)) {
        stops = [c.backgroundColor];
        break;
      }
      n = n.parentElement;
    }
    if (!stops) stops = ["rgb(255,255,255)"];

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;

    let worst = Infinity;
    let worstStop = "";
    for (const st of stops) {
      const r = ratio(px(st, cs.color), px(st));
      if (r < worst) {
        worst = r;
        worstStop = st;
      }
    }
    if (worst < need) {
      bad.push({
        ratio: +worst.toFixed(2),
        need,
        size,
        weight,
        bg: worstStop,
        text: el.textContent.trim().slice(0, 40),
      });
      elements.push(el);
    }
  }

  console.log(`대비 위반 ${bad.length}건 (본문 4.5 / 큰 글씨 3)`);
  if (bad.length) {
    console.table(bad);
    console.log("위반 요소들:", elements);
  }
  return { findings: bad, elements };
})();
