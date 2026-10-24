import { publicClient } from "@/lib/supabase/public";
import Hero from "@/components/sections/Hero";
import PromoSlot from "@/components/sections/PromoSlot";
import CarrierHub from "@/components/sections/CarrierHub";
import Promises from "@/components/sections/Promises";
import Journey from "@/components/sections/Journey";
import LiveFeed from "@/components/sections/LiveFeed";
import Reviews, { type ReviewItem } from "@/components/sections/Reviews";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// 메인 랜딩. 레퍼런스(인터넷다모아)와 같은 밀도로 줄였다 —
// 히어로(폼) · 통신사 · 상담 방식 · 가입 절차 · 후기, 그리고 하단 고정 상담바.
// 요금표·계산기는 통신사 상세에 있다. 메인에 다시 올리지 말 것. 후기 반영을 위해 5분 재생성
export const revalidate = 300;

/** 게시 승인된 후기만 anon 키로 조회 (RLS reviews_public_read). 키 미설정·오류 시 섹션 미출력 */
async function getReviews(): Promise<ReviewItem[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("id, title, content, rating, thumbnail_url, carrier, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("[reviews] 조회 실패:", error.code, error.message);
    return [];
  }
  return (data as ReviewItem[]) ?? [];
}

export default async function HomePage() {
  const reviews = await getReviews();

  return (
    <main>
      {/* 히어로가 곧 퍼스트뷰 상담폼이다 — `#consult` 앵커도 히어로가 갖는다 */}
      <Hero />
      <PromoSlot slot="afterHero" />
      <CarrierHub />
      <Promises />
      <Journey />
      <Reviews reviews={reviews} />
      {/* 실제 접수가 5건 이상일 때만 그려진다 (CLAUDE.md 규칙 1) */}
      <LiveFeed />
      <PromoSlot slot="beforeFooter" />
    </main>
  );
}
