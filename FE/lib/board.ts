import { safeLikeTerm, type SafeLikeTerm } from "@/lib/postgrest";

/**
 * 게시판(후기·정보공유) 공용 유틸.
 *
 * 후기 카드는 메인 섹션과 목록·상세에서 세 번 쓰인다. 날짜 포맷과 발췌 길이가
 * 곳마다 다르면 방문자는 같은 글이 다른 글처럼 보인다 — 한 곳에 모아 둔다.
 */

export interface ReviewRow {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  carrier: string | null;
  created_at: string;
  /** 작성자 이름 — **가린 형태로만** 저장된다(`박*민`, `lib/mask-name.ts`). 없으면 그리지 않는다 */
  author?: string | null;
  /**
   * 첨부 사진 경로(최대 3장, 010). 주소·썸네일은 `lib/review-images.ts` 가 만든다.
   * 001 의 `thumbnail_url` 은 더 이상 읽지 않는다 — 010 이 anon 의 그 열을 닫았다.
   */
  image_paths?: string[] | null;
  /** `image_paths` 와 1:1 대체 텍스트. 운영자가 승인할 때 쓰고, 게시된 글엔 반드시 있다(010) */
  image_alts?: string[] | null;
  /**
   * 운영자 공개 답글 1건. 스레드형 댓글이 아니다 — 레퍼런스 두 곳이 공통으로
   * 투자한 유일한 상호작용이 이것뿐이었다(007 마이그레이션 주석 참고).
   * 007 미적용 환경에서는 `undefined` 로 온다.
   */
  admin_reply?: string | null;
  admin_reply_at?: string | null;
}

export interface NoticeRow {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  /** 본문에 순서대로 붙는 홍보 이미지. 007 미적용 환경에서는 `undefined` */
  image_urls?: string[] | null;
  /**
   * `image_urls` 와 1:1 로 짝지은 대체 텍스트. 009 가 **길이를 같게** 묶으므로
   * 장수와 설명 수가 어긋난 행은 DB 가 받지 않는다.
   * 009 미적용 환경에서는 `undefined` — 그때는 장식(`alt=""`)으로 떨어진다.
   */
  image_alts?: string[] | null;
}

/**
 * 목록 한 페이지에 몇 건.
 *
 * 15 는 레퍼런스(탐나넷) 실측값이다 — 1페이지 15행, 2페이지 15행, 총 55건에
 * 페이저 4칸. 3으로 나누어떨어져 카드 격자(최대 3열)에서 마지막 줄이 비지 않는다.
 */
export const PAGE_SIZE = 15;

/**
 * 날짜는 **전부 `Asia/Seoul` 기준**이다 (CLAUDE.md 코딩 규칙).
 * 서버에서 렌더하면 런타임 TZ 가 UTC 라서 자정 근처 글의 날짜가 하루 밀린다 —
 * `timeZone` 을 명시하지 않으면 그 버그는 하루 중 몇 시간만 나타나서
 * 재현이 안 된다.
 */
export function formatDate(iso: string, opts?: { withTime?: boolean }) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
  if (!opts?.withTime) return date;
  const time = d.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

/**
 * 목록용 한 줄 발췌. 줄바꿈을 공백으로 눌러 카드 높이가 본문 모양에 흔들리지
 * 않게 한다. 자를 때는 **글자 수**로 자른다 — 한국어는 단어 경계가 공백으로
 * 안 잡히는 경우가 많아 단어 단위로 자르면 거의 안 잘린다.
 */
export function excerpt(content: string, max = 90) {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

/** 전체 건수와 현재 페이지로 페이지네이션 상태를 만든다 */
export function paginate(total: number, page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    pages,
    current,
    from: (current - 1) * size,
    to: current * size - 1,
    hasPrev: current > 1,
    hasNext: current < pages,
  };
}

