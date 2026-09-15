"use client";

import { useState } from "react";
import LeadForm from "./LeadForm";

/** 데스크톱 우하단 플로팅 퀵상담 — 모바일에서는 MobileBottomBar가 대신한다 */
export default function QuickForm() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-6 bottom-6 z-40 hidden lg:block">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
          <p className="mb-3 text-lg font-bold">빠른 상담 신청</p>
          <LeadForm variant="compact" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-auto block cursor-pointer rounded-full bg-brand px-6 py-4 font-bold text-white shadow-lg transition-colors hover:bg-brand-dark"
      >
        {open ? "닫기" : "빠른 상담"}
      </button>
    </div>
  );
}
