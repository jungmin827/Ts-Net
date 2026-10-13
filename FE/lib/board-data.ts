import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import {
  PAGE_SIZE,
  paginate,
  type NoticeRow,
  type ReviewRow,
  type SearchField,
} from "@/lib/board";
import { ilikeTerm, likePattern, orFilter, type SafeLikeTerm } from "@/lib/postgrest";

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
 * 007 미적용 환경에서도 상세가 살아 있게 한다.
 *
 * `admin_reply` / `image_urls` 는 007 이 추가하는 열이다. 운영자가 003~006 만
 * 적용하고 007 을 빼먹으면 PostgREST 가 `42703 undefined column` 을 내고,
 * 그대로 두면 상세가 "불러오지 못했습니다" 가 된다 — **답글 하나 때문에
 * 글이 안 열린다.** 열이 없으면 그 열만 빼고 다시 조회하고, 어느
 * 마이그레이션이 빠졌는지 로그에 이름으로 찍는다.
 *
 * **목록은 이 경로를 쓰지 않는다.** 목록은 007 열을 한 개도 그리지 않으므로
 * 아예 요청하지 않는다 — 요청하면 007 미적용 환경에서 목록을 열 때마다
 * 왕복이 두 번 일어나고 에러 로그가 한 줄씩 쌓인다. 쓰지 않는 열 때문에.
 */
const MISSING_COLUMN = "42703";

/** 받아 볼 열 묶음 하나. `missing` 은 이 묶음이 거부당했을 때 로그에 적을 이름 */
interface ColumnAttempt {
  columns: string;
  missing?: string;
}

/**
 * 열 묶음을 **넓은 것부터** 시도한다. `42703` 이면 다음(좁은) 묶음으로 내려간다.
 *
 * 묶음이 둘이 아니라 목록인 이유 — 선택 열을 더하는 마이그레이션이 007 하나가
 * 아니게 됐다(009 의 `image_alts`). 쌍으로만 다루면 "009 는 없고 007 은 있는"
 * 중간 상태에서 007 열까지 같이 포기하게 된다. 그러면 운영자가 009 를 빼먹은
 * 대가로 **본문 이미지 전체가 사라진다** — 고치려는 것보다 큰 손실이다.
 */
async function selectWithOptional<T>(
  run: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  attempts: ColumnAttempt[],
  tag: string,
): Promise<{ rows: T[] | null }> {
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    const res = await run(attempt.columns);
    if (!res.error) return { rows: (res.data as T[]) ?? [] };

    const isLast = i === attempts.length - 1;
    if (res.error.code !== MISSING_COLUMN || isLast) {
      console.error(`[${tag}] 조회 실패:`, res.error.code, res.error.message);
      return { rows: null };
    }
    console.error(
      `[${tag}] ${attempt.missing ?? "선택 열"} 이(가) 적용되지 않았습니다 — ` +
        `그 열을 빼고 다시 조회합니다 (${res.error.message})`,
    );
  }
  return { rows: null };
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
   * 검색어. `SafeLikeTerm` 이라서 **`safeLikeTerm` 을 거치지 않은 값은
   * 타입 단계에서 들어올 수 없다.** 빈 문자열이면 검색하지 않는다.
   *
   * 이 보증은 `.or()` 입구까지 이어진다 — 필터 조립도 `ilikeTerm`/`orFilter`
   * (`SafeFilter`)만 할 수 있어서 중간에 생문자열이 끼어들 자리가 없다.
   */
  q?: SafeLikeTerm;
  field?: SearchField;
}

type BoardTable = "reviews" | "notices";

/**
 * 검색 조건을 쿼리에 얹는다.
 *
 * `.or()` 는 PostgREST 가 **문자열을 파싱**하는 필터 DSL 이다. 그래서 `q` 는
 * 반드시 정리를 거친 값이어야 한다 — 거기서 `,` `(` `)` `.` 처럼 DSL 에서
 * 의미를 갖는 문자를 버리고 LIKE 와일드카드를 이스케이프한다.
 *
 * 한동안 그 전제를 **주석으로만** 적어 뒀는데, 주석은 컴파일되지 않는다.
 * `q` 를 `SafeLikeTerm`(브랜드 타입)으로 받아 정리되지 않은 문자열이
 * 타입 단계에서 막히게 했다. 그 뒤에도 **조립 구간**은 사람이 보는 영역으로
 * 남아 있었는데(템플릿 리터럴), 지금은 `SafeFilter` 가 거기까지 덮는다.
 */
