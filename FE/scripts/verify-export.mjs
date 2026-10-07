/**
 * 목표 3 검증 — "버튼으로 설정한 기간 안의 데이터를 엑셀로 내보낸다".
 *
 * 어드민 계정이 없어 브라우저 E2E 는 막혀 있다. 그런데 이 기능의 핵심 두 가지,
 * **기간 프리셋이 실제로 어떤 구간이 되는가**와 **엑셀이 제대로 만들어지는가**는
 * 둘 다 순수 함수라 DB 없이 돌려볼 수 있다. "구현했다"는 주장 대신 실행 결과를 남긴다.
 *
 *   node scripts/verify-export.mjs
 *
 * ⚠ 실제 리드를 쓰지 않는다. 가짜 레코드는 **엑셀 생성기 입력**으로만 쓰고
 *   DB 에 넣지 않는다 (CLAUDE.md 규칙 1 은 화면 노출용 가짜 데이터를 금지한다 —
 *   내보내기 생성기 단위 검증은 그 대상이 아니다).
 */
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  out.push(`  ${ok ? "통과" : "실패"}  ${name.padEnd(34)} ${detail}`);
  if (!ok) failed += 1;
};

// TS 모듈을 쓰기 위해 esbuild 로 한 번 번들한다 (프로젝트에 이미 있다)
// 엔트리는 FE/ 안에 둬야 `@/` 별칭과 상대경로가 풀린다. 끝나면 지운다.
const FE = new URL("..", import.meta.url).pathname;
// 번들도 FE/ 안에 둔다 — tmpdir 에 두면 external 로 뺀 exceljs 를 찾지 못한다
const entry = join(FE, `.export-check-${process.pid}.mjs`);
const srcFile = join(FE, `.export-entry-${process.pid}.ts`);
writeFileSync(
  srcFile,
  `export { resolvePeriod, parseExportFilter, PERIODS } from "@/lib/admin/filters";
export { buildLeadsWorkbook } from "@/lib/admin/excel";
export { buildLeadQuery, LEAD_EXPORT_COLUMNS } from "@/lib/admin/leads";
export { todayKst, kstRangeToUtc } from "@/lib/kst";
`,
);
execSync(
  `npx esbuild ${srcFile} --bundle --platform=node --format=esm --outfile=${entry} --external:exceljs --alias:@=${FE} --log-level=error`,
  { stdio: "inherit", cwd: FE },
);
const m = await import(pathToFileURL(entry).href);
unlinkSync(srcFile);

console.log("[기간 프리셋] 버튼이 실제로 만드는 구간");
const today = m.todayKst();
for (const p of m.PERIODS) {
  if (p === "custom") continue;
  const r = m.resolvePeriod({ period: p });
  const days =
    (Date.parse(r.to + "T00:00:00Z") - Date.parse(r.from + "T00:00:00Z")) /
      86400000 + 1;
  check(`프리셋 ${p}`, r.to === today && r.from <= r.to, `${r.from} ~ ${r.to} (${days}일)`);
}
const custom = m.resolvePeriod({ period: "custom", from: "2026-01-05", to: "2026-02-03" });
check("프리셋 custom", custom.from === "2026-01-05" && custom.to === "2026-02-03",
  `${custom.from} ~ ${custom.to}`);

console.log(out.join("\n")); out.length = 0;

console.log("\n[입력 검증] 조작된 쿼리를 거르는가");
const bad = [
  ["기간 역전", { period: "custom", from: "2026-03-01", to: "2026-01-01" }],
  // 달력에 없는 날. 형식만 보면 통과하는데 Date 가 조용히 다음 달로 민다
  ["윤년 아닌 2/29", { period: "custom", from: "2026-02-01", to: "2026-02-29" }],
  ["2월 31일", { period: "custom", from: "2026-02-01", to: "2026-02-31" }],
  // Invalid Date → kstRangeToUtc 의 toISOString() 이 RangeError 를 던진다
  ["13월", { period: "custom", from: "2026-13-01", to: "2026-13-05" }],
  // Date.UTC 가 연도 0~99 를 1900~1999 로 옮긴다 — 검사와 변환이 어긋나던 자리
  ["0026년", { period: "custom", from: "0026-01-01", to: "0026-12-31" }],
  ["9999년", { period: "custom", from: "9999-01-01", to: "9999-12-31" }],
  ["형식 오류", { period: "custom", from: "2026/03/01", to: "2026-03-02" }],
  ["없는 프리셋", { period: "forever" }],
  ["없는 통신사", { period: "30d", carrier: "EVIL" }],
];
for (const [name, raw] of bad) {
  const r = m.parseExportFilter(raw);
  check(name, !r.success, r.success ? "통과시켜 버림 ⚠" : (r.error.issues[0]?.message ?? "").slice(0, 40));
}
const good = m.parseExportFilter({ period: "7d", carrier: "KT", exported: "no" });
check("정상 입력", good.success, good.success ? "수용" : "거부됨 ⚠");
console.log(out.join("\n")); out.length = 0;

