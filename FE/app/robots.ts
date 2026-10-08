import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * robots.txt
 *
 * 정본 주소를 모르는 동안에는 **전체 수집을 막는다.** 색인은 되돌리는 데
 * 시간이 오래 걸리는 작업이라, "일단 열어 두고 나중에 고치자" 가 가장 비싼
 * 선택이다. 도메인을 연결하고 `NEXT_PUBLIC_SITE_URL` 을 채우면 열린다.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl();

  if (!origin) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // 어드민은 인증으로 막혀 있지만 주소가 색인될 이유가 없다
          "/admin",
          "/api/",
          // 프리뷰 하네스 산출물. `prebuild` 가 지우지만, 지우기 전에
          // 수집되는 경우를 대비해 한 줄 더 막아 둔다
          "/_preview/",
          // 검색 결과 페이지. 같은 글이 수십 개 주소로 중복 색인된다
          "/review?",
          "/notice?",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