function applySearch<T extends { or: (f: string) => T; ilike: (c: string, p: string) => T }>(
  query: T,
  q: SafeLikeTerm | undefined,
  field: SearchField | undefined,
): T {
  if (!q) return query;
  // 와일드카드 이스케이프는 **여기서만** 한다. 그 결과를 URL 이나 입력창으로
  // 되돌리면 다음 요청에서 또 정리되어 검색어가 달라진다(postgrest.ts 주석).
  if (field === "title") return query.ilike("title", likePattern(q));
  if (field === "content") return query.ilike("content", likePattern(q));
  // 조립을 **여기서 하지 않는다.** 템플릿 리터럴로 이어 붙이던 자리였고,
  // 거기서는 아무 string 이나 들어갈 수 있어 브랜드 타입의 보증이 끝났다.
  // `orFilter` 는 `SafeFilter` 만 받으므로 그 자리가 사라진다.
  return query.or(orFilter(ilikeTerm("title", q), ilikeTerm("content", q)));
}

/**
 * 목록 정렬 — **정의가 여기 한 곳뿐이다.**
 *
 * ── 왜 `id` 까지 거는가 ───────────────────────────────────────
 * `created_at` 만으로는 정렬 키가 **유일하지 않다.** 같은 시각의 행이 둘
 * 있으면(다중행 `INSERT`, 또는 같은 초에 들어온 두 건) Postgres 는 둘의
 * 순서를 보장하지 않는다. `range()` 로 페이지를 자르는 쿼리에서 그건
 * 추상적인 문제가 아니다 — 1페이지와 2페이지가 **서로 다른 정렬**로 뽑히면
 * 같은 글이 두 페이지에 나오거나 어느 페이지에도 안 나온다. 없어진 글은
 * 아무도 신고하지 못한다. 사람이 볼 수 있는 건 "15건씩 잘 나온다" 뿐이다.
 *
 * ── 왜 이전글·다음글과 같은 함수를 쓰는가 ─────────────────────
 * 이전글·다음글은 "목록에서 바로 위/아래 글" 이라는 뜻이다. 그 순서를 두 군데
 * 적으면 한쪽만 고쳐질 수 있고, 그러면 링크가 목록과 다른 글로 간다 —
 * 실제로 정보공유에서 그랬다. 목록은 `is_pinned` 를 보는데 이전글·다음글은
 * 안 봐서, 고정글이 하나라도 있으면 전부 어긋났다.
 */
function applyListOrder<T extends { order: (c: string, o?: { ascending?: boolean }) => T }>(
  query: T,
  table: BoardTable,
): T {
  // 고정글이 먼저, 그 안에서 최신순. 인덱스 `notices_pub_idx` 와 같은 순서다.
  const pinned = table === "notices" ? query.order("is_pinned", { ascending: false }) : query;
  return pinned.order("created_at", { ascending: false }).order("id", { ascending: false });
}

const empty = <T>(state: BoardState, current = 1): BoardPage<T> => ({
  items: [],
  total: 0,
  pages: 1,
  current,
  state,
});

/**
 * 목록이 받는 열 — **화면이 그리는 것만** 받는다.
 *
 * `view_count` 가 네 쿼리 전부에 들어 있었는데 어디서도 그리지 않는다.
 * 공개 화면에 조회수를 띄우지 않기로 했기 때문이다(상세 주석 참고: anon 키는
 * RLS 로 쓰기가 막혀 있어 숫자가 영구히 0 이다). 받아서 버리는 열은 비용보다
 * 오해가 문제다 — 다음 사람이 "조회수를 쓰고 있구나" 로 읽는다.
 */
const REVIEW_LIST_COLUMNS = "id, title, content, rating, thumbnail_url, carrier, created_at";
const NOTICE_LIST_COLUMNS = "id, title, content, is_pinned, created_at";