/**
 * `?page=` 를 숫자로 읽는다. 쿼리는 누구나 손으로 고칠 수 있으므로
 * `page=-1` `page=abc` `page=1e9` 가 와도 1 로 떨어뜨린다. 던지지 않는 이유는
 * 목록 페이지가 그 때문에 500 을 내면 잘못 입력한 쪽이 아니라 사이트가
 * 망가진 것처럼 보이기 때문이다.
 *
 * ── 왜 `Number()` 만으로는 부족한가 ──────────────────────────
 * 위 주석은 한동안 **코드가 하지 않는 일**을 적고 있었다. `Number("1e9")` 는
 * `1000000000` 이고 `Number.isSafeInteger` 를 통과하므로, `?page=1e9` 는 1 이
 * 아니라 10억으로 읽혔다. 10억은 `paginate` 가 마지막 페이지로 깎아 주지만
 * 주소창에는 `page=1e9` 가 남고 페이저 링크도 그 숫자 기준으로 그려진다.
 * 그래서 **표기까지** 숫자여야 한다고 못 박는다 — 숫자 외 문자가 섞인
 * 표기(`1e9` `0x10` ` 3 ` `3.0`)는 전부 1 이다.
 *
 * 상한을 두는 이유는 따로다. `page` 는 `range()` 의 시작 행을 만들고,
 * 10억 페이지는 `offset` 150억이 된다 — 글이 10건이어도 DB 가 그 계산을 한다.
 */
const MAX_PAGE = 10_000;

export function pageParam(v: string | string[] | undefined) {
  const raw = Array.isArray(v) ? v[0] : v;
  if (typeof raw !== "string" || !/^[0-9]{1,9}$/.test(raw)) return 1;
  const n = Number(raw);
  return n >= 1 ? Math.min(n, MAX_PAGE) : 1;
}

/** 검색 대상 — 레퍼런스(탐나넷)의 `sfield` 와 같은 구성. 회원명은 우리가 작성자를 노출하지 않아 뺀다 */
export const SEARCH_FIELDS = {
  all: "제목+내용",
  title: "제목",
  content: "내용",
} as const;
export type SearchField = keyof typeof SEARCH_FIELDS;

export function searchField(v: string | string[] | undefined): SearchField {
  const raw = Array.isArray(v) ? v[0] : v;
  return raw === "title" || raw === "content" ? raw : "all";
}

/**
 * 검색어 정리. 실제 규칙은 `safeLikeTerm` 한 곳에 있다 —
 * 어드민 명단 검색(`lib/admin/leads.ts`)도 같은 함수를 쓴다.
 * 규칙이 두 벌이면 한쪽만 고쳐지고, 고쳐지지 않은 쪽은 조용히 오답을 낸다.
 */
export function sanitizeQuery(v: string | string[] | undefined): SafeLikeTerm {
  return safeLikeTerm(v);
}

/**
 * 목록 페이지가 쓰는 검색어 해석 — 정리 결과와 **정리로 다 날아갔는지**를
 * 같이 돌려준다.
 *
 * ── 왜 `dropped` 가 필요한가 ─────────────────────────────────
 * `safeLikeTerm` 은 DSL 에서 의미를 갖는 문자를 버린다. 그래서 `...` `(((`
 * `"` 처럼 **버려지는 문자만** 입력하면 결과가 빈 문자열이고, 빈 문자열은
 * "검색 안 함" 과 같은 값이다. 그 상태로 두면 검색 버튼을 눌렀는데
 * **전체 목록이 그대로** 나온다 — 방문자 눈에는 검색이 먹지 않은 것도
 * 아니고 결과가 0건인 것도 아닌, 설명되지 않는 화면이다.
 *
 * 입력 자체가 비어 있던 경우(`dropped: false`)와 구분해야 한다. 그때
 * 전체 목록은 **맞는 결과**다.
 */
export interface ParsedQuery {
  /** 필터에 쓸 값. 빈 문자열이면 검색하지 않는다 */
  term: SafeLikeTerm;
  /** 입력은 있었는데 정리 후 아무것도 남지 않았다 */
  dropped: boolean;
}

export function parseQuery(v: string | string[] | undefined): ParsedQuery {
  const raw = Array.isArray(v) ? v[0] : v;
  const term = safeLikeTerm(v);
  return {
    term,
    dropped: term === "" && typeof raw === "string" && raw.trim() !== "",
  };
}