console.log("\n[기간 필터] 버튼이 고른 기간이 실제 쿼리에 실리는가");
// supabase-js 쿼리 빌더는 실행 전에 URL 을 들고 있다. DB 없이 **무엇을 물어볼
// 작정인지**를 그대로 읽을 수 있다 — 기간 필터의 유일한 실체가 이 쿼리다.
{
  const seen = [];
  const fakeBuilder = {
    _p: [],
    select(c, o) { this._p.push(["select", c, JSON.stringify(o ?? null)]); return this; },
    gte(k, v) { this._p.push(["gte", k, v]); return this; },
    lte(k, v) { this._p.push(["lte", k, v]); return this; },
    eq(k, v) { this._p.push(["eq", k, v]); return this; },
    is(k, v) { this._p.push(["is", k, String(v)]); return this; },
    not(k, op, v) { this._p.push(["not", k, `${op}.${v}`]); return this; },
    or(e) { this._p.push(["or", "", e]); return this; },
  };
  const fakeClient = { from(t) { seen.push(t); fakeBuilder._p = []; return fakeBuilder; } };

  const cases = [
    ["today", {}],
    ["custom", { from: "2026-02-01", to: "2026-02-28" }],
    ["30d", { carrier: "KT", exported: "no" }],
  ];
  for (const [period, extra] of cases) {
    const parsed = m.parseExportFilter({ period, ...extra });
    if (!parsed.success) { check(`기간 ${period}`, false, "필터 거부됨"); continue; }
    const range = m.resolvePeriod(parsed.data);
    const q = m.buildLeadQuery(fakeClient, m.LEAD_EXPORT_COLUMNS, parsed.data, range);
    const parts = Object.fromEntries(q._p.map((x) => [x[0] + ":" + x[1], x[2]]));
    const { startIso, endIso } = m.kstRangeToUtc(range.from, range.to);
    const okRange =
      parts["gte:created_at"] === startIso && parts["lte:created_at"] === endIso;
    const detail = `${range.from}~${range.to} → gte ${parts["gte:created_at"]} / lte ${parts["lte:created_at"]}`;
    check(`${period} 구간이 쿼리에`, okRange, detail);
    if (extra.carrier)
      check(`${period} 통신사 조건`, parts["eq:carrier"] === extra.carrier, `eq carrier=${parts["eq:carrier"]}`);
    if (extra.exported === "no")
      check(`${period} 미내보냄 조건`, parts["is:exported_at"] === "null", `is exported_at=${parts["is:exported_at"]}`);
  }
  // KST 경계: 하루를 고르면 UTC 로는 전날 15:00 ~ 당일 14:59:59 여야 한다
  const oneDay = m.resolvePeriod(m.parseExportFilter({ period: "custom", from: "2026-03-10", to: "2026-03-10" }).data);
  const { startIso, endIso } = m.kstRangeToUtc(oneDay.from, oneDay.to);
  check("KST 하루 경계", startIso.startsWith("2026-03-09T15:00") && endIso.startsWith("2026-03-10T14:59"),
    `${startIso} ~ ${endIso}`);
}
console.log(out.join("\n")); out.length = 0;

console.log("\n[엑셀 생성] 실제 파일이 만들어지는가");
const recs = Array.from({ length: 3 }, (_, i) => ({
  id: i + 1,
  created_at: new Date(Date.UTC(2026, 9, 1 + i, 3, 0)).toISOString(),
  name: `검증${i + 1}`,
  phone: `0101234567${i}`,
  carrier: ["KT", "SK", "LG"][i],
  product: "인터넷+TV",
  status: "NEW",
  gift_status: "NONE",
  utm_source: "test",
  utm_medium: null,
  utm_campaign: null,
  memo: null,
}));
const wb = m.buildLeadsWorkbook(recs, { from: "2026-10-01", to: "2026-10-03", exportedBy: "verify@local" });
const ws = wb.worksheets[0];
check("워크시트 생성", wb.worksheets.length >= 1, `${wb.worksheets.length}개 · "${ws?.name}"`);
check("행 수 = 머리 + 데이터", ws.rowCount === recs.length + 1, `${ws.rowCount}행 (데이터 ${recs.length})`);
check("파일 속성에 구간·주체", /2026-10-01 ~ 2026-10-03/.test(wb.description ?? ""), (wb.description ?? "").slice(0, 52));
const header = ws.getRow(1).values.filter(Boolean).map(String);
check("머리글", header.length >= 5, header.join(" | ").slice(0, 70));
const file = join(tmpdir(), `verify-export-${process.pid}.xlsx`);
await wb.xlsx.writeFile(file);
const size = readFileSync(file).length;
const zip = readFileSync(file).subarray(0, 2).toString("binary");
check("xlsx 바이트 출력", size > 3000 && zip === "PK", `${size.toLocaleString()} bytes · 시그니처 ${zip}`);
// 평문 번호가 셀에 들어갔는지 (내보내기의 목적이다)
const phoneHit = ws.getRow(2).values.some((v) => String(v).replace(/-/g, "").includes("01012345670"));
check("평문 연락처가 셀에 들어감", phoneHit, "복호화본이 파일로 나가는 유일한 경로");
unlinkSync(file); unlinkSync(entry);
console.log(out.join("\n"));

console.log(`\n${failed === 0 ? "전부 통과" : `실패 ${failed}건`}`);
process.exit(failed === 0 ? 0 : 1);
