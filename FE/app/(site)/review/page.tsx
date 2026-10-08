import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/sections/PageHero";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardEmpty from "@/components/sections/BoardEmpty";
import BoardSearch from "@/components/sections/BoardSearch";
import ReviewList from "@/components/sections/ReviewList";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import { pageParam, sanitizeQuery, searchField } from "@/lib/board";
import { getReviewPage } from "@/lib/board-data";

// 게시판은 5분 재생성 (CLAUDE.md 코딩 규칙)
export const revalidate = 300;

export const metadata: Metadata = {
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
  const q = sanitizeQuery(sp.q);
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
        />
      </PageHero>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          {items.length === 0 ? (
            <BoardEmpty state={state} noun="후기" />
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

          <p className="mt-10 text-center">
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
