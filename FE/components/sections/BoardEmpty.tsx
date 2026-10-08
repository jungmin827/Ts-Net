import type { BoardState } from "@/lib/board-data";

/**
 * 목록이 비었을 때의 자리. **왜 비었는지에 따라 다른 말을 한다.**
 *
 * 글이 없는 것과 못 읽은 것을 같은 문장으로 덮으면, DB 가 죽은 날에도 화면은
 * "등록된 글이 없습니다" 라고 말한다 — 방문자에게 거짓이고 운영자에게는
 * 장애를 숨기는 표시다. LiveFeed 의 `DataPolicy` 와 같은 원칙이다.
 */
export default function BoardEmpty({
  state,
  noun,
}: {
  state: BoardState;
  /** "후기" / "게시글" 처럼 무엇이 없는지 */
  noun: string;
}) {
  const text =
    state === "ok"
      ? `아직 등록된 ${noun}가 없습니다.`
      : state === "unconfigured"
        ? `${noun} 저장소가 아직 연결되지 않았습니다. 연결 후 이 자리에 목록이 표시됩니다.`
        : `${noun}를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`;

  return (
    <div className="rounded-panel border-2 border-dashed border-line bg-surface-muted px-6 py-14 text-center">
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
