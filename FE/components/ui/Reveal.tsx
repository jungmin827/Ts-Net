"use client";

import { useEffect, useRef } from "react";

/**
 * 스크롤 진입 시 한 번만 fade-up 시키는 래퍼.
 * 실제 트랜지션은 globals.css 의 [data-reveal] 규칙이 담당하고,
 * 여기서는 뷰포트에 들어온 시점에 data-revealed 만 켠다.
 * prefers-reduced-motion 이면 CSS 쪽에서 즉시 노출되므로 별도 분기가 필요 없다.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** ms. 같은 줄의 카드들을 순차 등장시킬 때 사용 */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver 미지원 환경에서는 그냥 보이게 둔다
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "true";
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.revealed = "true";
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      data-revealed="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
