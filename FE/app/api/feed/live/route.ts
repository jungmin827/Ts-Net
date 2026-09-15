import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 실시간 신청현황 — 실제 leads만 마스킹한 live_feed 뷰를 읽는다 (CLAUDE.md 규칙 1).
// 60초 캐시. 5건 미만이면 빈 배열을 반환해 프론트가 섹션 자체를 렌더링하지 않게 한다.

export const revalidate = 60;

const MIN_ITEMS = 5;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("live_feed")
      .select("applied_date, carrier, masked_name, status_label, gift_label");

    if (error) {
      console.error("[/api/feed/live] 조회 실패:", error.code, error.message);
      return NextResponse.json({ items: [] });
    }

    const items = data ?? [];
    return NextResponse.json({ items: items.length < MIN_ITEMS ? [] : items });
  } catch {
    // 키 미설정(빌드 시점 포함)·일시 장애 — 섹션 미출력과 동일하게 처리
    return NextResponse.json({ items: [] });
  }
}
