import { publicClient } from "@/lib/supabase/public";
import Hero from "@/components/sections/Hero";
import PromoSlot from "@/components/sections/PromoSlot";
import LiveFeed from "@/components/sections/LiveFeed";
import Reviews, { type ReviewItem } from "@/components/sections/Reviews";

import { SITE } from "@/lib/site-config";
import { siteUrl } from "@/lib/site-url";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/*
 * 구조화 데이터 — 검색엔진에 "이 사이트의 이름은 태산-Net 이고 TS-Net·태산넷도 같은 곳"
 * 이라고 알린다. 구글은 홈의 WebSite.name/alternateName 으로 검색결과의 사이트 이름을
 * 정하고, 네이버도 같은 schema.org 를 읽는다. 정본 주소를 모르면 url 을 쓸 수 없으므로
 * 그때는 내보내지 않는다(`lib/site-url.ts`).
 */
const ORIGIN = siteUrl();
const STRUCTURED_DATA = ORIGIN
  ? {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${ORIGIN}/#website`,
          name: SITE.searchName,
          alternateName: SITE.alternateNames,
          url: `${ORIGIN}/`,
          inLanguage: "ko-KR",
          publisher: { "@id": `${ORIGIN}/#organization` },
        },
        {
          "@type": "Organization",
          "@id": `${ORIGIN}/#organization`,
          name: SITE.business.companyName,
          alternateName: SITE.alternateNames,
          url: `${ORIGIN}/`,
          logo: `${ORIGIN}${SITE.logo.src}`,
          sameAs: SITE.sameAs,
        },
      ],
    }
  : null;

// 메인 랜딩. 레퍼런스(인터넷다모아)와 같은 밀도로 줄였다 —
// 히어로(메인 포스터 + 폼) · 포스터 3장(통신사 · 상담 방식 · 가입 절차) · 후기, 그리고 하단 고정 상담바.
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
      {STRUCTURED_DATA && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {/* 히어로가 곧 퍼스트뷰 상담폼이다 — `#consult` 앵커도 히어로가 갖는다 */}
      <Hero />
      {/* 포스터 3장(통신사 · 상담 방식 · 가입 절차) — 목록은 site-config 의 PROMO_IMAGES */}
      <PromoSlot slot="afterHero" />
      <Reviews reviews={reviews} />
      {/* 실제 접수가 5건 이상일 때만 그려진다 (CLAUDE.md 규칙 1) */}
      <LiveFeed />
      <PromoSlot slot="beforeFooter" />
    </main>
  );
}
