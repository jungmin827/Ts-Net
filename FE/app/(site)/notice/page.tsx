import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/sections/PageHero";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardEmpty from "@/components/sections/BoardEmpty";
import BoardSearch from "@/components/sections/BoardSearch";
import NoticeList from "@/components/sections/NoticeList";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import { pageParam, parseQuery, searchField } from "@/lib/board";
import { getNoticePage } from "@/lib/board-data";

/*
 * ⚠ 이 라우트는 **동적이다.** `revalidate` 를 적어도 목록 HTML 은 캐시되지
 * 않는다 — `searchParams`(검색어·페이지)를 읽는 페이지는 빌드 시점에
 * 프리렌더할 수 없기 때문이다. 빌드 라우트 표에서 `ƒ (Dynamic)` 으로
 * 찍히고 재생성 주기 칸이 비어 있다(`/` 와 `/[carrier]` 는 `5m`).
 *
 * 그래서 캐시는 **쿼리 단위**로 둔다 (`lib/board-data.ts` 의 `cachedPage`) —
 * 검색 없는 1페이지, 즉 트래픽의 대부분이 거기서 흡수된다.
 * `revalidate` 는 남겨 둔다: 상세(`[id]`)와 주기를 맞추는 선언이고,
 * 데이터 캐시의 기본 수명으로도 쓰인다.
 */
export const revalidate = 300;

/**
 * 검색·페이지 파라미터가 붙은 주소는 **색인하지 않는다.**
 *
 * `?q=KT`, `?q=KT&page=2`, `?field=title&q=…` 는 같은 글 묶음을 가리키는
 * 서로 다른 주소다. 그대로 열어 두면 글 하나가 수십 개 주소로 중복 색인되고,
 * 검색엔진은 그중 아무 것이나 정본으로 고른다 — 1페이지가 아니라
 * "KT 로 검색한 3페이지" 가 대표 주소가 되는 일이 실제로 일어난다.
 * 2페이지 이후도 같은 이유로 막고, canonical 은 전부 목록 첫 페이지로 모은다.
 * (robots.txt 에도 `Disallow: {BASE}?` 를 두었지만, 이미 알려진 주소는
 *  수집 없이 색인될 수 있어 메타로 한 번 더 막는다.)
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = !!sp.q || (!!sp.page && String(sp.page) !== "1");
  return {
    ...metadata,
    alternates: { canonical: BASE },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

const BASE = "/notice";

const metadata: Metadata = {
  title: "정보공유",
  description:
    "인터넷·IPTV 가입 절차와 요금 관련 안내를 정리해 올리는 게시판입니다.",
};

export default async function NoticeListPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    field?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const { term: q, dropped } = parseQuery(sp.q);
  const field = searchField(sp.field);
  const { items, total, pages, current, state } = await getNoticePage({
    page: pageParam(sp.page),
    q,
    field,
  });

  return (
    <main>
      <PageHero
        title="정보공유"
        description="가입 절차·요금·설치 관련 안내를 정리해 올립니다."
      >
        {/* 건수는 **검색 중이 아닐 때만** 여기 적는다. 검색 중에는
            `BoardSearch` 가 "검색 — N건" 으로 말하므로, 위에 전체 건수를
            또 적으면 두 숫자가 서로 다른 것을 가리켜 혼란만 만든다.
            조회에 실패했을 때는 숫자를 아예 쓰지 않는다 — 0 을 적으면
            장애가 "글이 없음" 으로 읽힌다. */}
        {state === "ok" && q === "" && total > 0 && (
          <p className="mt-4 text-sm text-muted">
            전체 <span className="font-bold text-foreground">{total}</span>건
          </p>
        )}
        <BoardSearch
          action="/notice"
          field={field}
          q={q}
          total={total}
          state={state}
          dropped={dropped}
        />
      </PageHero>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          {items.length === 0 ? (
            <BoardEmpty state={state} noun="게시글" search={q} />
          ) : (
            <NoticeList items={items} />
          )}

          <Pagination
            base="/notice"
            current={current}
            pages={pages}
            label="정보공유 목록 페이지"
            params={{ q: q || undefined, field: field === "all" ? undefined : field }}
          />

          <p className="mt-10 text-center">
            <Link
              href="/review"
              className="inline-flex items-center gap-1 text-sm font-bold text-brand-dark hover:underline"
            >
              가입 후기 보기
              <Icon name="arrowRight" size={15} />
            </Link>
          </p>
        </div>
      </section>

      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
