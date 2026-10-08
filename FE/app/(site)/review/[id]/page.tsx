import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardNav from "@/components/sections/BoardNav";
import BoardArticle from "@/components/sections/BoardArticle";
import Stars from "@/components/ui/Stars";
import { excerpt, formatDate } from "@/lib/board";
import { getNeighbors, getReview } from "@/lib/board-data";
import { CARRIER_COLOR, carrierByCode } from "@/lib/site-config";

export const revalidate = 300;

type Params = { params: Promise<{ id: string }> };

/** `/review/abc` 처럼 숫자가 아닌 경로는 조회 전에 404 로 끊는다 */
function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const n = parseId(id);
  const review = n ? await getReview(n) : null;
  if (!review) return { title: "후기를 찾을 수 없습니다" };
  return {
    title: review.title,
    // 본문 발췌를 설명으로 쓴다. 한국어는 검색결과에서 약 80자까지 보인다.
    description: excerpt(review.content, 80),
  };
}

export default async function ReviewDetailPage({ params }: Params) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) notFound();

  const review = await getReview(n);
  if (!review) notFound();

  const { prev, next } = await getNeighbors("reviews", review.created_at);
  const carrier = review.carrier ? carrierByCode(review.carrier) : null;

  return (
    <main>
      <BoardArticle
        breadcrumb={{ href: "/review", label: "가입 후기" }}
        badge={
          review.carrier ? (
            <span
              className={`mb-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[review.carrier] ?? "bg-muted"}`}
            >
              {carrier?.label ?? review.carrier}
            </span>
          ) : null
        }
        title={review.title}
        meta={
          <>
            <Stars rating={review.rating} size={17} />
            {/*
              조회수는 **공개 화면에 띄우지 않는다.** anon 키는 RLS 로 쓰기가
              막혀 있어 조회할 때 숫자를 올릴 수 없고, 그러면 모든 글이 영구히
              "조회 0" 으로 보인다. 0 을 보여 주는 건 "아무도 안 읽었다" 는
              틀린 사실을 적는 것이다. 증가 경로가 생기면 그때 켠다.
            */}
            <time dateTime={review.created_at} className="text-sm text-muted">
              {formatDate(review.created_at, { withTime: true })}
            </time>
          </>
        }
        imageUrl={review.thumbnail_url}
        content={review.content}
      />

      <BoardNav base="/review" listLabel="후기 목록" prev={prev} next={next} />
      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