async function fetchReviewPage({
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

  const { data, error } = await applyListOrder(
    applySearch(
      supabase.from("reviews").select(REVIEW_LIST_COLUMNS).eq("is_published", true),
      q,
      field,
    ),
    "reviews",
  ).range(p.from, p.to);
  if (error) {
    console.error("[review] 목록 조회 실패:", error.code, error.message);
    return empty("error", page);
  }
  return {
    items: (data as ReviewRow[] | null) ?? [],
    total,
    pages: p.pages,
    current: p.current,
    state: "ok",
  };
}

async function fetchNoticePage({
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

  const { data, error } = await applyListOrder(
    applySearch(
      supabase.from("notices").select(NOTICE_LIST_COLUMNS).eq("is_published", true),
      q,
      field,
    ),
    "notices",
  ).range(p.from, p.to);
  if (error) {
    console.error("[notice] 목록 조회 실패:", error.code, error.message);
    return empty("error", page);
  }
  return {
    items: (data as NoticeRow[] | null) ?? [],
    total,
    pages: p.pages,
    current: p.current,
    state: "ok",
  };
}

/**
 * 목록 캐시 — **쿼리 단위**다.
 *
 * ── 왜 페이지 캐시가 아니라 쿼리 캐시인가 ─────────────────────
 * `/review` `/notice` 는 `searchParams` 를 읽으므로 빌드 시점에 프리렌더할
 * 수 없고, 빌드 라우트 표에서 `ƒ (Dynamic)` 으로 찍힌다 — 즉 두 페이지의
 * `revalidate = 300` 이 지키는 HTML 캐시 항목이 **존재하지 않는다.**
 * 방문자 한 명당 Supabase 왕복이 그대로 일어난다(흡수 0).
 *
 * 그래서 HTML 대신 **조회 결과**를 캐시한다. 키에 `page`·`q`·`field` 가
 * 들어가므로 검색 없는 1페이지 — 트래픽의 대부분 — 가 한 항목으로 모인다.
 *
 * ── 실패는 캐시하지 않는다 ───────────────────────────────────
 * `unstable_cache` 는 **던진 예외를 캐시하지 않는다.** 그 성질을 쓴다:
 * 조회가 실패하면 던져서 캐시에 들어가지 않게 하고, 바깥에서 받아 `state`
 * 로 되돌린다. 실패한 응답을 캐시하면 DB 가 1초 흔들린 대가로 5분간
 * "불러오지 못했습니다" 가 모든 방문자에게 고정된다 — 장애보다 긴 장애다.
 */
class BoardFetchFailure extends Error {
  constructor(readonly state: BoardState) {
    super(`board fetch failed: ${state}`);
  }
}

const CACHE_SECONDS = 300;

const cachedReviewPage = unstable_cache(
  async (page: number, q: string, field: SearchField) => {
    const res = await fetchReviewPage({ page, q: q as SafeLikeTerm, field });
    if (res.state !== "ok") throw new BoardFetchFailure(res.state);
    return res;
  },
  ["board:reviews:list"],
  { revalidate: CACHE_SECONDS, tags: ["board:reviews"] },
);

const cachedNoticePage = unstable_cache(
  async (page: number, q: string, field: SearchField) => {
    const res = await fetchNoticePage({ page, q: q as SafeLikeTerm, field });
    if (res.state !== "ok") throw new BoardFetchFailure(res.state);
    return res;
  },
  ["board:notices:list"],
  { revalidate: CACHE_SECONDS, tags: ["board:notices"] },
);

/** 캐시를 거친 목록 조회. 실패는 캐시되지 않고 `state` 로 돌아온다 */
async function cachedPage<T>(
  run: (page: number, q: string, field: SearchField) => Promise<BoardPage<T>>,
  { page, q, field }: BoardQuery,
): Promise<BoardPage<T>> {
  try {
    return await run(page, q ?? "", field ?? "all");
  } catch (e) {
    if (e instanceof BoardFetchFailure) return empty<T>(e.state, page);
    throw e;
  }
}

export const getReviewPage = (query: BoardQuery) => cachedPage(cachedReviewPage, query);
export const getNoticePage = (query: BoardQuery) => cachedPage(cachedNoticePage, query);

/** 상세 1건. 없으면 `null` → 호출부가 `notFound()` 한다 */
export async function getReview(id: number): Promise<ReviewRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { rows } = await selectWithOptional<ReviewRow>(
    (columns) =>
      supabase.from("reviews").select(columns).eq("is_published", true).eq("id", id),
    [
      {
        columns: `${REVIEW_LIST_COLUMNS}, admin_reply, admin_reply_at`,
        missing: "007_board_reply_and_images.sql (운영자 답글)",
      },
      { columns: REVIEW_LIST_COLUMNS },
    ],
    "review",
  );
  return rows?.[0] ?? null;
}

export async function getNotice(id: number): Promise<NoticeRow | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { rows } = await selectWithOptional<NoticeRow>(
    (columns) =>
      supabase.from("notices").select(columns).eq("is_published", true).eq("id", id),
    [
      {
        columns: `${NOTICE_LIST_COLUMNS}, image_urls, image_alts`,
        missing: "009_image_alts_and_sort_index.sql (이미지 대체 텍스트)",
      },
      {
        columns: `${NOTICE_LIST_COLUMNS}, image_urls`,
        missing: "007_board_reply_and_images.sql (본문 이미지)",
      },
      { columns: NOTICE_LIST_COLUMNS },
    ],
    "notice",
  );
  return rows?.[0] ?? null;
}

