import Link from "next/link";
import { excerpt, formatDate, type NoticeRow } from "@/lib/board";

/**
 * 정보공유 목록 — **한 줄 목록**이다.
 *
 * 후기는 카드 격자인데 여기는 아니다. 공지에는 썸네일도 평점도 없어서 카드로
 * 만들면 빈 칸만 넓어진다. 제목을 세로로 쌓는 쪽이 훑어 읽기에 맞다.
 *
 * 페이지에서 분리한 이유는 `ReviewList` 주석 참고 — 빈 DB 에서 측정이
 * 아무것도 재지 않고 통과하는 걸 막기 위함이다.
 */
export default function NoticeList({ items }: { items: NoticeRow[] }) {
  return (
    <ul className="divide-y divide-line border-y-2 border-line">
      {items.map((n) => (
        <li key={n.id}>
          <Link
            href={`/notice/${n.id}`}
            className="group flex flex-col gap-1.5 px-1 py-5 transition-colors sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              {n.is_pinned && (
                <span className="shrink-0 rounded-md bg-brand-light px-2 py-0.5 text-[11px] font-black text-brand-deep">
                  공지
                </span>
              )}
              <span className="min-w-0">
                <span className="block font-bold transition-colors group-hover:text-brand-dark">
                  {n.title}
                </span>
                <span className="mt-1 line-clamp-1 block text-sm text-muted">
                  {excerpt(n.content, 110)}
                </span>
              </span>
            </span>
            <time dateTime={n.created_at} className="shrink-0 text-xs text-muted">
              {formatDate(n.created_at)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
