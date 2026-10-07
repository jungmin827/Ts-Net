import { publicClient } from "@/lib/supabase/public";
import Hero from "@/components/sections/Hero";
import PromoSlot from "@/components/sections/PromoSlot";
import ConsultCue from "@/components/sections/ConsultCue";
import PriceCompare from "@/components/sections/PriceCompare";
import PromoBand from "@/components/sections/PromoBand";
import LiveFeed from "@/components/sections/LiveFeed";
import CarrierHub from "@/components/sections/CarrierHub";
import Journey from "@/components/sections/Journey";
import CarrierMatrix from "@/components/sections/CarrierMatrix";
import ConsultGuide from "@/components/sections/ConsultGuide";
import Faq from "@/components/sections/Faq";
import PrivacyPromise from "@/components/sections/PrivacyPromise";
import Reviews, { type ReviewItem } from "@/components/sections/Reviews";

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
      {/* 히어로가 곧 퍼스트뷰 상담폼이다 — `#consult` 앵커도 히어로가 갖는다.
          예전처럼 폼을 아래로 따로 빼면 히어로 CTA → 스크롤 → 폼의 한 단계가 더 붙는다 */}
      <Hero />
      {/* 홍보 이미지 슬롯 — 비어 있으면 아무것도 렌더링되지 않는다 (lib/site-config.ts) */}
      <PromoSlot slot="afterHero" />

      {/* 홍보 밴드 — 퍼스트뷰 직후. 문구는 site-config 설정값 */}
      <PromoBand />
      <PromoSlot slot="afterPromoBand" />

      <LiveFeed />
      <CarrierHub />
      {/* 허브(어디로 갈지)와 집계표(무엇을 고를 수 있는지)는 한 덩어리로 읽힌다 —
          그래서 사이에 면 색을 바꾸지 않는다. 데이터가 2사 미만이면 렌더링되지 않는다 */}
      <CarrierMatrix />
      <ConsultCue>
        마음에 두신 통신사가 있으시면 그 조건으로 바로 확인해 드립니다.
      </ConsultCue>
      <PriceCompare />
      <ConsultCue>
        표시된 금액은 조건에 따라 달라집니다. 어떤 구성이 맞는지 확인해 드립니다.
      </ConsultCue>
      <PromoSlot slot="afterCarrierHub" />
      <Journey />
      <ConsultCue>
        어느 단계든 궁금한 점은 상담 때 먼저 짚어 드립니다.
      </ConsultCue>
      <PromoSlot slot="afterJourney" />
      {/* Journey 가 단계를 말한 직후에 그 통화에서 무엇을 확인하는지 붙인다 */}
      <ConsultGuide />
      <ConsultCue>
        확인하실 항목이 정리되셨다면 연락처만 남겨주세요.
      </ConsultCue>
      <Reviews reviews={reviews} />
      {/* 망설이는 지점을 먼저 풀고(FAQ), 마지막으로 연락처를 어떻게 다루는지
          밝힌 뒤 푸터 상담 CTA 로 넘긴다 */}
      <Faq />
      <ConsultCue>
        찾는 답이 없으면 남겨주세요. 확인해서 알려드립니다.
      </ConsultCue>
      <PrivacyPromise />
      <PromoSlot slot="beforeFooter" />
    </main>
  );
}
