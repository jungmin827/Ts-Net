import Link from "next/link";
import Icon from "@/components/ui/Icon";

type Neighbor = { id: number; title: string } | null;

/**
 * 상세 하단의 이전글·다음글·목록 내비.
 *
 * 양옆 글은 **작성일 기준**으로 구한다(`getNeighbors`) — `id ± 1` 로 구하면
 * 중간에 미승인 글이 있을 때 없는 글로 링크가 걸린다.
 *
 * 글이 한쪽에 없으면 그 줄은 **비활성 텍스트로 남긴다.** 줄 자체를 지우면
 * "이전글" 과 "다음글" 의 자리가 글마다 바뀌어, 연달아 읽을 때 눌러야 하는
 * 위치가 매번 달라진다.
 */
export default function BoardNav({
  base,
  listLabel,
  prev,
  next,
}: {
  base: string;
  listLabel: string;
  prev: Neighbor;
  next: Neighbor;
}) {
  const row = (dir: "prev" | "next", item: Neighbor) => {
    const label = dir === "prev" ? "이전글" : "다음글";
    return (
      <li className="flex items-center gap-3 px-5 py-4">
        <span className="w-14 shrink-0 text-xs font-bold text-muted">
          {label}
        </span>
        {item ? (
          <Link
            href={`${base}/${item.id}`}
            rel={dir}
            className="line-clamp-1 text-sm font-bold text-foreground hover:text-brand-dark hover:underline"
          >
            {item.title}
          </Link>
        ) : (
          <span className="text-sm text-muted">
            {dir === "prev" ? "가장 최근 글입니다" : "가장 오래된 글입니다"}
          </span>
        )}
      </li>
    );
  };

  return (
    <section className="bg-white pb-12 md:pb-16">
      <div className="mx-auto max-w-3xl px-4">
        <nav aria-label="글 사이 이동">
          <ul className="divide-y divide-line rounded-panel border-2 border-line">
            {row("prev", prev)}
            {row("next", next)}
          </ul>
        </nav>
        <p className="mt-6 text-center">
          <Link
            href={base}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-line bg-white px-5 text-sm font-bold text-foreground transition-colors duration-200 hover:border-brand hover:text-brand-dark"
          >
            <Icon name="arrowRight" size={15} className="rotate-180" />
            {listLabel}
          </Link>
        </p>
      </div>
    </section>
  );
}
