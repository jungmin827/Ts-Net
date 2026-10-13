/**
 * 게시판 미리보기 — **데이터가 들어온 상태의 목록·상세를 측정 가능하게 만든다.**
 *
 * `/review` `/notice` 는 DB 가 비어 있어 지금 빈 상태만 그린다. 그 화면에
 * 대비·넘침 측정을 돌리면 "위반 0" 이 나오는데, 그건 **아무것도 그리지 않은
 * 화면을 재고 통과라 적는 것**이다. 운영자가 첫 글을 올리는 순간이 첫 시험이
 * 되어서는 안 된다.
 *
 * 실제 `ReviewList` / `NoticeList` / 상세 본문 마크업을 가짜 행으로 서버
 * 렌더해 `public/_preview/board.html` 로 떨어뜨린다. dev 서버가 같은 출처에서
 * 서빙하므로 실제 CSS 가 적용되고, 거기에 대비 감사기를 돌릴 수 있다.
 *
 * ⚠ 가짜 글을 **DB 에 넣지 않는다.** 렌더 입력으로만 쓰고, `_preview/` 는
 *   커밋·배포 대상이 아니다 (`.gitignore` + `prebuild` 가 지운다).
 *
 *   node scripts/preview-board.mjs       # 생성
 *   node scripts/preview-board.mjs --rm  # 삭제
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(FE, "public", "_preview", "board.html");
mkdirSync(dirname(OUT), { recursive: true });

if (process.argv.includes("--rm")) {
  if (existsSync(OUT)) unlinkSync(OUT);
  console.log("미리보기 삭제됨");
  process.exit(0);
}

/** dev 서버가 지금 쓰는 CSS 경로. 해시를 박아 두면 globals.css 수정 후 옛 파일을 가리킨다 */
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