/**
 * 공개된 글의 id 를 목록 순서로 돌려준다 — `generateStaticParams` 용.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────
 * 상세 라우트(`[id]`)에 `generateStaticParams` 가 없으면 빌드 시점에
 * 프리렌더할 경로를 Next 가 알 수 없어 **요청마다 렌더**된다. 두 상세
 * 파일에 `export const revalidate = 300` 을 적어 두고 "게시판은 5분
 * 재생성" 이라고 문서에 적었지만, 빌드 라우트 표에는 그 주기가 찍히지
 * 않았다 (`/` 와 `/[carrier]` 는 `5m` 으로 찍힌다). 적어 둔 것과 실제가
 * 달랐던 것이다.
 *
 * 글이 없으면 빈 배열이고, 그때도 라우트는 살아 있다 — `dynamicParams`
 * 기본값이 `true` 라서 목록에 없는 id 도 요청 시 렌더된다(그리고 없는
 * 글이면 `notFound()`). 즉 이 함수는 **프리렌더 대상을 알려 줄 뿐**이고
 * 무엇을 볼 수 있는지는 바꾸지 않는다.
 */
export async function getPublishedIds(table: BoardTable, limit = 500): Promise<number[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  const { data, error } = await applyListOrder(
    supabase.from(table).select("id").eq("is_published", true),
    table,
  ).limit(limit);
  if (error) {
    console.error(`[${table}] 프리렌더 대상 조회 실패:`, error.message);
    return [];
  }
  return ((data as { id: number }[] | null) ?? []).map((r) => r.id);
}

/**
 * 이전글·다음글을 구할 때 훑는 최대 행 수.
 *
 * `id` 한 열만 받으므로 1000행이라도 응답은 수 KB 다. 이 범위를 넘는 글의
 * 상세에서는 이전글·다음글을 **생략하고 로그를 남긴다** — 틀린 링크를 거는
 * 것보다 안 거는 쪽이 낫다. 게시판이 그만큼 커지면 키셋으로 바꿀 자리다.
 */
const NEIGHBOR_SCAN = 1000;

/**
 * 이전글·다음글 — **목록 순서에서 바로 위/아래 글**이다.
 *
 * ── 왜 `created_at` 비교(`gt`/`lt`)를 버렸는가 ─────────────────
 * 이전 판은 `created_at` 양옆 1건을 집었다. 두 가지가 틀렸다:
 *
 *   1. 정보공유 목록은 `is_pinned` 를 **먼저** 보는데 이 조회는 안 봤다.
 *      고정글이 하나라도 있으면 "다음글" 이 목록에서 아래 있던 글과 달랐다.
 *   2. `gt`/`lt` 는 **같은 시각의 형제를 통째로 건너뛴다.** 다중행 `INSERT`
 *      로 들어온 글 3건은 서로를 영원히 못 가리킨다.
 *
 * 지금은 목록과 **같은 정렬 함수**로 `id` 만 받아 와 그 줄에서 앞뒤를 집는다.
 * 순서 정의가 한 곳이라 어긋날 수가 없다. 쿼리 수는 그대로 2회다
 * (정렬된 id 목록 1회 + 양옆 제목 1회).
 */
export async function getNeighbors(table: BoardTable, id: number) {
  const none = { prev: null, next: null };
  const supabase = publicClient();
  if (!supabase) return none;

  const ordered = await applyListOrder(
    supabase.from(table).select("id").eq("is_published", true),
    table,
  ).limit(NEIGHBOR_SCAN);
  if (ordered.error) {
    console.error(`[${table}] 이전글·다음글 순서 조회 실패:`, ordered.error.message);
    return none;
  }

  const ids = ((ordered.data as { id: number }[] | null) ?? []).map((r) => r.id);
  const at = ids.indexOf(id);
  if (at === -1) {
    // 글은 열렸는데(상세 조회가 성공했다) 목록 창 안에 없는 경우 —
    // 범위를 넘었다는 뜻이다. 조용히 넘기면 커진 뒤에 알 수 없다.
    if (ids.length >= NEIGHBOR_SCAN) {
      console.error(
        `[${table}] 이전글·다음글 생략: 최신 ${NEIGHBOR_SCAN}건 안에 ${id} 가 없습니다`,
      );
    }
    return none;
  }

  // 목록은 최신순이므로 "이전글"(위쪽)은 **더 새 글**이다
  const prevId = at > 0 ? ids[at - 1] : null;
  const nextId = at < ids.length - 1 ? ids[at + 1] : null;
  const want = [prevId, nextId].filter((v): v is number => v !== null);
  if (want.length === 0) return none;

  const { data, error } = await supabase
    .from(table)
    .select("id, title")
    .eq("is_published", true)
    .in("id", want);
  if (error) {
    console.error(`[${table}] 이전글·다음글 제목 조회 실패:`, error.message);
    return none;
  }

  type Neighbor = { id: number; title: string };
  const byId = new Map(((data as Neighbor[] | null) ?? []).map((r) => [r.id, r]));
  return {
    prev: prevId === null ? null : byId.get(prevId) ?? null,
    next: nextId === null ? null : byId.get(nextId) ?? null,
  };
}

export { PAGE_SIZE, NEIGHBOR_SCAN, applyListOrder };
