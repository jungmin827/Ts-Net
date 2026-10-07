import Link from "next/link";
import { CARRIER_COLOR } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

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

/**
 * 평점 별. **평점이 없으면 아무것도 그리지 않는다.**
 *
 * 예전에는 `rating ?? 5` 로 NULL 을 만점으로 바꿔 그렸다. 평가가 없는 후기를
 * 전부 별 다섯 개로 보이게 만드는 코드였고, CLAUDE.md 규칙 1(가짜 데이터를
 * 생성하지 않는다)의 가장 명백한 위반이었다. 표시광고법 리스크이기도 하다.
 */
function Stars({ rating }: { rating: number | null }) {
  if (rating === null || rating <= 0) return null;
  const r = rating;
  return (
    // `role="img"` 가 있어야 `aria-label` 이 이름으로 쓰인다 —
    // 역할이 generic 인 요소의 aria-label 은 상당수 스크린리더가 무시한다.
    // 별 5개가 각각 읽히는 대신 "5점 만점에 N점" 한 번으로 읽혀야 한다.
    <span role="img" className="flex gap-0.5" aria-label={`5점 만점에 ${r}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={15}
          filled
          // 채운 별은 `--star`(흰 배경 4.56:1 · 빈 별 3.07:1). `--accent` 는
          // 1.97:1 이라 비문자 3:1 에 미달한다 — globals.css 토큰 주석 참고.
          className={n <= r ? "text-star" : "text-line-strong"}
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
