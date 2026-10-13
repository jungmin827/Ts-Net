/**
 * **검사를 검사한다.** — G0 세 검사가 "틀린 이유로 통과" 하지 않는지 본다.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────
 * 비평 5라운드의 F-06·F-07·F-08 은 전부 같은 모양이었다: 검사가 **통과하고
 * 있었지만 막겠다고 선언한 것을 막지 못했다.**
 *   · `.or()` 검사는 파일 단위라, 이미 통과한 파일에 정리 안 된 `.or()` 를
 *     하나 더 더하면 영원히 안 걸렸다 (그 두 파일이 검색 코드를 더할 가장
 *     유력한 자리다).
 *   · XSS 검사는 앞뒤 400자 근접으로 면제해서, JSON-LD **옆에** 본문 주입을
 *     쓰면 둘 다 통과했다.
 *   · 링크 검사는 리터럴 경로를 동적 디렉터리로 폴백해서 `/notice/latest`
 *     처럼 **런타임에 404 인 경로**를 "존재하는 라우트" 로 통과시켰다.
 *
 * 통과하는 검사는 아무것도 증명하지 않는다 — **실패할 수 있다는 것까지**
 * 보여야 증명이 된다. 그래서 반례 세 개를 실제 소스 트리에 심고,
 * `verify-goals.mjs` 가 그 셋을 잡아내는지 확인한 뒤 치운다.
 *
 * 반례는 `scripts/fixtures/*.fixture` 에 있다. 확장자를 `.fixture` 로 둔
 * 이유 — `tsc`·`eslint`·Next 빌드가 **일부러 틀린 코드**를 보고 실패하면
 * 안 된다. 심는 순간에만 제 위치·제 확장자가 된다.
 *
 *   node scripts/verify-checks.mjs
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const F = join(FE, "scripts", "fixtures");

/** 반례 → 심을 자리 → 그걸 잡아야 하는 검사 라벨의 일부 */
const CASES = [
  {
    fixture: join(F, "or-unsanitized.ts.fixture"),
    target: join(FE, "lib", "_ce_or.ts"),
    label: ".or()",
    why: "통과한 파일에 정리 없는 .or() 를 하나 더 더한 경우",
  },
  {
    fixture: join(F, "link-missing-route.tsx.fixture"),
    target: join(FE, "components", "_ce_link.tsx"),
    label: "내부 링크",
    why: "/notice/latest — 동적 디렉터리 폴백으로 통과하던 경로",
  },
  {
    fixture: join(F, "xss-next-to-jsonld.tsx.fixture"),
    target: join(FE, "components", "_ce_xss.tsx"),
    label: "HTML 로 꽂는 곳",
    why: "JSON-LD 옆의 본문 주입 — 400자 근접 면제로 통과하던 배치",
  },
];

const cleanup = () => {
  for (const c of CASES) if (existsSync(c.target)) unlinkSync(c.target);
};

let out = "";
try {
  for (const c of CASES) copyFileSync(c.fixture, c.target);
  try {
    out = execFileSync("node", [join(FE, "scripts", "verify-goals.mjs")], {
      cwd: FE,
      encoding: "utf8",
    });
  } catch (e) {
    // 반례를 심었으므로 **실패 종료가 정상이다**
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
} finally {
  cleanup();
}

const lines = out.split("\n");
let fail = 0;
console.log("\n반례를 심고 verify-goals 를 돌린 결과 — 각 검사가 잡아내야 한다\n");
for (const c of CASES) {
  const hit = lines.find((l) => l.includes(c.label) && l.trim().startsWith("실패"));
  const pass = !!hit;
  if (!pass) fail += 1;
  console.log(`  ${pass ? "✓" : "✗"} ${c.label} — ${c.why}`);
  if (pass) console.log(`      ${hit.trim().replace(/\s+/g, " ").slice(0, 110)}`);
}

// 심은 반례가 **치워졌는지**까지 본다. 남으면 다음 사람의 빌드가 깨진다.
const leftover = CASES.filter((c) => existsSync(c.target));
console.log(
  `\n  ${leftover.length === 0 ? "✓" : "✗"} 반례 정리 — ${
    leftover.length === 0 ? "남은 파일 없음" : leftover.map((c) => c.target).join(", ")
  }`,
);
if (leftover.length) fail += 1;

console.log(`\n결과: 실패 ${fail}개 (0 이 아니면 그 검사는 막겠다는 것을 막지 못한다)\n`);
process.exit(fail === 0 ? 0 : 1);
