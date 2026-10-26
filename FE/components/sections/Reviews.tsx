import Link from "next/link";
import CarrierBadge from "@/components/ui/CarrierBadge";
import Icon from "@/components/ui/Icon";
import ReviewThumb from "@/components/ui/ReviewThumb";
import Stars from "@/components/ui/Stars";
import { formatDate, type ReviewRow } from "@/lib/board";

export type ReviewItem = ReviewRow;

/** 후기 슬라이더(가로 스크롤 카드). 게시된 후기가 없으면 섹션 미출력 */
export default function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="border-t border-line py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[1.625rem] font-black md:text-[2rem]">가입 후기</h2>
            <p className="mt-2 text-sm text-muted md:text-base">
              저희 통해 가입하신 분들이 직접 남겨주신 글이에요
            </p>
          </div>
          <Link
            href="/review"
            className="group flex shrink-0 items-center gap-1 text-sm font-bold"
          >
            후기 더 보기
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
                className="group flex w-72 shrink-0 snap-start flex-col rounded-card border border-line-strong bg-surface p-5 transition-colors hover:border-foreground"
              >
                <ReviewThumb paths={r.image_paths} sizes="248px" className="mb-3.5" />
                {r.carrier && <CarrierBadge code={r.carrier} className="mb-2.5" />}
                <h3 className="mb-1.5 line-clamp-1 font-bold group-hover:underline">
                  {r.title}
                </h3>
                <Stars rating={r.rating} />
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted">
                  {r.content}
                </p>
                <p className="mt-auto pt-4 text-xs text-faint">
                  {r.author && <span className="font-bold text-muted">{r.author} · </span>}
                  {formatDate(r.created_at)}
                </p>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
