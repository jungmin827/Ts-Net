"use client";

import { useEffect, useState } from "react";
import CarrierBadge from "@/components/ui/CarrierBadge";
import SectionHeading from "@/components/ui/SectionHeading";

// 실시간 신청현황 — 실제 접수 데이터만 마스킹해 노출 (CLAUDE.md 규칙 1).
// API 가 5건 미만이면 빈 배열을 준다. 그때(그리고 로딩·실패 중에도)는
// **아무것도 그리지 않는다.** 자리를 미리 잡지 않으므로 공백이 남지 않고,
// "아직 쌓이지 않았다" 같은 단정을 할 일도 없다.

/** 비어 있는 이유. `loading` 은 아직 아무것도 단정할 수 없는 상태 */
type FeedState = "loading" | "ok" | "tooFew" | "error";

interface FeedItem {
  applied_date: string;
  carrier: string | null;
  masked_name: string;
  status_label: string | null;
  gift_label: string | null;
}

/** 상태 라벨별 뱃지 색 — 완료 계열은 진한 초록, 진행 계열은 옅은 초록 */
function statusTone(label: string | null) {
  if (label === "완료" || label === "설치완료") return "bg-brand-dark text-white";
  if (label === "진행중") return "bg-brand-light text-brand-deep";
  return "bg-surface-muted text-muted";
}

export default function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  /** 서버 렌더·첫 페인트는 항상 "아직 모름" 이다 — 단정하지 않는다 */
  const [state, setState] = useState<FeedState>("loading");
  /**
   * 롤링 정지 (WCAG 2.2.2 Pause, Stop, Hide).
   * 32초짜리 무한 애니메이션이라 "자동으로 시작해 5초를 넘기는 움직임"에 해당한다.
   * 호버 일시정지만 있었는데 **그건 포인터가 있는 사람만 쓸 수 있는 수단**이다 —
   * 키보드·터치 사용자에게는 멈출 방법이 없었다. 홍보 밴드에서 같은 이유로
   * 이미 한 번 버튼을 달았는데, 이쪽은 데이터가 0건이라 렌더된 적이 없어
   * 그때 함께 잡히지 않았다.
   */
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // 응답이 끝내 안 오면 "loading" 에 영영 머문다 — 상한을 두고 실패로 끝낸다.
    // 실패여도 그리는 것은 없다(아래 가드). 단정하지 않는 상태로 남을 뿐이다
    fetch("/api/feed/live", { signal: AbortSignal.timeout(10_000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { items?: FeedItem[]; state?: FeedState }) => {
        setItems(d.items ?? []);
        setState(d.state ?? (d.items?.length ? "ok" : "tooFew"));
      })
      .catch((e) => {
        console.error("[LiveFeed] 현황 조회 실패:", e);
        setState("error");
      });
  }, []);

  if (state !== "ok" || items.length === 0) return null;

  // 세로 롤링 — 목록을 2배로 이어붙여 -50% 이동을 무한 반복
  const doubled = [...items, ...items];

  return (
    <section className="border-t border-line py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          title="실시간 신청 현황"
          description="실제로 접수된 건만, 이름은 가려서 보여드려요"
        />

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            aria-pressed={paused}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            {paused ? (
              <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor" aria-hidden="true">
                <path d="M1 1l9 5-9 5z" />
              </svg>
            ) : (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
                <rect x="0" y="0" width="3.2" height="12" rx="1" />
                <rect x="6.8" y="0" width="3.2" height="12" rx="1" />
              </svg>
            )}
            {paused ? "다시 흐르게" : "목록 멈춤"}
          </button>
        </div>

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
            {/* 호버 정지는 포인터 전용이라 수단이 되지 못한다 — 위 버튼이 본 수단이다 */}
            <ul
              className="animate-feed-scroll group-hover:[animation-play-state:paused]"
              style={paused ? { animationPlayState: "paused" } : undefined}
            >
              {doubled.map((it, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[4.5rem_3.5rem_1fr_5rem_4rem] items-center gap-2 border-b border-line/60 px-4 py-3.5 text-sm transition-colors hover:bg-surface-muted sm:grid-cols-[6rem_5rem_1fr_6rem_5rem] sm:px-5"
                >
                  <span className="text-xs text-faint">
                    {it.applied_date}
                  </span>
                  <span>
                    {it.carrier && <CarrierBadge code={it.carrier} />}
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
