"use client";

import { useEffect, useState } from "react";
import LeadForm from "./LeadForm";
import Icon from "@/components/ui/Icon";

/**
 * 데스크톱 우하단 플로팅 퀵상담 — 모바일에서는 MobileBottomBar가 대신한다.
 * 히어로를 지나 스크롤한 뒤에 등장시켜 첫 화면을 가리지 않게 한다.
 */
export default function QuickForm() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed right-6 bottom-6 z-40 hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      {/* 열렸을 때만 마운트한다. 숨긴 채로 두면 안쪽 Turnstile 위젯이
          display:none 컨테이너에서 렌더를 무한 재시도해 메인 스레드를 점유한다 */}
      {open && (
        <div className="animate-pop mb-3 w-80 origin-bottom-right rounded-panel border border-line bg-white p-5 shadow-float">
          <p className="mb-3 flex items-center gap-2 text-lg font-black">
            <Icon name="chat" size={20} className="text-brand" />
            빠른 상담 신청
          </p>
          <LeadForm variant="compact" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ml-auto flex cursor-pointer items-center gap-2 rounded-full bg-brand px-6 py-4 font-black text-white shadow-float transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark active:translate-y-0"
      >
        <Icon name={open ? "close" : "chat"} size={20} />
        {open ? "닫기" : "빠른 상담"}
      </button>
    </div>
  );
}
