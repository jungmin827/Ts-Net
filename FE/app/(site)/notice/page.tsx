import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/sections/PageHero";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardEmpty from "@/components/sections/BoardEmpty";
import NoticeList from "@/components/sections/NoticeList";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import { pageParam } from "@/lib/board";
import { getNoticePage } from "@/lib/board-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "정보공유",
  description:
    "인터넷·IPTV 가입 절차와 요금 관련 안내를 정리해 올리는 게시판입니다.",
};

export default async function NoticeListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const { items, total, pages, current, state } = await getNoticePage(
    pageParam(page),
  );

  return (
    <main>
      <PageHero
        title="정보공유"
        description="가입 절차·요금·설치 관련 안내를 정리해 올립니다."
      >
        {state === "ok" && total > 0 && (
          <p className="mt-4 text-sm text-muted">
            전체 <span className="font-bold text-foreground">{total}</span>건
          </p>
        )}
      </PageHero>

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-4">
          {items.length === 0 ? (
            <BoardEmpty state={state} noun="게시글" />
          ) : (
            <NoticeList items={items} />
          )}

          <Pagination
            base="/notice"
            current={current}
            pages={pages}
            label="정보공유 목록 페이지"
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
