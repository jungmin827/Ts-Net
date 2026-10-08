import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";
import { STATIC_ROUTES, siteUrl } from "@/lib/site-url";

/**
 * sitemap.xml
 *
 * 5분마다 다시 만든다 — 게시판이 `revalidate = 300` 이라 사이트맵이 더 오래
 * 묶여 있으면 "글은 있는데 사이트맵엔 없는" 구간이 생긴다.
 */
export const revalidate = 300;

/** 게시판 상세 주소. 키가 없거나 조회가 실패하면 **정적 경로만** 내보낸다 */
async function boardEntries(origin: string): Promise<MetadataRoute.Sitemap> {
  const supabase = publicClient();
  if (!supabase) return [];

  /*
   * 상한을 둔다. 사이트맵 한 파일의 한도는 50,000 URL / 50MB 인데, 그보다
   * 먼저 **빌드 시간과 응답 크기**가 문제가 된다. 글이 그만큼 쌓이면
   * 사이트맵 인덱스로 쪼개야 하므로, 그때 알아차리도록 로그를 남긴다.
   */
  const LIMIT = 5000;

  const [reviews, notices] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("notices")
      .select("id, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  if (reviews.error)
    console.error("[sitemap] 후기 조회 실패:", reviews.error.code, reviews.error.message);
  if (notices.error)
    console.error("[sitemap] 정보공유 조회 실패:", notices.error.code, notices.error.message);

  type Row = { id: number; created_at: string };
  const rows = (data: unknown): Row[] => (data as Row[] | null) ?? [];
  const rv = rows(reviews.data);
  const nt = rows(notices.data);
  if (rv.length >= LIMIT || nt.length >= LIMIT)
    console.error(
      `[sitemap] 상한(${LIMIT})에 도달했습니다 — 사이트맵 인덱스로 분할이 필요합니다`,
    );

  return [
    ...rv.map((r) => ({
      url: `${origin}/review/${r.id}`,
      lastModified: new Date(r.created_at),
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    ...nt.map((n) => ({
      url: `${origin}/notice/${n.id}`,
      lastModified: new Date(n.created_at),
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  /*
   * 정본 주소를 모르면 **빈 사이트맵**을 낸다. 절대 URL 이 필수인 형식이라
   * 상대 경로로 낼 수가 없고, 아무 호스트나 넣으면 틀린 주소를 정본으로
   * 선언하게 된다 (`lib/site-url.ts` 주석 참고). 같은 상태에서 robots 가
   * 전체 수집을 막고 있으므로 빈 사이트맵이 모순을 만들지도 않는다.
   */
  if (!origin) return [];

  const now = new Date();
  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${origin}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...(await boardEntries(origin)),
  ];
}
