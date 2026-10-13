import type { BoardState } from "@/lib/board-data";

/**
 * 목록이 비었을 때의 자리. **왜 비었는지에 따라 다른 말을 한다.**
 *
 * 글이 없는 것과 못 읽은 것을 같은 문장으로 덮으면, DB 가 죽은 날에도 화면은
 * "등록된 글이 없습니다" 라고 말한다 — 방문자에게 거짓이고 운영자에게는
 * 장애를 숨기는 표시다. LiveFeed 의 `DataPolicy` 와 같은 원칙이다.
 *
 * ── 축이 하나 더 있다: 검색 중인가 ────────────────────────────
 * 한동안 구분하는 축이 `state` 하나뿐이었다. 그래서 후기가 30건 쌓인 뒤
 * `?q=없는단어` 로 검색하면 **"아직 등록된 후기가 없습니다"** 가 떴다 —
 * 30건이 있는데 없다고 말하는 것이고, 같은 화면 위쪽에는 `BoardSearch` 가
 * "검색 — 0건" 을 적고 있어서 두 문장이 서로를 부정했다. 비어 있는 이유가
 * "글이 없다" 가 아니라 "이 검색어에 걸린 글이 없다" 일 때는 그렇게 적는다.
 */
export default function BoardEmpty({
  state,
  noun,
  search,
}: {
  state: BoardState;
  /** "후기" / "게시글" 처럼 무엇이 없는지 */
  noun: string;
  /**
   * 지금 적용된 검색어. 비어 있으면 검색 중이 아니다.
   *
   * `boolean` 이 아니라 검색어 자체를 받는 이유 — 무엇으로 찾았는지를 그
   * 자리에서 보여 주면, 오타나 정리로 달라진 검색어를 방문자가 바로 안다.
   */
  search?: string;
}) {
  const searching = !!search && state === "ok";
  const text =
    state === "ok"
      ? `아직 등록된 ${noun}가 없습니다.`
      : state === "unconfigured"
        ? `${noun} 저장소가 아직 연결되지 않았습니다. 연결 후 이 자리에 목록이 표시됩니다.`
        : `${noun}를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`;

  return (
    <div className="rounded-panel border-2 border-dashed border-line bg-surface-muted px-6 py-14 text-center">
      <p className="text-sm leading-relaxed text-muted">
        {searching ? (
          <>
            <span className="font-bold text-foreground">{search}</span> 로 찾은{" "}
            {noun}가 없습니다.
          </>
        ) : (
          text
        )}
      </p>
    </div>
  );
}
