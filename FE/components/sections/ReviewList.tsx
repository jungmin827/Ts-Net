import Link from "next/link";
import Stars from "@/components/ui/Stars";
import { excerpt, formatDate, type ReviewRow } from "@/lib/board";
import { CARRIER_COLOR } from "@/lib/site-config";

/**
 * 후기 목록 격자.
 *
 * 페이지 파일에서 분리해 둔 이유는 **데이터가 있는 상태를 측정할 수 있게**
 * 하기 위함이다. 목록 마크업이 페이지 안에 박혀 있으면 DB 가 비어 있는 개발
 * 환경에서는 한 줄도 렌더되지 않아, 대비·넘침 측정이 "위반 0" 으로 통과한다 —
 * 아무것도 그리지 않은 화면을 재고 통과라 적는 셈이다.
 * `scripts/preview-reviews.mjs` 가 이 컴포넌트에 목 데이터를 넣어 렌더한다.
 */
export default function ReviewList({ items }: { items: ReviewRow[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/review/${r.id}`}
            className="group flex h-full flex-col rounded-panel border-2 border-line bg-white p-5 transition-colors duration-200 hover:border-brand"
          >
            {r.carrier && (
              <span
                className={`mb-2.5 inline-block w-fit rounded-md px-2 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[r.carrier] ?? "bg-muted"}`}
              >
                {r.carrier === "SKYLIFE" ? "SKY" : r.carrier}
              </span>
            )}
            <h2 className="mb-1.5 line-clamp-2 font-bold transition-colors group-hover:text-brand-dark">
              {r.title}
            </h2>
            <Stars rating={r.rating} />
            <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted">
              {excerpt(r.content)}
            </p>
            <p className="mt-auto pt-4 text-xs text-muted">
              {formatDate(r.created_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
