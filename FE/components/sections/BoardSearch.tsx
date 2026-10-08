import { SEARCH_FIELDS, type SearchField } from "@/lib/board";
import type { BoardState } from "@/lib/board-data";

/**
 * 게시판 검색 — 레퍼런스(탐나넷)가 두 게시판 모두에 둔 기능이다.
 *
 * **평범한 GET 폼**이다. `use client` 도 자바스크립트도 쓰지 않는다 —
 * 검색은 "주소를 바꿔 목록을 다시 읽는 일" 이고, 그건 브라우저가 폼으로
 * 이미 할 수 있다. 클라이언트 상태로 만들면 JS 가 막힌 환경에서 검색창이
 * 글자만 받고 아무 일도 하지 않는 장식이 된다.
 *
 * `page` 를 폼에 넣지 않는 것이 중요하다. 넣으면 3페이지에서 검색했을 때
 * **결과 3페이지**로 가는데, 결과가 1페이지뿐이면 빈 화면이 나온다.
 * 새 검색은 항상 1페이지다 (파라미터가 없으면 `pageParam` 이 1 로 떨어진다).
 */
export default function BoardSearch({
  action,
  field,
  q,
  total,
  state,
}: {
  /** 폼이 향하는 경로 (예: `/review`) */
  action: string;
  field: SearchField;
  q: string;
  total: number;
  /**
   * 조회 상태.
   *
   * `total` 과 따로 받는 이유 — 한동안 `resultCount: number | null` 로 받아
   * `null` 이면 "불러오지 못했습니다" 를 적었다. 그런데 키 미설정(`unconfigured`)
   * 도 `null` 이 되어서, 같은 페이지에서 **아래 빈 상태는 "연결되지 않았습니다",
   * 위 검색줄은 "불러오지 못했습니다"** 로 원인을 두 가지로 설명했다.
   * 둘 중 하나는 틀린 말이다.
   */
  state: BoardState;
}) {
  return (
    <div className="mt-8">
      <form
        action={action}
        method="get"
        role="search"
        className="flex flex-wrap items-stretch justify-center gap-2"
      >
        {/* 라벨을 눈에 안 보이게 두는 대신 없애지는 않는다 — 선택 상자가
            무엇을 고르는 것인지 스크린리더에서 이름이 있어야 한다 */}
        <label htmlFor="board-search-field" className="sr-only">
          검색 범위
        </label>
        <select
          id="board-search-field"
          name="field"
          defaultValue={field}
          className="min-h-11 rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-foreground"
        >
          {Object.entries(SEARCH_FIELDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="board-search-q" className="sr-only">
          검색어
        </label>
        <input
          id="board-search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="검색어를 입력하세요"
          maxLength={50}
          className="min-h-11 min-w-0 flex-1 rounded-lg border-2 border-line bg-white px-3.5 text-sm sm:max-w-xs sm:flex-none"
        />

        <button
          type="submit"
          className="min-h-11 rounded-lg border-2 border-brand-dark bg-brand-dark px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
        >
          검색
        </button>
      </form>

      {q !== "" && (
        <p className="mt-4 text-center text-sm text-muted">
          {state === "ok" ? (
            <>
              <span className="font-bold text-foreground">
                {SEARCH_FIELDS[field]}
              </span>
              에서 <span className="font-bold text-foreground">{q}</span>{" "}
              검색 — {total}건
            </>
          ) : state === "unconfigured" ? (
            <>저장소가 연결되지 않아 검색할 수 없습니다.</>
          ) : (
            <>검색 결과를 불러오지 못했습니다.</>
          )}{" "}
          <a
            href={action}
            className="font-bold text-brand-dark underline underline-offset-2"
          >
            전체 보기
          </a>
        </p>
      )}
    </div>
  );
}
