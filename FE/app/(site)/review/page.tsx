import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/sections/PageHero";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardEmpty from "@/components/sections/BoardEmpty";
import BoardSearch from "@/components/sections/BoardSearch";
import ReviewList from "@/components/sections/ReviewList";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import { pageParam, parseQuery, searchField } from "@/lib/board";
import { getReviewPage } from "@/lib/board-data";

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

const BASE = "/review";

const metadata: Metadata = {
  title: "가입 후기",
  description:
    "TS-Net 을 통해 인터넷·IPTV 를 가입하신 분들이 남긴 후기입니다.",
};

export default async function ReviewListPage({
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
  const { items, total, pages, current, state } = await getReviewPage({
    page: pageParam(sp.page),
    q,
    field,
  });

  return (
    <main>
      <PageHero
        title="가입 후기"
        description="가입하신 분들이 직접 남긴 후기입니다. 승인된 글만 공개됩니다."
      >
        {/* 건수는 **실제 조회된 수**만 쓴다. 못 읽었을 때는 숫자를 쓰지 않는다 —
            0 을 "후기 0건" 으로 적으면 장애가 콘텐츠로 읽힌다. */}
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
          action="/review"
          field={field}
          q={q}
          total={total}
          state={state}
          dropped={dropped}
        />
      </PageHero>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          {items.length === 0 ? (
            <BoardEmpty state={state} noun="후기" search={q} />
          ) : (
            <ReviewList items={items} />
          )}

          <Pagination
            base="/review"
            current={current}
            pages={pages}
            label="후기 목록 페이지"
            params={{ q: q || undefined, field: field === "all" ? undefined : field }}
          />

          {/* 작성 버튼은 **목록 위가 아니라 아래**에 둔다.
              레퍼런스(다모아)는 섹션 제목 반대쪽 위에 두는데, 그러면 후기를
              읽기 전에 쓰라고 권하는 배치가 된다. 쓰는 사람은 이미 가입을
              끝낸 사람이고, 읽는 사람이 압도적으로 많다. */}
          <p className="mt-10 text-center">
            <Link
              href="/review/write"
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-brand-dark bg-white px-6 font-bold text-brand-dark transition-colors duration-200 hover:bg-brand-soft"
            >
              <Icon name="chat" size={17} />
              후기 쓰기
            </Link>
          </p>

          <p className="mt-6 text-center">
            <Link
              href="/notice"
              className="inline-flex items-center gap-1 text-sm font-bold text-brand-dark hover:underline"
            >
              정보공유 게시판 보기
              <Icon name="arrowRight" size={15} />
            </Link>
          </p>
        </div>
      </section>

      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
