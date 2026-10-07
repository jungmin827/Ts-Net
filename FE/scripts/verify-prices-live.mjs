/**
 * 목표 1 — **다모아 라이브를 지금 긁어 우리 시드와 맞댄다.**
 *
 *   node scripts/verify-prices-live.mjs
 *
 * `verify-goals.mjs` 의 G1 과 무엇이 다른가 —
 *   G1 은 2026-10-08 에 수집해 **코드에 박아 둔** `DAMOA` 상수와 비교한다.
 *   그건 "그날 수집한 값과 지금 시드가 맞는가"는 알려주지만,
 *   **다모아가 그 뒤에 값을 바꿨는지**는 알려주지 못한다.
 *   이 스크립트는 매번 라이브를 긁으므로 그 질문에 답한다.
 *
 * 비교 방식 — 양쪽을 **금액 집합**으로 놓고 대조한다.
 *   · 우리 시드에만 있는 금액 = 다모아가 더는 게시하지 않는 값 (요주의)
 *   · 다모아에만 있는 금액 = 우리가 아직 안 넣은 값 (누락 후보)
 *   상품명 1:1 매칭은 하지 않는다 — 다모아가 표기를 바꾸면 매칭이 통째로
 *   깨져 **진짜 금액 불일치가 그 소음에 묻힌다.** 금액 집합이 더 정직하다.
 *
 * 네트워크가 필요하다. 실패하면 그 사실을 명시하고 1 로 끝낸다
 * (조용히 통과시키면 "검증했다"는 거짓 기록이 남는다).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "https://www.xn--t60bv5ao1noylqucs0u.com/page";

/** 다모아 페이지 ↔ 통신사. 수집 당시 확인한 대응 (docs/PRICE_CROSSCHECK_2026-10-08.md) */
const PAGES = [
  ["SK", "sub-01-test.php"],
  ["KT", "sub-02-test.php"],
  ["LG", "sub-03-test.php"],
  ["SKYLIFE", "sub-04-test.php"],
];

/**
 * 교차검증에서 **다모아 쪽 오타로 판정해 버린** 값들.
 * 라이브에는 여전히 있으므로 "라이브에만" 목록에 뜨는데, 누락이 아니라
 * **일부러 안 쓰는 값**이다. 표시해 두지 않으면 다음 사람이 상품이 빠진 줄 안다.
 * 판정 근거: docs/PRICE_CROSSCHECK_2026-10-08.md
 */
const REJECTED = {
  KT: { "56,000": "A — 1G+TV베이직 정가. 55,000 으로 교정(단독가 합·각주 할인과 정합)" },
  SK: {
    "48,400": "B — 500M+이코노미 월요금. 42,900 으로 교정(아래 1G 행 복붙)",
    "50,600": "C — 500M+T스탠다드 월요금. 46,200 으로 교정",
  },
  LG: { "29,600": "E — 100M+실속형 월요금. 39,600 으로 교정(1,100 배수 아님)" },
  SKYLIFE: { "47,400": "G — 1G+플러스 정가. 47,300 으로 교정(단독가 합)" },
};

/** 네 자리 ~ 여섯 자리. 앞에 숫자·콤마가 붙은 토막은 제외한다 */
const MONEY = /(?<![\d,])\d{1,3}(?:,\d{3})+(?=원)/g;

function seedAmounts() {
  const dir = join(ROOT, "BE/supabase/seed");
  const file = readdirSync(dir).find((f) => f.startsWith("plans_damoa_"));
  if (!file) throw new Error("plans_damoa_*.sql 시드를 찾지 못했습니다");
  const by = {};
  for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
    const row = /^ {2}\('(\w+)'/.exec(line);
    if (!row) continue;
    const set = (by[row[1]] ??= new Set());
    // monthly_fee / list_fee
    const fee = /(\d{4,6}|NULL),\s*(\d{4,6}|NULL),\s*36,/.exec(line);
    if (fee)
      for (const v of [fee[1], fee[2]])
        if (v !== "NULL") set.add(Number(v).toLocaleString("en-US"));
    // description 안의 "월 9,900원" 같은 값
    for (const m of line.match(/월 [\d,]+원/g) ?? []) set.add(m.slice(2, -1));
  }
  return { file, by };
}

