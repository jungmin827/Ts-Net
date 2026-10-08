import Link from "next/link";

/**
 * 번호 페이지네이션.
 *
 * "더보기" 버튼이 아니라 번호를 쓰는 이유는 **서버 컴포넌트로 끝나기** 때문이다.
 * 더보기는 클라이언트 상태와 추가 요청 경로가 필요하고, 그만큼 JS 가 막혔을 때
 * 2페이지 이후가 통째로 사라진다. 번호는 그냥 링크라서 스크립트 없이 동작한다.
 *
 * 한 번에 보여주는 번호는 현재 페이지 기준 ±2 (최대 5개) + 양 끝. 페이지가
 * 수십 개로 늘어도 줄이 넘치지 않는다.
 */
export default function Pagination({
  base,
  current,
  pages,
  label,
  params,
}: {
  /** 쿼리 없는 경로 (예: `/review`) */
  base: string;
  current: number;
  pages: number;
  /** 스크린리더용 — "후기 목록 페이지" 처럼 무엇의 페이지인지 말해준다 */
  label: string;
  /**
   * 페이지를 넘겨도 유지할 쿼리 (검색어 등).
   *
   * 이게 없으면 "검색 → 2페이지" 가 **검색어를 잃고 전체 목록 2페이지**로
   * 간다. 결과가 20건이라 2페이지가 있는데, 눌러 보면 전혀 다른 글이 나온다 —
   * 사용자는 자기가 뭘 잘못 눌렀는지 알 수 없다.
   */
  params?: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const href = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const window = new Set<number>([1, pages]);
  for (let n = current - 2; n <= current + 2; n += 1)
    if (n >= 1 && n <= pages) window.add(n);
  const nums = [...window].sort((a, b) => a - b);

  // 터치 타깃 44×44 (WCAG 2.5.8) — `size-11` = 44px
  const cell =
    "flex size-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors duration-200";

  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {current > 1 && (
          <li>
            <Link
              href={href(current - 1)}
              rel="prev"
              aria-label="이전 페이지"
              className={`${cell} border-line bg-white text-muted hover:border-brand hover:text-brand-dark`}
            >
              ‹
            </Link>
          </li>
        )}
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1.5">
            {/* 번호가 건너뛰는 자리에 생략 기호. 장식이라 스크린리더에서 뺀다 */}
            {i > 0 && n - nums[i - 1] > 1 && (
              <span aria-hidden="true" className="px-1 text-faint">
                …
              </span>
            )}
            {n === current ? (
              <span
                aria-current="page"
                className={`${cell} border-brand-dark bg-brand-dark text-white`}
              >
                {n}
              </span>
            ) : (
              <Link
                href={href(n)}
                aria-label={`${n}페이지`}
                className={`${cell} border-line bg-white text-muted hover:border-brand hover:text-brand-dark`}
              >
                {n}
              </Link>
            )}
          </li>
        ))}
        {current < pages && (
          <li>
            <Link
              href={href(current + 1)}
              rel="next"
              aria-label="다음 페이지"
              className={`${cell} border-line bg-white text-muted hover:border-brand hover:text-brand-dark`}
            >
              ›
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
