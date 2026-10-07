/**
 * 6개 대목표 검증 — `node scripts/verify-goals.mjs`
 *
 * 주장이 아니라 **확인된 사실**만 출력한다. 파일시스템·HTTP 응답·렌더된 HTML 을
 * 직접 읽고, 통과/실패와 함께 근거 수치를 적는다. dev 서버가 :3100 에 떠 있어야 한다.
 *
 * 브라우저가 있어야만 잴 수 있는 항목(대비비·색면 면적)은 여기서 재지 않고
 * `scripts/contrast-audit.js` 로 넘긴다 — 잴 수 없는 것을 잰 척하지 않는다.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(FE, "..");
const BASE = "http://localhost:3100";

const results = [];
const check = (goal, label, pass, detail) =>
  results.push({ goal, label, pass, detail });

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const has = (p) => existsSync(join(ROOT, p));

async function http(path, init) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  return { status: res.status, text: await res.text().catch(() => "") };
}
const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

// ── G1 다모아 요금 정합 ────────────────────────────────────────────────
// 2026-10-08 다모아 라이브에서 수집한 **게시 금액 집합** (sub-01~04-test.php).
// 수집 범위: 요금표 셀 + 추천카드 + 각주 할인액 + 요금계산기가 선택에 따라
// 화면에 띄우는 값(인터넷/TV 단독가·휴대폰 정액결합가는 계산기에만 있다).
// 다모아가 게시하지 않는 금액이 우리 화면에 뜨면 여기서 걸린다 — 범위를 좁히지 말 것.
// 구분자 오타(`36.300`)가 원문에 그대로 있어 비교 전에 정규화한다.
// 판정 근거·수집 경로: docs/PRICE_CROSSCHECK_2026-10-08.md
const DAMOA = {
  kt: "5,500 10,670 16,500 22,000 23,100 24,750 27,750 34,100 34,500 34,750 37,500 38,500 39,600 40,000 45,100 49,000 49,500 50,600 53,000 55,000 56,000 56,100 58,850 60,000 60,500",
  sk: "4,400 6,600 8,800 9,900 16,500 19,800 23,100 23,250 24,450 24,750 25,650 25,750 27,750 28,600 28,950 29,250 30,150 30,250 31,900 33,750 34,100 36.300 39,000 39,600 42,900 45,000 46,200 48,400 50,600 51,700 53,900 55,000 56,100 57,650 60,500 60,750 61,950 62,250 62,260 62,700 63,150 63,250 66,750 68,200 89,000",
  lg: "5,500 9,900 13,200 19,800 22,000 23,100 29,600 30,850 31,900 31,950 33,000 33,050 34,100 35,250 38,500 39,600 41,350 41,800 42,450 42,900 43,550 43,750 45,100 45,750 46,200 47,000 48,400 49,500 49,750 52,800 53,750 53,900 57,200 58,300 61,000 61,600 63,750 69,350 85,000",
  skylife:
    "6,050 9,900 11,000 24,200 25,300 30,800 31,900 33,000 34,100 35,200 36,300 37,400 38,500 40,700 41,800 42,900 44,000 46,200 47,300 47,400",
};

async function g1() {
  let mismatch = 0;
  let shown = 0;
  for (const [c, raw] of Object.entries(DAMOA)) {
    const pub = new Set(raw.split(/\s+/).map((v) => v.replace(".", ",")));
    const { text } = await http(`/${c}`);
    // 네 자리(9,900원)와 여섯 자리(100,000원)도 본다.
    // 예전 정규식 `\d{2},\d{3}` 은 다섯 자리만 봤고, 그래서 시드 description 에 있는
    // `9,900원`·`6,050원` 이 화면에 나와도 "불일치 0개"가 찍혔다.
    // G1 은 표시광고 리스크를 막는 유일한 자동 장치라 범위를 좁히면 안 된다.
    const ours = [
      ...new Set(strip(text).match(/(?<![\d,])\d{1,3}(?:,\d{3})+(?=원)/g) ?? []),
    ];
    shown += ours.length;
    mismatch += ours.filter((v) => !pub.has(v)).length;
  }
  check("G1", "표시 금액이 전부 다모아 게시값에 존재", mismatch === 0,
    `표시 ${shown}개 · 불일치 ${mismatch}개`);

  const seed = readdirSync(join(ROOT, "BE/supabase/seed")).find((f) =>
    f.startsWith("plans_damoa_"));
  const rows = seed
    ? (read(`BE/supabase/seed/${seed}`).match(/^ {2}\('/gm) ?? []).length
    : 0;
  check("G1", "다모아 기준 시드 파일", rows === 72, `${seed ?? "없음"} · ${rows}행`);

  // 화면 검사(위)는 dev 서버에 Supabase 키가 없으면 plans 가 렌더되지 않아 시드 값을
  // 전혀 보지 못한다. 그래서 시드 **파일**의 금액도 같은 집합에 대조한다 — DB 가
  // 연결되는 순간 화면에 뜨게 될 값들이다. monthly_fee / list_fee / description 금액 전부.
  let seedBad = [];
  let seedSeen = 0;
  if (seed) {
    const pubOf = Object.fromEntries(
      Object.entries(DAMOA).map(([c, raw]) => [
        c.toUpperCase(),
        new Set(raw.split(/\s+/).map((v) => v.replace(".", ","))),
      ]),
    );
    const won = (n) => Number(n).toLocaleString("en-US");
    for (const line of read(`BE/supabase/seed/${seed}`).split("\n")) {
      const row = /^ {2}\('(\w+)'/.exec(line);
      if (!row) continue;
      const pub = pubOf[row[1]];
      const fee = /(\d{4,6}|NULL),\s*(\d{4,6}|NULL),\s*36,/.exec(line);
      const vals = [
        ...(fee ? [fee[1], fee[2]].filter((v) => v !== "NULL").map(won) : []),
        ...(line.match(/월 [\d,]+원/g) ?? []).map((m) => m.slice(2, -1)),
      ];
      seedSeen += vals.length;
      for (const v of vals) if (!pub.has(v)) seedBad.push(`${row[1]} ${v}`);
    }
  }
  check("G1", "시드 금액이 전부 다모아 게시값에 존재", seed && seedBad.length === 0,
    `검사 ${seedSeen}개 · 불일치 ${seedBad.length}개${seedBad.length ? ` (${seedBad.slice(0, 5).join(", ")})` : ""}`);

  const old = read("BE/supabase/seed/plans_2026-09-28.sql");
  check("G1", "구 시드의 레퍼런스 카피 제거", !/'[^']*DPS[^']*'/.test(old),
    "폐기 배너 + description NULL 처리");
}

// ── G2 레퍼런스 수준 UI ────────────────────────────────────────────────
async function g2() {
  const { text } = await http("/");
  const sections = (text.match(/<section/g) ?? []).length;
  check("G2", "메인 섹션 수 (레퍼런스 13)", sections >= 13, `${sections}개`);

  const cues = (text.match(/href="#consult"/g) ?? []).length;
  check("G2", "본문 전환 수단", cues >= 8, `${cues}개`);

  let notices = 0;
  for (const c of ["kt", "sk", "lg", "skylife"]) {
    const r = await http(`/${c}`);
    if (r.status !== 200) {
      check("G2", `/${c} 응답`, false, `HTTP ${r.status}`);
      return;
    }
    notices += (r.text.match(/<details/g) ?? []).length;
  }
  check("G2", "상세페이지 아코디언(4사 합계)", notices >= 30, `${notices}개`);
  check("G2", "미등록 slug 404", (await http("/nope")).status === 404, "");

  const css = read("FE/app/globals.css");
  check("G2", "전환 기본 이징 통일", css.includes("--default-transition-timing-function"),
    "cubic-bezier(0.22,1,0.36,1)");
}

// ── G3 어드민 엑셀 내보내기 ────────────────────────────────────────────
async function g3() {
  for (const [p, want] of [["/admin", 307], ["/admin/leads", 307], ["/admin/login", 200]]) {
    const r = await http(p);
    check("G3", `${p} 가드`, r.status === want, `HTTP ${r.status}`);
  }
  check("G3", "export GET 차단(CSRF)", (await http("/api/admin/export")).status === 405, "405");
  check("G3", "export POST 교차출처 차단",
    (await http("/api/admin/export", { method: "POST", headers: { Origin: "https://evil.example" } })).status === 403, "403");
  check("G3", "export POST 동일출처 인증요구",
    (await http("/api/admin/export", { method: "POST", headers: { Origin: BASE } })).status === 401, "401");
  check("G3", "TOTP 등록 페이지", has("FE/app/(admin)/admin/enroll-2fa/page.tsx"), "aal1 로 진입 가능");
  check("G3", "xlsx 생성기", has("FE/lib/admin/excel.ts"), "exceljs");
  const migs = readdirSync(join(ROOT, "BE/supabase/migrations")).sort();
  // 라벨을 "첫"이라고 적었지만 보는 것은 세 번째 파일이다. 단언은 맞고 말이 틀렸다.
  check("G3", "보안 차단이 004 보다 먼저", migs[2]?.startsWith("003_lock_down"), migs.join(" "));
}

// ── G4 흰색 + 쨍한 녹색 ────────────────────────────────────────────────
function g4() {
  const css = read("FE/app/globals.css");
  const tok = (n) => (css.match(new RegExp(`--${n}:\\s*([^;]+);`)) ?? [])[1]?.trim();
  check("G4", "주조색 쨍한 그린", tok("brand") === "#07b040", tok("brand"));
  check("G4", "CTA 전용 그라데이션", !!tok("cta-from") && !!tok("cta-to"),
    `${tok("cta-from")} → ${tok("cta-to")}`);
  check("G4", "통신사 흰글자용 ink 변형", !!tok("carrier-sk-ink"), tok("carrier-sk-ink"));
  check("G4", "포커스 링 border-radius 제거",
    !/:focus-visible\s*\{[^}]*border-radius/.test(css), "요소 곡률을 따름");
  const brandSoftSections = (
    readdirSync(join(ROOT, "FE/components/sections"))
      .map((f) => read(`FE/components/sections/${f}`))
      .join("\n")
      .match(/<section className="bg-brand-soft/g) ?? []
  ).length;
  check("G4", "대면적 섹션에 브랜드 틴트 없음", brandSoftSections === 0,
    `${brandSoftSections}곳`);
}

// ── G5 홍보 이미지 삽입 구조 ───────────────────────────────────────────
async function g5() {
  const cfg = read("FE/lib/site-config.ts");
  // `PromoSlotName` 의 유니온 멤버를 센다.
  // 예전 판은 `slots + 1` 로 숫자를 틀리게 찍고, `|| used >= 5` 때문에
  // **정의와 삽입이 어긋나도 항상 통과**했다. 과대 표기를 막으려고 만든
  // 스크립트 안에서 과대 표기가 한 번 더 일어나고 있었다.
  const slotBlock = cfg.match(/export type PromoSlotName =[\s\S]*?;/)?.[0] ?? "";
  const slots = (slotBlock.match(/"[A-Za-z]+"/g) ?? []).length;
  const page = read("FE/app/(site)/page.tsx");
  const used = (page.match(/<PromoSlot slot=/g) ?? []).length;
  check("G5", "슬롯 정의 = 삽입 지점", slots > 0 && slots === used, `정의 ${slots} · 삽입 ${used}`);
  check("G5", "빈 슬롯은 섹션 미렌더", read("FE/components/sections/PromoSlot.tsx").includes("return null"), "");
  check("G5", "데스크톱/모바일 소스 분리", cfg.includes("mobileWidth"), "");
  check("G5", "운영자 가이드", has("docs/PROMO_IMAGE_GUIDE.md"), "");

  const { text } = await http("/");
  const rendered = [...new Set(text.match(/promo%2F[a-z0-9-]+\.png/g) ?? [])].length;
  check("G5", "슬롯을 통해 실제 렌더", rendered >= 2, `${rendered}개 소스`);
}

// ── G6 자체 제작 홍보 이미지 ───────────────────────────────────────────
function g6() {
  const files = readdirSync(join(ROOT, "FE/public/promo")).filter((f) => f.endsWith(".png"));
  const pairs = files.filter((f) => !f.endsWith("-m.png"));
  check("G6", "홍보 이미지 (데스크톱+모바일 쌍)", pairs.length >= 4 && files.length === pairs.length * 2,
    `${pairs.length}종 ${files.length}장`);
  check("G6", "재생성 가능한 생성기", has("FE/scripts/build-promo-image.mjs") && has("FE/scripts/build-promo-images-2.mjs"), "");
  const cfg = read("FE/lib/site-config.ts");
  const ids = (cfg.match(/^\s+id: "/gm) ?? []).length;
  check("G6", "설정에 등록", ids >= 4, `${ids}건`);
  const gen = read("FE/scripts/build-promo-image.mjs");
  check("G6", "카드 높이를 내용에서 계산", gen.includes("function cardHeight"), "하드코딩 제거");
}

// ── 라이브 DB 상태 ─────────────────────────────────────────────────────
// 코드가 준비됐다는 것과 **라이브에 반영됐다**는 것은 다르다.
// 이 구간을 분리해 둬야 "파일만 고쳐놓고 완료"라고 적는 착각을 막는다.
// 공개 anon 키로 읽기만 한다 — 쓰기나 파기 함수 호출은 절대 하지 않는다.
async function live() {
  const env = (() => {
    try {
      const t = readFileSync(join(FE, ".env.local"), "utf8");
      const g = (k) => (t.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
      return { url: g("NEXT_PUBLIC_SUPABASE_URL"), key: g("NEXT_PUBLIC_SUPABASE_ANON_KEY") };
    } catch {
      return {};
    }
  })();
  if (!env.url || !env.key) {
    check("LIVE", "Supabase 연결 정보", false, ".env.local 미설정 — 라이브 검증 생략");
    return;
  }

  const rest = async (path) => {
    try {
      const r = await fetch(`${env.url}/rest/v1/${path}`, {
        headers: { apikey: env.key, Prefer: "count=exact", Range: "0-0" },
      });
      return { status: r.status, range: r.headers.get("content-range") };
    } catch (e) {
      return { status: 0, err: String(e) };
    }
  };

  const plans = await rest("plans?select=id");
  const total = plans.range?.split("/")[1];
  check("LIVE", "plans 행 수 (목표 72)", total === "72",
    `${total ?? "조회실패"}행 — 72가 아니면 시드 미적용`);

  const withDesc = await rest("plans?select=id&description=not.is.null");
  const dcount = withDesc.range?.split("/")[1];
  check("LIVE", "레퍼런스 카피 제거 (목표 9)", dcount === "9",
    `description 있는 행 ${dcount ?? "?"}개 — 12면 구 시드 그대로`);

  // 파기 함수가 익명에게 **닫혀 있는지**. 호출하지 않고 OPTIONS 로만 확인한다.
  let rpc = "확인불가";
  try {
    const r = await fetch(`${env.url}/rest/v1/rpc/purge_expired_leads`, {
      method: "OPTIONS",
      headers: { apikey: env.key },
    });
    rpc = String(r.status);
  } catch { /* 네트워크 오류는 확인불가로 둔다 */ }
  check("LIVE", "파기 함수 익명 노출 (003 적용 여부)", rpc === "404",
    `OPTIONS ${rpc} — 404 가 아니면 003 미적용 가능성`);

  const feed = await rest("live_feed?select=masked_name");
  const fcount = feed.range?.split("/")[1];
  check("LIVE", "live_feed 5건 게이트", fcount === "0" || Number(fcount) >= 5,
    `${fcount ?? "?"}건 노출 — 1~4건이면 게이트 미적용`);
}

await g1(); await g2(); await g3(); g4(); await g5(); g6();
await live();

const pad = (s, n) => String(s).padEnd(n);
let codeFail = 0;
let liveFail = 0;
let cur = "";
for (const r of results) {
  if (r.goal !== cur) { cur = r.goal; console.log(`\n[${cur}]`); }
  if (!r.pass) {
    if (r.goal === "LIVE") liveFail++;
    else codeFail++;
  }
  console.log(`  ${r.pass ? "통과" : "실패"}  ${pad(r.label, 34)} ${r.detail}`);
}
const codeTotal = results.filter((r) => r.goal !== "LIVE").length;
const liveTotal = results.length - codeTotal;
console.log(`\n코드 ${codeTotal}개 중 실패 ${codeFail}개 · 라이브 ${liveTotal}개 중 실패 ${liveFail}개`);
if (liveFail) console.log("라이브 실패는 BE/APPLY.md 절차를 실행하면 해소된다 (DB 자격증명 필요).");
process.exit(codeFail ? 1 : 0);
