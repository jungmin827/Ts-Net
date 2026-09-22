import { publicClient } from "@/lib/supabase/public";
import Hero from "@/components/sections/Hero";
import LiveFeed from "@/components/sections/LiveFeed";
import CarrierHub from "@/components/sections/CarrierHub";
import Benefits from "@/components/sections/Benefits";
import Process from "@/components/sections/Process";
import Reviews, { type ReviewItem } from "@/components/sections/Reviews";
import LeadForm from "@/components/forms/LeadForm";
import SectionHeading from "@/components/ui/SectionHeading";

// 메인 랜딩 — docs/SPEC.md §1.1 섹션 순서. 후기 반영을 위해 5분 재생성
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
      <Hero />

      {/* 인라인 상담폼 — 하단바·히어로 CTA의 앵커 목적지.
          히어로 위로 카드를 끌어올려 두 섹션이 겹치게 하면 깊이가 생긴다 */}
      <section
        id="consult"
        className="relative scroll-mt-24 bg-white pb-16 md:pb-20"
      >
        <div className="mx-auto max-w-xl px-4">
          <div className="-mt-10 rounded-panel border border-line bg-white p-6 shadow-float md:-mt-14 md:p-8">
            <SectionHeading
              eyebrow="상담 신청"
              title="가입 상담 신청"
              description="남겨주신 연락처로 확인 후 순차적으로 연락드립니다"
            />
            <LeadForm variant="full" />
          </div>
        </div>
      </section>

      <LiveFeed />
      <CarrierHub />
      <Benefits />
      <Process />
      <Reviews reviews={reviews} />
    </main>
  );
}
