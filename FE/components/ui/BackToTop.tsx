"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

/**
 * 맨 위로 버튼.
 *
 * 레퍼런스의 우측 스티키 사이드 레일에서 **이것 하나만** 가져왔다.
 * 레일의 나머지(대표번호·상담 CTA·게시판 링크)는 이미 하단 고정 상담바가
 * 같은 동작을 더 크게 제공하고 있어, 레일을 통째로 이식하면 화면 우측에
 * 같은 버튼이 두 벌 생긴다. 근거는 docs/UI_PORT_LOG.md 참고.
 *
 * 위치는 하단 상담바(4.5~5.5rem)와 Turnstile 위젯 슬롯(bottom-24)을 모두 피해
 * 그보다 위에 띄운다.
 */
export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 720);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-4 bottom-[11rem] z-30 flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-white/95 text-brand shadow-lift transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand-dark ${
        show ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <Icon name="chevronDown" size={20} className="rotate-180" />
    </button>
  );
}