const entry = join(FE, `.bd-entry-${process.pid}.tsx`);
const bundle = join(FE, `.bd-bundle-${process.pid}.mjs`);
let render;
try {
  writeFileSync(
    entry,
    `import { renderToStaticMarkup } from "react-dom/server";
import ReviewList from "@/components/sections/ReviewList";
import NoticeList from "@/components/sections/NoticeList";
import PageHero from "@/components/sections/PageHero";
import BoardNav from "@/components/sections/BoardNav";
import BoardEmpty from "@/components/sections/BoardEmpty";
import Pagination from "@/components/ui/Pagination";
import Stars from "@/components/ui/Stars";
import BoardArticle from "@/components/sections/BoardArticle";
import CarrierBadge from "@/components/ui/CarrierBadge";
import BoardSearch from "@/components/sections/BoardSearch";
import AdminReply from "@/components/sections/AdminReply";
import { formatDate } from "@/lib/board";

/** 상세는 **페이지와 같은 BoardArticle** 을 쓴다. 손으로 베껴 쓴 적이 있고
    그때 통신사 뱃지 클래스를 틀려("bg-kt-ink") 대비 1.00 짜리 거짓 위반을
    만들었다 — 하네스와 제품이 갈라지면 측정이 제품을 말해 주지 않는다. */
function Detail({ row }) {
  return (
    <BoardArticle
      breadcrumb={{ href: "/review", label: "가입 후기" }}
      badge={<CarrierBadge code={row.carrier} label="full" className="mb-3" />}
      title={row.title}
      meta={
        <>
          <Stars rating={row.rating} size={17} />
          <time className="text-sm text-muted">{formatDate(row.created_at, { withTime: true })}</time>
        </>
      }
      content={row.content}
      images={row.images}
      footer={<AdminReply body={row.admin_reply} at={row.admin_reply_at} />}
    />
  );
}

export const render = ({ reviews, notices }) =>
  renderToStaticMarkup(
    <>
      <PageHero title="가입 후기" description="가입하신 분들이 직접 남긴 후기입니다. 승인된 글만 공개됩니다.">
        <p className="mt-4 text-sm text-muted">전체 <span className="font-bold text-foreground">{reviews.length}</span>건</p>
        <BoardSearch action="/review" field="all" q="" total={reviews.length} state="ok" />
      </PageHero>
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <ReviewList items={reviews} />
          <Pagination base="/review" current={2} pages={7} label="후기 목록 페이지" />
        </div>
      </section>
      <PageHero title="정보공유" description="가입 절차·요금·설치 관련 안내를 정리해 올립니다.">
        <BoardSearch action="/notice" field="title" q="설치" total={1} state="ok" />
      </PageHero>
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <NoticeList items={notices} />
          <Pagination base="/notice" current={1} pages={3} label="정보공유 목록 페이지" />
        </div>
      </section>
      <Detail row={reviews[3]} />
      <BoardNav base="/review" listLabel="후기 목록"
        prev={{ id: 9, title: "이전글 제목이 아주 길 때 한 줄로 잘리는지 본다 — 줄바꿈이 생기면 행 높이가 틀어진다" }}
        next={null} />
      <section className="bg-white py-12">
        <div className="mx-auto max-w-4xl px-4 flex flex-col gap-4">
          <BoardEmpty state="ok" noun="후기" />
          <BoardEmpty state="unconfigured" noun="게시글" />
          <BoardEmpty state="error" noun="후기" />
          {/* 검색 0건 — "아직 등록된 후기가 없습니다" 가 떠서는 안 되는 자리 */}
          <BoardEmpty state="ok" noun="후기" search="없는단어" />
          {/* 정리로 검색어가 통째로 날아간 경우 */}
          <BoardSearch action="/review" field="all" q="" total={5} state="ok" dropped />
        </div>
      </section>
    </>,
  );
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

/** 경계값을 섞는다 — "잘 되는 경우"만 보면 미리보기가 아무것도 증명하지 못한다 */
const reviews = [
  { id: 1, title: "설치까지 이틀 걸렸습니다", content: "상담에서 들은 금액과 청구서가 같았습니다.", rating: 5, thumbnail_url: null, carrier: "KT", created_at: "2026-10-01T02:00:00Z" },
  { id: 2, title: "평점을 안 남긴 후기 — 별이 하나도 그려지지 않아야 한다", content: "별점 없이 글만 남기는 경우.", rating: null, thumbnail_url: null, carrier: "SK", created_at: "2026-09-28T05:30:00Z" },
  { id: 3, title: "통신사 정보가 없는 후기", content: "carrier 가 NULL 인 경우. 뱃지 자리가 비어도 카드 높이가 흔들리지 않아야 한다.", rating: 4, thumbnail_url: null, carrier: null, created_at: "2026-09-20T11:00:00Z" },
  { id: 4, admin_reply: "문의하신 설치 지연은 해당 지역 공사 일정 때문이었습니다. 불편을 드려 죄송합니다.\n다음 건부터는 접수 시점에 예상 일정을 함께 안내드리겠습니다.", admin_reply_at: "2026-09-12T04:00:00Z", title: "제목이 아주 길어서 두 줄을 넘어가는 경우 — 카드 격자에서 높이가 서로 맞는지, 그리고 상세에서 줄바꿈이 어떻게 떨어지는지 같이 본다", content: "여기부터는 길이 시험입니다. ".repeat(20), rating: 3, thumbnail_url: null, carrier: "SKYLIFE", created_at: "2026-09-11T23:10:00Z" },
  { id: 5, title: "짧은글", content: "짧다.", rating: 1, thumbnail_url: null, carrier: "LG", created_at: "2026-09-02T00:10:00Z" },
];
/* 홍보 이미지 2장 — 하나는 설명이 있고 하나는 장식(빈 alt)이다. 009 가
   image_urls/image_alts 길이를 묶으므로 실제로도 이 모양으로만 들어온다.
   data URI 를 쓰는 이유는 하네스가 네트워크 없이 돌아야 하기 때문이다. */
const pic = (label, bg) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="420"><rect width="768" height="420" fill="${bg}"/><text x="384" y="215" font-family="sans-serif" font-size="28" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  )}`;
reviews[3].images = [
  { url: pic("설명이 있는 홍보 이미지", "#0a8230"), alt: "10월 KT 인터넷+TV 결합 월 39,600원 안내" },
  { url: pic("장식 이미지 (alt 빈 문자열)", "#6b7280"), alt: "" },
];
const notices = [
  { id: 1, title: "설치 일정 안내 방식이 바뀝니다", content: "접수 후 연락 순서와 설치 일정 확정 절차를 정리했습니다.", is_pinned: true, created_at: "2026-10-05T01:00:00Z" },
  { id: 2, title: "요금표에 표기된 금액의 기준", content: "표시 금액은 약정·결합 조건이 전제됩니다. 조건별 차이를 정리했습니다.", is_pinned: false, created_at: "2026-09-30T04:00:00Z" },
  { id: 3, title: "제목이 길어서 날짜 열과 겹칠 수 있는 경우를 일부러 넣어 둔다 — 모바일에서 날짜가 아래로 내려가는지 본다", content: "본문 발췌가 한 줄로 잘리는지 함께 본다. ".repeat(8), is_pinned: false, created_at: "2026-09-18T07:30:00Z" },
];

const css = await devCssHref();
const html = render({ reviews, notices });
writeFileSync(
  OUT,
  `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>게시판 미리보기 (가짜 데이터)</title>
${css ? `<link rel="stylesheet" href="${css}">` : ""}
</head><body>
<div style="background:#fff3cd;border-bottom:2px solid #856404;padding:10px 16px;font:13px/1.6 system-ui">
  <strong>게시판 미리보기</strong> — 실제 ReviewList / NoticeList / 상세 / BoardNav / 빈상태 3종을
  가짜 행으로 서버 렌더했습니다. <strong>DB 에 넣지 않았고</strong> 공개 라우트가 아닙니다. 검토 후 삭제합니다.
</div>
${html}
</body></html>`,
);
console.log(`public/_preview/board.html 생성 — http://localhost:3100/_preview/board.html`);
const rendered = [...reviews, ...notices].filter((r) => html.includes(r.title)).length;
console.log(`렌더 길이 ${html.length}자 · 글 ${rendered}/${reviews.length + notices.length}건`);
if (rendered !== reviews.length + notices.length) {
  console.error("✗ 일부 글이 렌더되지 않았다 — 컴포넌트를 확인할 것");
  process.exitCode = 1;
}
