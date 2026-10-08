/**
 * 어드민 화면 미리보기 — **자격증명 없이 UI 를 눈으로 확인하기 위한 도구.**
 *
 * 어드민은 Supabase 인증 뒤에 있어서, 키가 없으면 `/admin/leads` 가
 * `/admin/login` 으로 307 되돌려진다. 그러면 "엑셀 내보내기 UI 가 있긴 한가"를
 * 화면으로 증명할 방법이 없다 — 코드가 있다는 말만 남는다.
 *
 * 그래서 실제 컴포넌트(`LeadFilterBar`)를 **가짜 데이터로 서버 렌더**해
 * `public/_preview/admin.html` 로 떨어뜨린다. dev 서버가 그 파일을 그대로
 * 서빙하므로 같은 출처의 실제 CSS 가 적용된 모습 그대로 보인다.
 *
 * ⚠ 리드 데이터를 쓰지 않는다. 표는 **형태만** 보기 위한 고정 문자열이고
 *   DB 에 접근하지 않는다. 실제 접수 건은 한 줄도 들어가지 않는다.
 * ⚠ 산출물은 검토용 임시 파일이다. 확인이 끝나면 지운다
 *   (`.gitignore` 에 넣어 커밋되지 않게 했다).
 *
 *   node scripts/preview-admin.mjs       # 생성
 *   node scripts/preview-admin.mjs --rm  # 삭제
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(FE, "public", "_preview", "admin.html");
// `_preview/` 는 커밋·배포 대상이 아니라 체크아웃에 없다. 쓰기 전에 만든다.
mkdirSync(dirname(OUT), { recursive: true });

/** dev 서버가 지금 쓰는 CSS 경로를 읽어온다.
    해시를 박아 두면 globals.css 를 고친 순간 **옛 파일을 가리켜**
    스타일이 통째로 빠진 화면을 보게 된다 (실제로 한 번 당했다). */
async function devCssHref() {
  try {
    const html = await (await fetch("http://localhost:3100/")).text();
    const m = html.match(/href="(\/_next\/static\/[^"]+\.css[^"]*)"/);
    if (m) return m[1];
  } catch {
    /* dev 서버가 꺼져 있으면 아래 경고로 넘어간다 */
  }
  console.warn("  ⚠ dev 서버에서 CSS 경로를 읽지 못했습니다 — 스타일 없이 생성됩니다");
  return "";
}

if (process.argv.includes("--rm")) {
  if (existsSync(OUT)) unlinkSync(OUT);
  console.log("미리보기 삭제됨");
  process.exit(0);
}

const entryTs = join(FE, `.preview-entry-${process.pid}.tsx`);
const bundle = join(FE, `.preview-bundle-${process.pid}.mjs`);

writeFileSync(
  entryTs,
  `import { renderToStaticMarkup } from "react-dom/server";
import LeadFilterBar from "@/app/(admin)/admin/leads/LeadFilterBar";
import { resolvePeriod, parseLeadFilter } from "@/lib/admin/filters";

export function render(period: string) {
  const filter = parseLeadFilter({ period });
  const range = resolvePeriod(filter);
  return {
    range,
    html: renderToStaticMarkup(
      <LeadFilterBar filter={filter} range={range} exportFields={{ period }} />,
    ),
  };
}
`,
);

let render;
try {
execSync(
  `npx esbuild ${entryTs} --bundle --platform=node --format=esm --outfile=${bundle} ` +
    `--external:react --external:react-dom --alias:@=${FE} ` +
    // next/link 는 노드에서 바로 풀리지 않고, 정적 미리보기에는 평범한 <a> 면 충분하다
    `--alias:next/link=${join(FE, "scripts/_shim-link.tsx")} --jsx=automatic --log-level=error`,
  { stdio: "inherit", cwd: FE },
);

  ({ render } = await import(pathToFileURL(bundle).href));
} finally {
  // 실패해도 반드시 지운다. 한 번 남겼더니 eslint 가 번들을 훑어
  // 경고 144건을 뿜었다 — 임시 파일은 자기가 치워야 한다.
  for (const f of [entryTs, bundle]) if (existsSync(f)) unlinkSync(f);
}

// 기간 프리셋을 눌렀을 때 화면이 어떻게 달라지는지 나란히 보여준다
const cases = ["today", "7d", "30d", "month", "custom"];
const blocks = cases
  .map((p) => {
    const { range, html } = render(p);
    return `<section>
      <h2>기간 버튼 = <code>${p}</code> <small>→ ${range.from} ~ ${range.to}</small></h2>
      ${html}
    </section>`;
  })
  .join("\n");

const css = await devCssHref();
writeFileSync(
  OUT,
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>어드민 상담신청 화면 미리보기</title>
<link rel="stylesheet" href="${css}">
<style>
  body{background:#f5f8fa;margin:0;padding:28px;font-family:system-ui,sans-serif}
  h1{font-size:20px;margin:0 0 6px}
  p.note{color:#5b6670;font-size:13px;margin:0 0 24px;line-height:1.6}
  section{margin-bottom:28px}
  h2{font-size:14px;color:#5b6670;font-weight:700;margin:0 0 8px}
  code{background:#e4eaf0;padding:1px 5px;border-radius:4px}
  small{font-weight:400;color:#687380}
</style></head><body>
<h1>상담신청 — 기간 설정 + 엑셀 내보내기 UI</h1>
<p class="note">
  실제 <code>LeadFilterBar</code> 컴포넌트를 서버 렌더한 결과입니다.
  어드민은 인증 뒤에 있어 자격증명 없이는 화면을 볼 수 없으므로, UI 존재 여부를
  눈으로 확인하기 위한 검토용 파일입니다. <strong>접수 데이터는 한 건도 쓰지 않습니다.</strong>
</p>
${blocks}
</body></html>`,
);

console.log(`public/_preview/admin.html 생성 — http://localhost:3100/_preview/admin.html`);