async function liveAmounts(path) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TSNet-price-check)" },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const html = await res.text();
  const set = new Set();
  // 본문에 보이는 금액
  for (const m of html.match(MONEY) ?? []) set.add(m);
  // 요금계산기 리터럴 (콤마 없이 박혀 있다)
  for (const m of html.match(/\b\d{4,6}\b/g) ?? []) {
    const n = Number(m);
    if (n >= 4000 && n <= 150000) set.add(n.toLocaleString("en-US"));
  }
  // 원문 구분자 오타 정규화 (36.300 → 36,300)
  for (const m of html.match(/(?<![\d.])\d{2}\.\d{3}(?=원)/g) ?? [])
    set.add(m.replace(".", ","));
  return set;
}

const { file, by } = seedAmounts();
console.log(`시드: BE/supabase/seed/${file}`);
console.log(`라이브: ${BASE}/sub-0{1..4}-test.php\n`);

let onlySeedTotal = 0;
let failed = false;
const rows = [];

for (const [carrier, path] of PAGES) {
  let live;
  try {
    live = await liveAmounts(path);
  } catch (e) {
    console.error(`  ${carrier}: 수집 실패 — ${e.message}`);
    failed = true;
    continue;
  }
  const seed = by[carrier] ?? new Set();
  const onlySeed = [...seed].filter((v) => !live.has(v));
  const onlyLive = [...live].filter((v) => !seed.has(v));
  onlySeedTotal += onlySeed.length;
  rows.push({ carrier, seed: seed.size, live: live.size, onlySeed, onlyLive });
}

for (const r of rows) {
  const mark = r.onlySeed.length === 0 ? "통과" : "실패";
  console.log(
    `  ${mark}  ${r.carrier.padEnd(8)} 시드 ${String(r.seed).padStart(3)}개 · 라이브 ${String(r.live).padStart(3)}개 · ` +
      `시드에만 ${r.onlySeed.length}개${r.onlySeed.length ? " → " + r.onlySeed.join(", ") : ""}`,
  );
  const rej = REJECTED[r.carrier] ?? {};
  const deliberate = r.onlyLive.filter((v) => rej[v]);
  const unknown = r.onlyLive.filter((v) => !rej[v]);
  for (const v of deliberate)
    console.log(`        · ${v} 는 **일부러 안 쓴다** — ${rej[v]}`);
  if (unknown.length)
    console.log(
      `        (참고) 라이브에만 ${unknown.length}개 — 우리가 안 쓰는 값이다. ` +
        `상품이 늘었는지 확인: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? " …" : ""}`,
    );
}

console.log();
if (failed) {
  console.error("네트워크 실패가 있어 판정하지 않는다 — 다시 실행할 것.");
  process.exit(1);
}
if (onlySeedTotal > 0) {
  console.error(
    `우리 시드에만 있는 금액 ${onlySeedTotal}개. 다모아가 값을 바꿨거나 우리가 틀렸다.\n` +
      "docs/PRICE_CROSSCHECK_2026-10-08.md 절차대로 재확인할 것.",
  );
  process.exit(1);
}
console.log("시드 금액이 전부 다모아 라이브에 실재한다.");
const stillLive = rows.flatMap((r) =>
  (r.onlyLive ?? []).filter((v) => (REJECTED[r.carrier] ?? {})[v]).map((v) => `${r.carrier} ${v}`),
);
if (stillLive.length)
  console.log(
    `교정해 버린 값 ${stillLive.length}개는 다모아에 그대로 있다 (${stillLive.join(" / ")}) — ` +
      "우리가 오타로 판정한 쪽이다. 판정이 뒤집히면 시드도 되돌릴 것.",
  );
