import { NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase/public";

// 실시간 신청현황 — 실제 leads만 마스킹한 live_feed 뷰를 읽는다 (CLAUDE.md 규칙 1).
// 60초 캐시. 5건 미만이면 빈 배열을 반환해 프론트가 명단을 렌더링하지 않게 한다.
//
// ⚠ 예전에는 `createAdminClient()`(service_role)를 썼다. 두 가지가 잘못이었다.
//   1. `live_feed` 는 anon 으로 읽히는 공개 뷰다. 전권 키가 필요 없는데 쥐고 있었다.
//      그래서 `SUPABASE_SERVICE_ROLE_KEY` 가 비어 있는 동안 이 경로가 **항상 실패**했다.
//      데이터가 아무리 쌓여도 현황은 영원히 뜨지 않는다.
//   2. 실패를 **아무 로그 없이** 삼켰다. catch 블록이 비어 있어
//      "키가 없다"와 "접수가 아직 없다"가 구별되지 않았다.
//   접수 파이프라인에서 service_role 을 걷어낸 것과 같은 정리다.

export const revalidate = 60;

const MIN_ITEMS = 5;

/** 프론트가 "비어 있음"의 이유를 구분할 수 있게 상태를 함께 돌려준다 */
type FeedState = "ok" | "tooFew" | "error";

function body(items: unknown[], state: FeedState) {
  return NextResponse.json({ items, state });
}

export async function GET() {
  try {
    const supabase = publicClient();
    if (!supabase) {
      console.error(
        "[/api/feed/live] Supabase anon 키 미설정 — 실시간 현황을 조회할 수 없습니다",
      );
      return body([], "error");
    }

    const { data, error } = await supabase
      .from("live_feed")
      .select("applied_date, carrier, masked_name, status_label, gift_label");

    if (error) {
      console.error("[/api/feed/live] 조회 실패:", error.code, error.message);
      return body([], "error");
    }

    const items = data ?? [];
    // 5건 미만은 **정상 상태**다 — 오류와 구분해서 알린다
    if (items.length < MIN_ITEMS) return body([], "tooFew");
    return body(items, "ok");
  } catch (e) {
    // 조용히 넘어가지 않는다. 이 경로가 죽으면 화면에서는 "접수가 없다"로만 보인다
    console.error(
      "[/api/feed/live] 처리 중 예외:",
      e instanceof Error ? e.message : String(e),
    );
    return body([], "error");
  }
}
