import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardNav from "@/components/sections/BoardNav";
import BoardArticle from "@/components/sections/BoardArticle";
import AdminReply from "@/components/sections/AdminReply";
import Stars from "@/components/ui/Stars";
import { excerpt, formatDate } from "@/lib/board";
import CarrierBadge from "@/components/ui/CarrierBadge";
import { getNeighbors, getPublishedIds, getReview } from "@/lib/board-data";
import { reviewImageAlt, reviewImageUrl } from "@/lib/review-images";

export const revalidate = 300;

/**
 * 프리렌더 대상 — **이게 없으면 `revalidate` 가 아무것도 지키지 않는다.**
 *
 * 빌드 라우트 표로 확인한 사실: `generateStaticParams` 가 없던 동안
 * 이 라우트는 `ƒ (Dynamic)` 이고 재생성 주기 칸이 비어 있었다
 * (`/` 와 `/[carrier]` 는 `5m` 으로 찍힌다). "게시판은 5분 재생성" 은
 * 문서에만 있던 말이다.
 *
 * 목록에 없는 id 도 요청 시 렌더된다(`dynamicParams` 기본 `true`) —
 * 500건 상한은 빌드 시간을 묶는 장치이고 접근을 막지 않는다.
 */
export async function generateStaticParams() {
  const ids = await getPublishedIds("reviews");
  return ids.map((id) => ({ id: String(id) }));
}

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
    // canonical 은 페이지마다 적는다 — 루트 레이아웃에 두면 전 페이지가
    // 같은 주소를 정본으로 선언해 자기를 중복으로 떨어뜨린다.
    alternates: { canonical: `/review/${n}` },
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

  const { prev, next } = await getNeighbors("reviews", review.id);

  return (
    <main>
      <BoardArticle
        breadcrumb={{ href: "/review", label: "가입 후기" }}
        badge={
          review.carrier ? (
            <CarrierBadge code={review.carrier} label="full" className="mb-3" />
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
            {review.author && (
              <span className="text-sm font-bold text-foreground">{review.author}</span>
            )}
            <time dateTime={review.created_at} className="text-sm text-muted">
              {formatDate(review.created_at, { withTime: true })}
            </time>
          </>
        }
        /*
          방문자가 올린 사진(최대 3장, 010). 운영자는 승인만 누르므로(011)
          설명이 없는 게 보통이다 — 그때는 자동 문구가 대체 텍스트가 된다.
        */
        images={(review.image_paths ?? []).map((p, i, all) => ({
          url: reviewImageUrl(p),
          alt: reviewImageAlt(review.image_alts, i, all.length),
        }))}
        content={review.content}
        footer={
          <AdminReply body={review.admin_reply} at={review.admin_reply_at} />
        }
      />

      <BoardNav base="/review" listLabel="후기 목록" prev={prev} next={next} />
      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
