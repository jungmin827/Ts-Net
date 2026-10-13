/**
 * 게시판 목록 — 정렬·페이지·검색어 해석 검사.
 *
 * ── 왜 따로 있는가 ───────────────────────────────────────────
 * 이 경로의 결함은 전부 **조용하다.** 정렬 타이브레이커가 없으면 페이지
 * 경계에서 글이 중복되거나 사라지는데, 화면은 "15건씩 잘 나온다" 로 보인다.
 * 사라진 글은 아무도 신고하지 못한다. 그래서 눈으로 볼 수 없는 것만 모아
 * 기계로 본다.
 *
 * ── 무엇을 어떻게 보는가 ─────────────────────────────────────
 * 1. `applyListOrder` 에 **가짜 쿼리 빌더**를 넣어 실제로 어떤 정렬 키를
 *    몇 번 호출하는지 기록한다. 손으로 베낀 사본을 검사하지 않는다 —
 *    사본 검사는 이미 한 번 거짓 통과를 만들었다(CarrierBadge 주석).
 * 2. 소스 수준: 목록·이전글 쿼리가 **모두** 그 함수를 지나는지 본다.
 *    정렬 정의가 두 곳으로 갈라지는 순간이 F-04 가 생긴 순간이었다.
 * 3. `pageParam` / `parseQuery` — 주석이 선언한 입력 처리를 실제로 하는지.
 * 4. 타이브레이커가 왜 필요한지 **시뮬레이션**으로 보인다 (JS 정렬이므로
 *    Postgres 의 증명이 아니라 시연이다 — 그 구분을 출력에 적는다).
 * 5. 라이브: 그 정렬·범위 질의를 실제 PostgREST 에 던져 200 을 받는지.
 *    빈 테이블이어도 문법·열 존재는 여기서만 확인된다.
 *
 *   node scripts/verify-board.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(FE, `.vb-entry-${process.pid}.ts`);
const bundle = join(FE, `.vb-bundle-${process.pid}.mjs`);

let mod;
try {
  writeFileSync(
    entry,
    `export { applyListOrder, NEIGHBOR_SCAN } from "@/lib/board-data";
export { pageParam, parseQuery, paginate, PAGE_SIZE } from "@/lib/board";
export { safeLikeTerm, likePattern } from "@/lib/postgrest";
`,
  );
  execSync(
    `npx esbuild ${entry} --bundle --platform=node --format=esm --outfile=${bundle} ` +
      `--alias:@=${FE} ` +
      // `next/cache` 는 Next 런타임 밖에서 해석되지 않는다 (scripts/_shim-cache.ts 주석)
      `--alias:next/cache=${join(FE, "scripts/_shim-cache.ts")} --log-level=error`,
    { stdio: "inherit", cwd: FE },
  );
  mod = await import(pathToFileURL(bundle).href);
} finally {
  for (const f of [entry, bundle]) if (existsSync(f)) unlinkSync(f);
}

const { applyListOrder, NEIGHBOR_SCAN, pageParam, parseQuery, paginate, PAGE_SIZE } = mod;

let fail = 0;
const ok = (name, cond, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) fail += 1;
};

// ── 1. 실제 정렬 키 ────────────────────────────────────────────
/** `.order()` 호출을 기록하는 가짜 빌더. 체이닝을 위해 자기를 돌려준다 */
function recorder() {
  const calls = [];
  const self = {
    calls,
    order: (column, opts) => {
      calls.push(`${column}:${opts?.ascending === false ? "desc" : "asc"}`);
      return self;
    },
  };
  return self;
}

console.log("\n[1] 정렬 키 — 실제 applyListOrder 호출 기록");
const rv = applyListOrder(recorder(), "reviews");
ok(
  "reviews = created_at desc → id desc",
  rv.calls.join(" , ") === "created_at:desc , id:desc",
  rv.calls.join(" , "),
);
const nt = applyListOrder(recorder(), "notices");
ok(
  "notices = is_pinned desc → created_at desc → id desc",
  nt.calls.join(" , ") === "is_pinned:desc , created_at:desc , id:desc",
  nt.calls.join(" , "),
);
ok("두 테이블 모두 마지막 키가 id (유일성)", rv.calls.at(-1) === "id:desc" && nt.calls.at(-1) === "id:desc");

