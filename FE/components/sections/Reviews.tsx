import Link from "next/link";
import { CARRIER_COLOR } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";

export interface ReviewItem {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  thumbnail_url: string | null;
  carrier: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function Stars({ rating }: { rating: number | null }) {
  const r = rating ?? 5;
  return (
    <span className="flex gap-0.5" aria-label={`5점 만점에 ${r}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={15}
          filled
          className={n <= r ? "text-accent" : "text-slate-200"}
        />
      ))}
    </span>
  );
}

/** 후기 슬라이더(가로 스크롤 카드). 게시된 후기가 없으면 섹션 미출력 */
export default function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="mb-3 inline-block rounded-full bg-brand-light px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand">
              REVIEW
            </span>
            <h2 className="text-2xl font-black md:text-[2rem]">가입 후기</h2>
          </div>
          <Link
            href="/review"
            className="group flex shrink-0 items-center gap-1 text-sm font-bold text-brand"
          >
            후기 보러가기
            <Icon
              name="arrowRight"
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        </div>

        <Reveal>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/review/${r.id}`}
                className="group flex w-72 shrink-0 snap-start flex-col rounded-panel border border-line bg-white p-5 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-lift"
              >
                {r.carrier && (
                  <span
                    className={`mb-2.5 inline-block w-fit rounded-md px-2 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[r.carrier] ?? "bg-slate-400"}`}
                  >
                    {r.carrier === "SKYLIFE" ? "SKY" : r.carrier}
                  </span>
                )}
                <h3 className="mb-1.5 line-clamp-1 font-bold transition-colors group-hover:text-brand">
                  {r.title}
                </h3>
                <Stars rating={r.rating} />
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted">
                  {r.content}
                </p>
                <p className="mt-auto pt-4 text-xs text-slate-400">
                  {formatDate(r.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
