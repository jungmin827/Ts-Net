"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CARRIER_MENU } from "@/lib/site-config";
import type { CarrierPrice } from "@/lib/plans";

/**
 * 통신사별 월요금 막대. 뷰포트에 들어오면 0에서 제 높이까지 자란다.
 *
 * 막대 높이는 **퍼센트가 아니라 픽셀**로 준다. flex 컬럼 안의 퍼센트 높이는
 * 브라우저가 부모 높이를 확정하기 전에 0으로 접히는 경우가 있어
 * (실제로 4개 중 3개가 높이 0으로 렌더됐다) 트랙 높이를 상수로 두고 직접 계산한다.
 *
 * 색은 하나만 쓴다 — 가장 낮은 금액만 브랜드 그린, 나머지는 중립 회색.
 * 막대마다 통신사 색을 칠하면 무엇을 보라는 건지 알 수 없는 무지개가 된다.
 * 통신사 구분은 아래 라벨의 색 점이 맡는다.
 */
/**
 * 좁은 화면용 축약 통신사 표기.
 * 390px 에서 열 하나가 59px 인데 "KT스카이라이프"는 74px 라 잘린다.
 * `SKY` 는 CarrierHub 의 뱃지에서 이미 쓰는 표기라 새 약어를 만들지 않는다.
 */
const SHORT_LABEL: Record<string, string> = {
  KT: "KT",
  SK: "SK",
  LG: "LG",
  SKYLIFE: "SKY",
};

const TRACK = 232; // 막대가 자랄 수 있는 세로 길이(px)
const LABEL_GAP = 34; // 막대 위 금액이 들어갈 자리

export default function PriceBars({ items }: { items: CarrierPrice[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRun(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setRun(true);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const max = Math.max(...items.map((i) => i.monthly_fee));
  // 눈금이 만원 단위로 떨어지도록 3등분 기준으로 올려 잡는다.
  // (4등분하면 60,000 / 4 = 15,000 이 되어 "1.5만원" 같은 라벨이 생긴다)
  const step = 10000 * Math.ceil((max * 1.12) / 10000 / 3);
  const ceil = step * 3;
  const ticks = [3, 2, 1, 0].map((i) => step * i);
  const lowest = Math.min(...items.map((i) => i.monthly_fee));

  return (
    <div ref={ref} data-bar-run={run ? "true" : "false"} className="mt-8">
      <div className="flex gap-2 sm:gap-3">
        {/* y축 눈금 — 트랙과 같은 높이에서 균등 분할 */}
        <ol
          className="tabular flex w-12 shrink-0 flex-col justify-between text-right text-[11px] text-faint sm:w-14 sm:text-xs"
          style={{ height: TRACK, marginTop: LABEL_GAP }}
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <li key={t} className="-translate-y-1/2 leading-none">
              {t === 0 ? "0원" : `${t / 10000}만원`}
            </li>
          ))}
        </ol>

        <ol className="relative grid flex-1 grid-cols-4 gap-2 sm:gap-5">
          {/* 가로 그리드선 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 flex flex-col justify-between"
            style={{ top: LABEL_GAP, height: TRACK }}
          >
            {ticks.map((t) => (
              <span key={t} className="h-px w-full bg-line" />
            ))}
          </span>

          {items.map((it, i) => {
            const best = it.monthly_fee === lowest;
            const h = Math.round((it.monthly_fee / ceil) * TRACK);
            return (
              <li
                key={it.carrier}
                className="relative flex flex-col justify-end"
                style={
                  { height: TRACK + LABEL_GAP, "--bar-delay": `${i * 110}ms` } as CSSProperties
                }
              >
                <p
                  className={`bar-label tabular mb-2 text-center text-[0.8125rem] font-black sm:text-base ${
                    best ? "text-brand-dark" : "text-muted"
                  }`}
                >
                  {it.monthly_fee.toLocaleString()}
                  <span className="text-[0.6875rem] font-bold">원</span>
                </p>
                {/* 높이는 항상 제 값이다. 자라는 연출은 .bar-fill 애니메이션이 맡는다 */}
                <div
                  className={`bar-fill w-full shrink-0 rounded-t-md ${
                    // 막대는 '내용 이해에 필요한 그래픽'이라 흰 배경 대비 3:1 이 필요하다.
                    // --brand(2.88:1)·--line-strong(1.49:1) 은 둘 다 미달이었다.
                    // `--cta-to` 를 쓰다가 분리했다. CTA 면이 쨍한 `--brand`(#07b040)
                    // 로 바뀌었는데, 그 색은 흰 배경 대비 2.88:1 이라 **비문자 요소
                    // 3:1 기준(SC 1.4.11)에 미달**한다. 막대는 내용 이해에 필요한
                    // 그래픽이므로 버튼과 다른 축으로 둔다.
                    best ? "bg-brand-dark" : "bg-chart-neutral"
                  }`}
                  style={{ height: h }}
                />
              </li>
            );
          })}
        </ol>
      </div>

      {/* x축 — 통신사명 + TV 구성. 구성이 다르면 금액만 비교하는 건 오해를 부른다 */}
      <div className="mt-3 flex gap-2 sm:gap-3">
        <span className="w-12 shrink-0 sm:w-14" />
        <ol className="grid flex-1 grid-cols-4 gap-2 sm:gap-5">
          {items.map((it) => {
            const meta = CARRIER_MENU.find((c) => c.code === it.carrier);
            const best = it.monthly_fee === lowest;
            return (
              <li key={it.carrier} className="text-center">
                <span
                  className={`flex items-center justify-center gap-1 text-[11px] sm:gap-1.5 sm:text-sm ${
                    best ? "font-black text-foreground" : "font-bold text-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(${meta?.colorVar})` }}
                  />
                  {/* 보이는 쪽은 둘 다 aria-hidden 이고, 스크린리더는 sr-only 하나만 읽는다.
                      (`hidden sm:inline` 은 display:none 이라 AT 에도 안 읽히므로,
                       화면 크기와 무관하게 정식 명칭이 정확히 한 번 읽히게 하려면 이 구조여야 한다) */}
                  <span aria-hidden="true" className="sm:hidden">
                    {SHORT_LABEL[it.carrier] ?? it.carrier}
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">
                    {meta?.label ?? it.carrier}
                  </span>
                  <span className="sr-only">{meta?.label ?? it.carrier}</span>
                </span>
                {it.tv_option && (
                  <span className="mt-1 block text-[10px] leading-tight text-faint sm:text-[11px]">
                    {it.tv_option}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
