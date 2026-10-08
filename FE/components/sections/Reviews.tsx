import Link from "next/link";
import { CARRIER_COLOR } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import Stars from "@/components/ui/Stars";
import { formatDate, type ReviewRow } from "@/lib/board";

export type ReviewItem = ReviewRow;

/** 후기 슬라이더(가로 스크롤 카드). 게시된 후기가 없으면 섹션 미출력 */
export default function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black md:text-[2rem]">가입 후기</h2>
          </div>
          <Link
            href="/review"
            className="group flex shrink-0 items-center gap-1 text-sm font-bold text-brand-dark"
          >
            후기 보러가기
            <Icon
              name="arrowRight"
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/review/${r.id}`}
                className="group flex w-72 shrink-0 snap-start flex-col rounded-panel border-2 border-line bg-white p-5 transition-colors duration-200 hover:border-brand"
              >
                {r.carrier && (
                  <span
                    className={`mb-2.5 inline-block w-fit rounded-md px-2 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[r.carrier] ?? "bg-muted"}`}
                  >
                    {r.carrier === "SKYLIFE" ? "SKY" : r.carrier}
                  </span>
                )}
                <h3 className="mb-1.5 line-clamp-1 font-bold transition-colors group-hover:text-brand-dark">
                  {r.title}
                </h3>
                <Stars rating={r.rating} />
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted">
                  {r.content}
                </p>
                <p className="mt-auto pt-4 text-xs text-faint">
                  {formatDate(r.created_at)}
                </p>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
