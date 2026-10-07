/**
 * 대비 감사 스니펫 — 브라우저 DevTools 콘솔에 붙여넣고 실행한다.
 *
 *   1. 검사할 페이지를 연다 (http://localhost:3100/ , /kt , /admin/login ...)
 *   2. 이 파일 전체를 콘솔에 붙여넣는다
 *   3. 위반이 있으면 표로 출력된다. 0건이면 "위반 없음"
 *
 * 왜 정적 검사가 아니라 이 방식인가 —
 * 토큰 조합표를 눈으로 세는 방식으로 19곳을 고쳤는데 그때 5곳을 놓쳤다.
 * 실제로 중요한 건 "어떤 토큰이 위험한가"가 아니라 "그 조합이 **지금 화면 어디에
 * 실제로 쓰이고 있는가**" 다. 배경이 상속·중첩되고 틴트 면 위에서 대비가 또
 * 달라지기 때문에(흰 배경 4.63:1 → 푸터 #f5f8fa 4.34:1), 렌더된 DOM 을 봐야 한다.
 *
 * 판정 기준 (WCAG 2.2 AA)
 *   - 일반 텍스트 4.5:1
 *   - 큰 텍스트(24px 이상, 또는 18.66px 이상 + 700 굵기) 3:1
 *   - 그라데이션 배경 위 텍스트는 건너뛴다 (단색 환산이 불가 — .cta-fill 은 별도 검증됨)
 */
(() => {
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  // 실제로 보이는 배경을 찾아 올라간다. 반투명은 건너뛰고, 그라데이션은 판정 보류.
  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage?.includes("gradient")) return "GRADIENT";
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.85) return c.rgb;
      e = e.parentElement;
    }
    return [255, 255, 255];
  };

  const rows = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    // 자식 엘리먼트가 아니라 **이 엘리먼트가 직접 가진 텍스트**만 본다
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("")
      .trim();
    if (!text) continue;

    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;

    const bg = bgOf(el);
    if (bg === "GRADIENT") continue;
    const fg = parse(cs.color);
    if (!fg) continue;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg.rgb, bg);
    if (cr >= need) continue;

    const key = `${cs.color}|${size}|${el.className}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      글자: text.slice(0, 24),
      색: cs.color,
      크기: `${size}px/${weight}`,
      대비: +cr.toFixed(2),
      필요: need,
      클래스: String(el.className).split(" ").slice(0, 3).join(" "),
    });
  }

  if (rows.length === 0) {
    console.log("%c대비 위반 없음", "color:#0a8230;font-weight:bold");
  } else {
    console.warn(`대비 위반 ${rows.length}건`);
    console.table(rows.sort((a, b) => a.대비 - b.대비));
  }
  return rows;
})();
