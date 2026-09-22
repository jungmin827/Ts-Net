"use client";

import { useEffect, useState } from "react";
import { CARRIER_COLOR } from "@/lib/site-config";
import SectionHeading from "@/components/ui/SectionHeading";

// 실시간 신청현황 — 실제 접수 데이터만 마스킹해 노출 (CLAUDE.md 규칙 1).
// API가 5건 미만이면 빈 배열을 주므로 이 컴포넌트는 섹션 자체를 렌더링하지 않는다.

interface FeedItem {
  applied_date: string;
  carrier: string | null;
  masked_name: string;
  status_label: string | null;
  gift_label: string | null;
}

/** 상태 라벨별 뱃지 색 — 완료 계열은 남색, 진행 계열은 중립 */
function statusTone(label: string | null) {
  if (label === "완료" || label === "설치완료") return "bg-brand text-white";
  if (label === "진행중") return "bg-brand-light text-brand";
  return "bg-slate-100 text-slate-600";
}

export default function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    fetch("/api/feed/live")
      .then((r) => r.json())
      .then((d: { items: FeedItem[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  // 세로 롤링 — 목록을 2배로 이어붙여 -50% 이동을 무한 반복
  const doubled = [...items, ...items];

  return (
    <section className="bg-brand-soft py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          eyebrow="LIVE"
          title="실시간 신청 현황"
          description="실제 접수된 상담 신청만 마스킹해 표시합니다"
        />

        <div className="overflow-hidden rounded-panel border border-line bg-white shadow-card">
          {/* 표 머리 — 각 열이 무엇인지 알려줘야 나열이 정보로 읽힌다 */}
          <div className="grid grid-cols-[4.5rem_3.5rem_1fr_5rem_4rem] items-center gap-2 border-b border-line bg-surface-muted px-4 py-3 text-xs font-bold text-muted sm:grid-cols-[6rem_5rem_1fr_6rem_5rem] sm:px-5">
            <span>신청일</span>
            <span>통신사</span>
            <span>이름</span>
            <span className="text-center">진행상태</span>
            <span className="text-center">사은품</span>
          </div>

          {/* 위아래 페이드로 롤링이 잘려 보이지 않게 마스킹 */}
          <div
            className="group relative h-72 overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)",
            }}
          >
            <ul className="animate-feed-scroll group-hover:[animation-play-state:paused]">
              {doubled.map((it, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[4.5rem_3.5rem_1fr_5rem_4rem] items-center gap-2 border-b border-line/60 px-4 py-3.5 text-sm transition-colors hover:bg-brand-soft sm:grid-cols-[6rem_5rem_1fr_6rem_5rem] sm:px-5"
                >
                  <span className="text-xs text-slate-400">
                    {it.applied_date}
                  </span>
                  <span>
                    {it.carrier && (
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[it.carrier] ?? "bg-slate-400"}`}
                      >
                        {it.carrier === "SKYLIFE" ? "SKY" : it.carrier}
                      </span>
                    )}
                  </span>
                  <span className="font-bold">{it.masked_name}</span>
                  <span className="text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(it.status_label)}`}
                    >
                      {it.status_label}
                    </span>
                  </span>
                  <span className="text-center text-xs font-medium text-muted">
                    {it.gift_label ?? "확인중"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
