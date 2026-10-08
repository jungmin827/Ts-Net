import { publicClient } from "@/lib/supabase/public";
import { PAGE_SIZE, paginate, type NoticeRow, type ReviewRow } from "@/lib/board";

/**
 * 게시판 조회. anon key + RLS(`*_public_read`)로만 읽는다 — `is_published`
 * 가 아닌 행은 정책 단계에서 걸러지므로 애플리케이션이 실수로 미승인 글을
 * 노출할 경로가 없다. service_role 은 쓰지 않는다.
 *
 * ── 실패를 어떻게 다루는가 ──────────────────────────────────────
 * 키가 없거나 조회가 실패하면 `state` 로 그 사실을 **그대로 돌려준다.**
 * 빈 배열만 돌려주면 호출부는 "글이 없다" 와 "못 읽었다" 를 구분할 수 없고,
 * 화면에는 "등록된 글이 없습니다" 가 뜬다 — DB 가 죽은 걸 콘텐츠가 없는
 * 것처럼 말하는 건 거짓이다. 실패는 전부 로그에 남긴다.
 */
export type BoardState = "ok" | "unconfigured" | "error";

export interface BoardPage<T> {
  items: T[];
  total: number;
  pages: number;
  current: number;
  state: BoardState;
}

const empty = <T>(state: BoardState, current = 1): BoardPage<T> => ({
  items: [],
  total: 0,
  pages: 1,
  current,
  state,
});

export async function getReviewPage(page: number): Promise<BoardPage<ReviewRow>> {
  const supabase = publicClient();
  if (!supabase) return empty("unconfigured", page);

  // 전체 건수를 먼저 받아 범위를 정한다. `head: true` 로 행은 받지 않는다.
  const { count, error: cErr } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  if (cErr) {
    console.error("[review] 건수 조회 실패:", cErr.code, cErr.message);
    return empty("error", page);
  }

  const total = count ?? 0;
  const p = paginate(total, page);
  if (total === 0) return { items: [], total: 0, pages: 1, current: 1, state: "ok" };

  const { data, error } = await supabase
    .from("reviews")
    .select("id, title, content, rating, thumbnail_url, carrier, view_count, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(p.from, p.to);
  if (error) {
    console.error("[review] 목록 조회 실패:", error.code, error.message);
    return empty("error", page);
  }
  return { items: (data as ReviewRow[]) ?? [], total, pages: p.pages, current: p.current, state: "ok" };
}

export async function getNoticePage(page: number): Promise<BoardPage<NoticeRow>> {
  const supabase = publicClient();
  if (!supabase) return empty("unconfigured", page);

  const { count, error: cErr } = await supabase
    .from("notices")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  if (cErr) {
    console.error("[notice] 건수 조회 실패:", cErr.code, cErr.message);
    return empty("error", page);
  }

  const total = count ?? 0;
  const p = paginate(total, page);
  if (total === 0) return { items: [], total: 0, pages: 1, current: 1, state: "ok" };

  const { data, error } = await supabase
    .from("notices")
    .select("id, title, content, is_pinned, view_count, created_at")
    // 고정글이 먼저, 그 안에서 최신순. 인덱스 `notices_pub_idx` 와 같은 순서다.
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(p.from, p.to);
  if (error) {
    console.error("[notice] 목록 조회 실패:", error.code, error.message);
    return empty("error", page);
  }
  return { items: (data as NoticeRow[]) ?? [], total, pages: p.pages, current: p.current, state: "ok" };
}

/** 상세 1건. 없으면 `null` → 호출부가 `notFound()` 한다 */
export async function getReview(id: number): Promise<ReviewRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("id, title, content, rating, thumbnail_url, carrier, view_count, created_at")
    .eq("is_published", true)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[review] 상세 조회 실패:", error.code, error.message);
  return (data as ReviewRow | null) ?? null;
}

export async function getNotice(id: number): Promise<NoticeRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, content, is_pinned, view_count, created_at")
    .eq("is_published", true)
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[notice] 상세 조회 실패:", error.code, error.message);
  return (data as NoticeRow | null) ?? null;
}

/**
 * 이전글·다음글. **작성일 기준**으로 양옆 1건씩 집는다.
 *
 * `id ± 1` 로 구하면 중간에 미승인·삭제된 글이 있을 때 조용히 건너뛰거나
 * 존재하지 않는 글로 링크가 걸린다. 목록 순서와 같은 축(작성일)으로 구해야
 * "다음글" 이 목록에서 바로 아래 있던 글과 일치한다.
 */
export async function getNeighbors(
  table: "reviews" | "notices",
  createdAt: string,
) {
  const supabase = publicClient();
  if (!supabase) return { prev: null, next: null };
  const base = () =>
    supabase.from(table).select("id, title").eq("is_published", true).limit(1);
  // 목록은 최신순이므로 "이전글"(위쪽)은 **더 새 글**이다
  const [newer, older] = await Promise.all([
    base().gt("created_at", createdAt).order("created_at", { ascending: true }),
    base().lt("created_at", createdAt).order("created_at", { ascending: false }),
  ]);
  if (newer.error) console.error(`[${table}] 이전글 조회 실패:`, newer.error.message);
  if (older.error) console.error(`[${table}] 다음글 조회 실패:`, older.error.message);
  type Neighbor = { id: number; title: string };
  return {
    prev: ((newer.data?.[0] as Neighbor | undefined) ?? null),
    next: ((older.data?.[0] as Neighbor | undefined) ?? null),
  };
}

export { PAGE_SIZE };
