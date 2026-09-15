"use client";

import { useEffect, useState } from "react";
import { CARRIER_COLOR } from "@/lib/site-config";

// 실시간 신청현황 — 실제 접수 데이터만 마스킹해 노출 (CLAUDE.md 규칙 1).
// API가 5건 미만이면 빈 배열을 주므로 이 컴포넌트는 섹션 자체를 렌더링하지 않는다.

interface FeedItem {
  applied_date: string;
  carrier: string | null;
  masked_name: string;
  status_label: string | null;
  gift_label: string | null;
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
    <section className="bg-gray-50 py-14">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-6 text-center text-2xl font-black">
          실시간 신청 현황
        </h2>
        <div className="h-72 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <ul className="animate-feed-scroll">
            {doubled.map((it, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-gray-50 px-5 py-3 text-sm"
              >
                <span className="text-gray-400">{it.applied_date}</span>
                {it.carrier && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold text-white ${CARRIER_COLOR[it.carrier] ?? "bg-gray-400"}`}
                  >
                    {it.carrier}
                  </span>
                )}
                <span className="font-medium">{it.masked_name}</span>
                <span className="ml-auto text-brand">{it.status_label}</span>
                <span className="text-gray-500">
                  사은품 {it.gift_label ?? "확인중"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
