import { formatDate } from "@/lib/board";
import CarrierBadge from "@/components/ui/CarrierBadge";
import Stars from "@/components/ui/Stars";
import ReviewRowActions from "./ReviewRowActions";
import ReviewPhotoEditor from "./ReviewPhotoEditor";
import type { ReviewModRowData } from "./page";

/**
 * 후기 승인 화면의 한 행.
 *
 * 페이지에서 분리한 이유는 **측정 가능하게** 하기 위함이다. 어드민 페이지는
 * `await requireAdmin()` 으로 시작하는 서버 컴포넌트라 하네스에서 직접
 * 렌더할 수 없고, 계정이 없으면 브라우저로도 열 수 없다. 즉 분리하지 않으면
 * 이 화면의 대비를 **한 번도 재지 못한 채** 내보내게 된다.
 *
 * 하네스가 같은 모양을 손으로 베끼는 방식은 쓰지 않는다 — `BoardArticle`
 * 에서 그렇게 했다가 뱃지 클래스를 틀려 거짓 위반(대비 1.00)을 만들었다.
 */
export default function ReviewModRow({
  row: r,
  replyAvailable,
}: {
  row: ReviewModRowData;
  replyAvailable: boolean;
}) {
  return (
    <li
      className={`rounded-panel border-2 bg-white p-5 ${
        r.is_published ? "border-line" : "border-brand"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-black ${
            r.is_published
              ? "bg-surface-muted text-muted"
              : "bg-brand-light text-brand-deep"
          }`}
        >
          {r.is_published ? "게시중" : "승인 대기"}
        </span>
        {r.carrier && (
          <CarrierBadge code={r.carrier} />
        )}
        <Stars rating={r.rating} size={14} />
        {r.author && <span className="text-xs font-bold">{r.author}</span>}
        <time dateTime={r.created_at} className="ml-auto text-xs text-muted">
          {formatDate(r.created_at, { withTime: true })}
        </time>
      </div>

      <h2 className="font-bold">{r.title}</h2>
      {/* 본문을 접지 않는다 — 승인 판단에 필요한 전부가 본문이고,
                펼치는 동작을 한 번 더 요구하면 대충 읽고 승인하게 된다 */}
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted">
        {r.content}
      </p>

      {r.image_paths && (
        // 장수가 바뀌면(사진 빼기) 다시 마운트해 입력칸을 새 배열에 맞춘다 —
        // 그대로 두면 칸 순서가 밀려 1번 사진의 설명이 2번 사진에 붙는다
        <ReviewPhotoEditor
          key={r.image_paths.join("|")}
          id={r.id}
          paths={r.image_paths}
          alts={r.image_alts}
        />
      )}

      {r.admin_reply && (
        <div // 경계 토큰은 `AdminReply` 와 같다 — `--brand-light` 는 흰 면 위 1.13:1
            className="mt-4 rounded-lg border-2 border-brand-dark bg-brand-soft px-4 py-3">
          <p className="text-xs font-black text-brand-deep">
            운영자 답변
            {r.admin_reply_at && (
              <span className="ml-2 font-medium text-muted">
                {formatDate(r.admin_reply_at, { withTime: true })}
              </span>
            )}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
            {r.admin_reply}
          </p>
        </div>
      )}

      <div className="mt-4">
        <ReviewRowActions
          id={r.id}
          published={r.is_published}
          reply={r.admin_reply ?? null}
          replyAvailable={replyAvailable}
          needsAlts={!!r.image_paths && !r.image_alts}
        />
      </div>
    </li>
  );
}
