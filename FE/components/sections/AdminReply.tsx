import { formatDate } from "@/lib/board";

/**
 * 운영자 공개 답글.
 *
 * 레퍼런스 두 곳을 요소 단위로 뜯어본 결과, **양쪽이 공통으로 투자한 유일한
 * 상호작용이 이것**이었다 — 평점도, 스레드 댓글도, 이전글/다음글도 양쪽에
 * 없다. 탐나넷은 후기 30건 전부에 관리자 답글이 1건씩 달려 있고, 다모아는
 * 상세 하단에 "운영진 댓글" 전용 블록이 1건 슬롯으로 박혀 있다.
 * 그래서 후기 1건당 1건 구조로 둔다 (`reviews.admin_reply`, 007).
 *
 * 답글이 없으면 **블록 자체를 그리지 않는다.** "아직 답변이 없습니다" 를
 * 띄우면 모든 글에 미응답 표시가 붙어, 운영자가 답을 달기 전까지 사이트가
 * 방치된 것처럼 읽힌다 — 실제로는 답글이 필수인 적이 없다.
 */
export default function AdminReply({
  body,
  at,
}: {
  body?: string | null;
  at?: string | null;
}) {
  // 007 미적용 환경에서는 `undefined` 로 온다. 둘 중 하나만 있는 상태는
  // DB 제약(`reviews_admin_reply_paired`)이 막지만, 그 제약이 적용되기 전에
  // 들어간 행이 있을 수 있어 화면에서도 둘 다 요구한다.
  if (!body || !body.trim() || !at) return null;

  return (
    <aside
      aria-label="운영자 답변"
      className="mt-10 rounded-panel border-2 border-brand-light bg-brand-soft p-5 md:p-6"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-black text-brand-deep">운영자 답변</span>
        <time dateTime={at} className="text-xs text-muted">
          {formatDate(at, { withTime: true })}
        </time>
      </div>
      <p className="text-[0.9375rem] leading-[1.9] whitespace-pre-wrap">
        {body}
      </p>
    </aside>
  );
}
