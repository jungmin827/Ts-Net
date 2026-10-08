/**
 * 후기 섹션 미리보기 — **데이터가 없어 한 번도 화면에 뜬 적 없는 경로를 검증한다.**
 *
 * `reviews` 테이블이 비어 있어 `Reviews` 는 지금 `null` 을 반환한다.
 * 섹션이 안 보이는 건 맞는 동작이지만, 그 말은 **값이 들어왔을 때 제대로
 * 그려지는지 아무도 확인하지 못했다**는 뜻이기도 하다. 운영자가 첫 후기를
 * 올리는 순간이 첫 시험이 되어서는 안 된다.
 *
 * 실제 컴포넌트를 가짜 행으로 서버 렌더해 `public/_preview/reviews.html` 로
 * 떨어뜨린다. dev 서버가 같은 출처에서 서빙하므로 실제 CSS 가 적용된다.
 *
 * ⚠ 가짜 후기를 **DB 에 넣지 않는다.** 렌더 함수 입력으로만 쓰고 파일은 검토용이다
 *   (CLAUDE.md 규칙 1 은 화면에 노출되는 가짜 데이터를 금지한다 — 이 파일은
 *    공개 페이지가 아니고, 확인 후 지운다).
 *
 *   node scripts/preview-reviews.mjs       # 생성
 *   node scripts/preview-reviews.mjs --rm  # 삭제
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(FE, "public", "_preview", "reviews.html");
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

const entry = join(FE, `.rv-entry-${process.pid}.tsx`);
const bundle = join(FE, `.rv-bundle-${process.pid}.mjs`);
let render;
try {
  writeFileSync(
    entry,
    `import { renderToStaticMarkup } from "react-dom/server";
import Reviews from "@/components/sections/Reviews";
export const render = (rows) => renderToStaticMarkup(<Reviews reviews={rows} />);
`,
  );
  execSync(
    `npx esbuild ${entry} --bundle --platform=node --format=esm --outfile=${bundle} ` +
      `--external:react --external:react-dom --alias:@=${FE} ` +
      `--alias:next/link=${join(FE, "scripts/_shim-link.tsx")} ` +
      `--alias:next/image=${join(FE, "scripts/_shim-image.tsx")} ` +
      `--alias:next/navigation=${join(FE, "scripts/_shim-navigation.tsx")} --jsx=automatic --log-level=error`,
    { stdio: "inherit", cwd: FE },
  );
  ({ render } = await import(pathToFileURL(bundle).href));
} finally {
  for (const f of [entry, bundle]) if (existsSync(f)) unlinkSync(f);
}

/**
 * 경계값을 일부러 섞는다 — 평점 없음 / 썸네일 없음 / 통신사 없음 / 아주 긴 본문.
 * "잘 되는 경우"만 보면 미리보기가 아무것도 증명하지 못한다.
 */
const ROWS = [
  { id: 1, title: "설치까지 이틀 걸렸습니다", content: "상담에서 들은 금액과 청구서가 같았습니다. 설치 기사님도 시간 맞춰 오셨습니다.", rating: 5, thumbnail_url: null, carrier: "KT", created_at: "2026-10-01T02:00:00Z" },
  { id: 2, title: "평점을 안 남긴 후기", content: "별점 없이 글만 남기는 경우. 별이 하나도 그려지지 않아야 한다(만점으로 둔갑하면 안 된다).", rating: null, thumbnail_url: null, carrier: "SK", created_at: "2026-09-28T05:30:00Z" },
  { id: 3, title: "통신사 정보가 없는 후기", content: "carrier 가 NULL 인 경우. 색 점이나 라벨이 깨지지 않아야 한다.", rating: 4, thumbnail_url: null, carrier: null, created_at: "2026-09-20T11:00:00Z" },
  { id: 4, title: "본문이 아주 긴 후기 — 카드 높이와 줄바꿈이 버티는지 본다", content: "여기부터는 길이 시험입니다. ".repeat(14), rating: 3, thumbnail_url: null, carrier: "LG", created_at: "2026-09-11T23:10:00Z" },
];

const html = render(ROWS);
const css = await devCssHref();
writeFileSync(
  OUT,
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>후기 섹션 미리보기</title><link rel="stylesheet" href="${css}">
<style>body{margin:0;background:#fff}
 .note{font:13px/1.7 system-ui;color:#5b6670;padding:20px 24px;background:#f5f8fa;border-bottom:1px solid #e4eaf0}
 .note b{color:#17191c}</style></head><body>
<p class="note"><b>후기 섹션 미리보기</b> — 실제 <code>Reviews</code> 컴포넌트를 가짜 행 4개로 서버 렌더했습니다.
경계값을 섞었습니다: ① 정상 ② <b>평점 NULL</b>(별이 안 그려져야 함) ③ <b>통신사 NULL</b> ④ <b>아주 긴 본문</b>.
접수 데이터가 아니며 DB 에 넣지 않았습니다. 검토 후 삭제합니다.</p>
${html}
</body></html>`,
);
console.log(`public/_preview/reviews.html 생성 — http://localhost:3100/_preview/reviews.html`);
/**
 * 카드 수를 `<article|<li>` 로 세고 있었는데 Reviews 는 `<div>` 로 그린다 —
 * 4건이 정상 렌더된 상태에서도 **0개**가 찍혔다. 렌더가 진짜로 실패했을 때와
 * 구분이 안 되는 지표라서 통과 신호로 쓸 수 없었다.
 * 목 데이터의 제목이 결과물에 실제로 박혀 있는지로 센다. 제목은 이 스크립트가
 * 넣은 값이라 컴포넌트의 마크업이 바뀌어도 같이 깨지지 않는다.
 */
const rendered = ROWS.filter((r) => html.includes(r.title)).length;
console.log(`렌더 길이 ${html.length}자 · 후기 ${rendered}/${ROWS.length}건`);
if (rendered !== ROWS.length) {
  console.error("✗ 일부 후기가 렌더되지 않았다 — 컴포넌트를 확인할 것");
  process.exitCode = 1;
}
