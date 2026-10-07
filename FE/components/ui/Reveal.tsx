"use client";

import { useEffect, useRef } from "react";

/**
 * 스크롤 진입 시 한 번만 fade-up 시키는 래퍼.
 *
 * **감추는 일은 JS 가 한다.** 서버 렌더 결과에는 `data-reveal` 이 없어서
 * 스크립트가 죽어도 내용이 그냥 보인다. 예전에는 마크업에 처음부터
 * `data-reveal` 이 박혀 있고 CSS 가 `opacity:0` 을 깔아서, JS 가 실패하면
 * 섹션이 통째로 사라지는 구조였다 (데이터 표시에 쓰기엔 위험한 설계).
 *
 * 마운트 시점에 이미 화면 안이면 애니메이션 없이 바로 보인 상태로 둔다 —
 * 첫 화면에서 깜빡였다가 다시 나타나는 일을 막는다.
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

    // IntersectionObserver 미지원 환경에서는 손대지 않는다 (이미 보이는 상태)
    if (typeof IntersectionObserver === "undefined") return;

    // 이미 뷰포트 안이면 연출 없이 통과
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    el.dataset.reveal = "";
    el.dataset.revealed = "false";
    if (delay) el.style.transitionDelay = `${delay}ms`;

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
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