// ── 2. 정렬 정의가 한 곳인가 ───────────────────────────────────
console.log("\n[2] 정렬 정의가 한 곳뿐인가 (소스)");
const src = readFileSync(join(FE, "lib/board-data.ts"), "utf8");
const strip = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const orderCalls = [...strip.matchAll(/\.order\s*\(/g)].length;
ok(
  "`.order(` 는 applyListOrder 안에만 있다",
  orderCalls === 3,
  `${orderCalls}곳 (applyListOrder 내부 3곳이 전부여야 한다)`,
);
/*
 * **구간을 잘라 읽는 모든 쿼리는 정렬이 있어야 한다.**
 *
 * `range()` 든 `limit()` 든 "앞에서 N건" 을 뜻하는데, 정렬이 없으면 그
 * "앞" 이 정의되지 않는다 — Postgres 는 매번 다른 N건을 돌려줄 수 있다.
 * 그래서 개수를 박아 두지 않고 **구간 쿼리 수 = applyListOrder 호출 수**
 * 로 본다. 쿼리를 더하면 이 등식이 깨지므로 같이 정렬을 걸게 된다.
 * (주키 1건 조회는 `.limit(1)` 대신 `.eq("id", …)` 로 쓴다 — 그래야
 *  여기서 정렬을 요구받지 않고, 뜻도 그게 맞다.)
 */
const ranges = [...strip.matchAll(/\.range\s*\(/g)].length;
const limits = [...strip.matchAll(/\.limit\s*\(/g)].length;
// 정의부는 `applyListOrder<T extends …>(` 라 이 패턴에 걸리지 않는다 — 호출만 센다
const listOrderUses = [...strip.matchAll(/applyListOrder\s*\(/g)].length;
ok(
  "구간을 자르는 쿼리 전부가 applyListOrder 를 지난다",
  ranges + limits === listOrderUses,
  `range ${ranges} + limit ${limits} = ${ranges + limits} · applyListOrder ${listOrderUses}`,
);
ok("NEIGHBOR_SCAN 상한이 있다", Number.isInteger(NEIGHBOR_SCAN) && NEIGHBOR_SCAN > 0, String(NEIGHBOR_SCAN));

// ── 3. 입력 해석 ───────────────────────────────────────────────
console.log("\n[3] pageParam — 주석이 적은 대로 떨어지는가");
for (const [input, want] of [
  ["1", 1], ["7", 7], ["abc", 1], ["-1", 1], ["0", 1],
  ["1e9", 1], ["0x10", 1], [" 3 ", 1], ["3.0", 1],
  ["99999999", 10000], [undefined, 1], [["4", "9"], 4],
]) {
  const got = pageParam(input);
  ok(`page=${JSON.stringify(input)} → ${got}`, got === want, got === want ? "" : `기대 ${want}`);
}

console.log("\n[4] parseQuery — 정리로 다 날아간 입력을 구분하는가");
for (const [input, term, dropped] of [
  ["KT 인터넷", "KT 인터넷", false],
  ["...", "", true],
  ["(((", "", true],
  ['"', "", true],
  ["", "", false],
  [undefined, "", false],
  ["   ", "", false],
  ["100% 할인", "100% 할인", false],
]) {
  const got = parseQuery(input);
  const pass = got.term === term && got.dropped === dropped;
  ok(
    `q=${JSON.stringify(input)} → term=${JSON.stringify(got.term)} dropped=${got.dropped}`,
    pass,
    pass ? "" : `기대 term=${JSON.stringify(term)} dropped=${dropped}`,
  );
}

// ── 5. 타이브레이커 시연 ───────────────────────────────────────
console.log("\n[5] 타이브레이커 시연 (JS 정렬 — Postgres 의 증명이 아니라 시연)");
const SAME = "2026-10-01T00:00:00Z";
const rows = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  // 20건을 같은 시각으로 둔다 — 다중행 INSERT 로 들어온 글의 모양이다
  created_at: i < 20 ? SAME : `2026-09-${String(10 + (i % 20)).padStart(2, "0")}T00:00:00Z`,
}));

/** 같은 시각 묶음의 순서를 매 호출마다 뒤섞는다 — 정렬 키가 유일하지 않을 때 DB 가 할 수 있는 일 */
const unstable = (list) =>
  [...list]
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
const stable = (list) =>
  [...list].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id,
  );

const pageThrough = (sorter) => {
  const seen = [];
  const total = rows.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  for (let page = 1; page <= pages; page += 1) {
    const p = paginate(total, page);
    seen.push(...sorter(rows).slice(p.from, p.to + 1).map((r) => r.id));
  }
  return seen;
};

const bad = pageThrough(unstable);
const good = pageThrough(stable);
const dupes = (ids) => ids.length - new Set(ids).size;
const missing = (ids) => rows.filter((r) => !ids.includes(r.id)).length;
ok(
  "타이브레이커 없음 → 중복·누락이 생긴다",
  dupes(bad) > 0 || missing(bad) > 0,
  `중복 ${dupes(bad)}건 · 누락 ${missing(bad)}건`,
);
ok(
  "id desc 추가 → 중복 0 · 누락 0",
  dupes(good) === 0 && missing(good) === 0,
  `중복 ${dupes(good)}건 · 누락 ${missing(good)}건`,
);

// ── 6. 라이브 — 그 질의를 PostgREST 가 받는가 ──────────────────
console.log("\n[6] 라이브 — 실제 정렬·범위 질의 (빈 테이블이어도 문법·열은 확인된다)");
const env = Object.fromEntries(
  readFileSync(join(FE, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  ok("anon 키로 라이브 확인", false, ".env.local 에 URL/anon 키가 없습니다");
} else {
  const hit = async (path) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, Range: "0-14" },
    });
    return { status: res.status, body: (await res.text()).slice(0, 200) };
  };
  const cases = [
    ["reviews 목록 정렬", "reviews?select=id,title&is_published=eq.true&order=created_at.desc,id.desc"],
    ["notices 목록 정렬", "notices?select=id,title&is_published=eq.true&order=is_pinned.desc,created_at.desc,id.desc"],
    ["notices 009 열", "notices?select=id,image_urls,image_alts&limit=1"],
    ["reviews 007 열", "reviews?select=id,admin_reply,admin_reply_at&limit=1"],
  ];
  for (const [name, path] of cases) {
    const r = await hit(path);
    ok(name, r.status === 200 || r.status === 206, `HTTP ${r.status} ${r.status >= 400 ? r.body : ""}`);
  }
}

console.log(
  `\n결과: 실패 ${fail}개\n` +
    (fail === 0
      ? "모든 검사 통과. [5] 는 시연이며, 실제 보장은 `id` 가 정렬 키에 있다는 사실 자체다.\n"
      : ""),
);
process.exit(fail === 0 ? 0 : 1);
