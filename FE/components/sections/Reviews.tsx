import Link from "next/link";
import { CARRIER_COLOR } from "@/lib/site-config";

export interface ReviewItem {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  thumbnail_url: string | null;
  carrier: string | null;
  created_at: string;
}

function stars(rating: number | null) {
  const r = rating ?? 5;
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 후기 슬라이더(1차: 가로 스크롤 카드). 게시된 후기가 없으면 섹션 미출력 */
export default function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-black md:text-3xl">가입 후기</h2>
          <Link href="/review" className="text-sm font-medium text-brand">
            후기 보러가기 →
          </Link>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/review/${r.id}`}
              className="w-72 shrink-0 snap-start rounded-2xl border border-gray-100 p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {r.carrier && (
                <span
                  className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-bold text-white ${CARRIER_COLOR[r.carrier] ?? "bg-gray-400"}`}
                >
                  {r.carrier}
                </span>
              )}
              <h3 className="mb-1 line-clamp-1 font-bold">{r.title}</h3>
              <p className="text-sm text-accent">{stars(r.rating)}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-500">
                {r.content}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                {formatDate(r.created_at)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
