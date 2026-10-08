import { publicClient } from "@/lib/supabase/public";
import {
  PAGE_SIZE,
  paginate,
  type NoticeRow,
  type ReviewRow,
  type SearchField,
} from "@/lib/board";
import { likePattern, type SafeLikeTerm } from "@/lib/postgrest";

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
/**
 * 007 미적용 환경에서도 게시판이 살아 있게 한다.
 *
 * `admin_reply` / `image_urls` 는 007 이 추가하는 열이다. 운영자가 003~006 만
 * 적용하고 007 을 빼먹으면 PostgREST 가 `42703 undefined column` 을 내고,
 * 그대로 두면 목록 전체가 "불러오지 못했습니다" 가 된다 — **답글 하나 때문에
 * 게시판이 통째로 죽는다.** 열이 없으면 그 열만 빼고 다시 조회하고,
 * 어느 마이그레이션이 빠졌는지 로그에 이름으로 찍는다.
 */
const MISSING_COLUMN = "42703";

async function selectWithOptional<T>(
  run: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  full: string,
  fallback: string,
  tag: string,
): Promise<{ rows: T[] | null }> {
  const first = await run(full);
  if (!first.error) return { rows: (first.data as T[]) ?? [] };
  if (first.error.code !== MISSING_COLUMN) {
    console.error(`[${tag}] 조회 실패:`, first.error.code, first.error.message);
    return { rows: null };
  }
  console.error(
    `[${tag}] 007_board_reply_and_images.sql 가 적용되지 않았습니다 — ` +
      `운영자 답글·본문 이미지를 빼고 조회합니다 (${first.error.message})`,
  );
  const retry = await run(fallback);
  if (retry.error) {
    console.error(`[${tag}] 축소 조회도 실패:`, retry.error.code, retry.error.message);
    return { rows: null };
  }
  return { rows: (retry.data as T[]) ?? [] };
}

export type BoardState = "ok" | "unconfigured" | "error";

export interface BoardPage<T> {
  items: T[];
  total: number;
  pages: number;
  current: number;
  state: BoardState;
}

export interface BoardQuery {
  page: number;
  /**
   * 검색어. `SafeLikeTerm` 이라서 **`sanitizeQuery` 를 거치지 않은 값은
   * 타입 단계에서 들어올 수 없다.** 빈 문자열이면 검색하지 않는다.
   */
  q?: SafeLikeTerm;
  field?: SearchField;
}

/**
 * 검색 조건을 쿼리에 얹는다.
 *
 * `.or()` 는 PostgREST 가 **문자열을 파싱**하는 필터 DSL 이다. 그래서 `q` 는
 * 반드시 정리를 거친 값이어야 한다 — 거기서 `,` `(` `)` `.` 처럼 DSL 에서
 * 의미를 갖는 문자를 버리고 LIKE 와일드카드를 이스케이프한다.
 *
 * 한동안 그 전제를 **주석으로만** 적어 뒀는데, 주석은 컴파일되지 않는다.
 * `q` 를 `SafeLikeTerm`(브랜드 타입)으로 받아 정리되지 않은 문자열이
 * 타입 단계에서 막히게 했다.
 */
function applySearch<T extends { or: (f: string) => T; ilike: (c: string, p: string) => T }>(
  query: T,
  q: SafeLikeTerm | undefined,
  field: SearchField | undefined,
): T {
  if (!q) return query;
  // 와일드카드 이스케이프는 **여기서만** 한다. 그 결과를 URL 이나 입력창으로
  // 되돌리면 다음 요청에서 또 정리되어 검색어가 달라진다(postgrest.ts 주석).
  const pattern = likePattern(q);
  if (field === "title") return query.ilike("title", pattern);
  if (field === "content") return query.ilike("content", pattern);
  return query.or(`title.ilike.${pattern},content.ilike.${pattern}`);
}

const empty = <T>(state: BoardState, current = 1): BoardPage<T> => ({
  items: [],
  total: 0,
  pages: 1,
  current,
  state,
});

export async function getReviewPage({
  page,
  q,
  field,
}: BoardQuery): Promise<BoardPage<ReviewRow>> {
  const supabase = publicClient();
  if (!supabase) return empty("unconfigured", page);

  // 전체 건수를 먼저 받아 범위를 정한다. `head: true` 로 행은 받지 않는다.
  // 검색 중이면 **검색 결과의** 건수여야 한다 — 전체 건수로 페이지를 나누면
  // 결과가 3건인데 페이저가 5페이지로 나오고, 2페이지는 빈 화면이 된다.
  const { count, error: cErr } = await applySearch(
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    q,
    field,
  );
  if (cErr) {
    console.error("[review] 건수 조회 실패:", cErr.code, cErr.message);
    return empty("error", page);
  }

  const total = count ?? 0;
  const p = paginate(total, page);
  if (total === 0) return { items: [], total: 0, pages: 1, current: 1, state: "ok" };

  const BASE = "id, title, content, rating, thumbnail_url, carrier, view_count, created_at";
  const { rows } = await selectWithOptional<ReviewRow>(
    (columns) =>
      applySearch(
        supabase.from("reviews").select(columns).eq("is_published", true),
        q,
        field,
      )
        .order("created_at", { ascending: false })
        .range(p.from, p.to),
    `${BASE}, admin_reply, admin_reply_at`,
    BASE,
    "review",
  );
  if (!rows) return empty("error", page);
  return { items: rows, total, pages: p.pages, current: p.current, state: "ok" };
}

export async function getNoticePage({
  page,
  q,
  field,
}: BoardQuery): Promise<BoardPage<NoticeRow>> {
  const supabase = publicClient();
  if (!supabase) return empty("unconfigured", page);

  const { count, error: cErr } = await applySearch(
    supabase
      .from("notices")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true),
    q,
    field,
  );
  if (cErr) {
    console.error("[notice] 건수 조회 실패:", cErr.code, cErr.message);
    return empty("error", page);
  }

  const total = count ?? 0;
  const p = paginate(total, page);
  if (total === 0) return { items: [], total: 0, pages: 1, current: 1, state: "ok" };

  const BASE = "id, title, content, is_pinned, view_count, created_at";
  const { rows } = await selectWithOptional<NoticeRow>(
    (columns) =>
      applySearch(
        supabase.from("notices").select(columns).eq("is_published", true),
        q,
        field,
      )
        // 고정글이 먼저, 그 안에서 최신순. 인덱스 `notices_pub_idx` 와 같은 순서다.
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(p.from, p.to),
    `${BASE}, image_urls`,
    BASE,
    "notice",
  );
  if (!rows) return empty("error", page);
  return { items: rows, total, pages: p.pages, current: p.current, state: "ok" };
}

/** 상세 1건. 없으면 `null` → 호출부가 `notFound()` 한다 */
export async function getReview(id: number): Promise<ReviewRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const BASE = "id, title, content, rating, thumbnail_url, carrier, view_count, created_at";
  const { rows } = await selectWithOptional<ReviewRow>(
    (columns) =>
      supabase.from("reviews").select(columns).eq("is_published", true).eq("id", id),
    `${BASE}, admin_reply, admin_reply_at`,
    BASE,
    "review",
  );
  return rows?.[0] ?? null;
}

export async function getNotice(id: number): Promise<NoticeRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const BASE = "id, title, content, is_pinned, view_count, created_at";
  const { rows } = await selectWithOptional<NoticeRow>(
    (columns) =>
      supabase.from("notices").select(columns).eq("is_published", true).eq("id", id),
    `${BASE}, image_urls`,
    BASE,
    "notice",
  );
  return rows?.[0] ?? null;
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
