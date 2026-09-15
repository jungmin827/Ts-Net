import { publicClient } from "@/lib/supabase/public";
import Hero from "@/components/sections/Hero";
import LiveFeed from "@/components/sections/LiveFeed";
import CarrierHub from "@/components/sections/CarrierHub";
import Benefits from "@/components/sections/Benefits";
import Process from "@/components/sections/Process";
import Reviews, { type ReviewItem } from "@/components/sections/Reviews";
import LeadForm from "@/components/forms/LeadForm";

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

      {/* 인라인 상담폼 — 하단바·히어로 CTA의 앵커 목적지 */}
      <section id="consult" className="scroll-mt-20 py-16">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">
            가입 상담 신청
          </h2>
          <p className="mb-8 text-center text-sm text-gray-500">
            남겨주신 연락처로 확인 후 순차적으로 연락드립니다
          </p>
          <LeadForm variant="full" />
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
