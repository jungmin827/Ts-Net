"use client";

import { useEffect, useState } from "react";
import { PROMO_BAND } from "@/lib/site-config";

/**
 * 풀폭 홍보 카피 밴드.
 *
 * 프레임이 순차 교체되며 한 문장이 완성된다. 프레임 안의 단어들은 약간씩 시차를 두고
 * 들어와, 한 장 안에서도 "단어가 하나씩 놓이는" 느낌을 낸다.
 *
 * 구현 메모
 * - 문구·속도·색면은 전부 `lib/site-config.ts` 의 `PROMO_BAND` 에서 온다.
 *   이 파일에는 카피가 한 글자도 없다 (운영자가 설정값만 고쳐 교체 가능).
 * - 모션은 transform/opacity 만 쓴다. blur 필터를 쓰면 초대형 글자에서
 *   합성 비용이 폭증한다 (모바일 성능 요구사항).
 * - 프레임 높이를 고정해 교체 시 레이아웃이 튀지 않게 한다.
 * - prefers-reduced-motion 이면 회전을 멈추고 전체 문장을 한 번에 보여준다.
 *   자동 순환 자체가 모션이라 duration 만 0 으로 줄이는 걸론 부족하다.
 * - 스크린리더에는 완성된 문장 한 줄만 읽힌다 (애니메이션 레이어는 aria-hidden).
 */
export default function PromoBand() {
  const { frames, holdMs, enabled } = PROMO_BAND;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced || frames.length < 2) return;
    const id = window.setInterval(
      () => setIndex((v) => (v + 1) % frames.length),
      holdMs,
    );
    return () => window.clearInterval(id);
  }, [reduced, frames.length, holdMs]);

  if (!enabled || frames.length === 0) return null;

  const sentence = frames
    .map((f) => f.words.map((w) => w.t).join(" "))
    .join(" ");
  const frame = frames[index];
  const isBrand = frame.tone === "brand";

  return (
    <section
      aria-label="안내 문구"
      className={`relative overflow-hidden transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        // 밝은 면은 위아래 경계선을 줘야 흰 섹션들 사이에서 "밴드"로 읽힌다
        isBrand ? "text-white" : "border-y border-line text-brand-deep"
      }`}
      style={{
        backgroundImage: isBrand
          ? [
              "radial-gradient(40rem 16rem at 18% -40%, rgba(125,165,255,0.35), transparent 65%)",
              "linear-gradient(100deg, var(--brand-deep) 0%, var(--brand-dark) 60%, var(--brand) 100%)",
            ].join(",")
          : [
              "radial-gradient(36rem 14rem at 82% 140%, rgba(43,80,200,0.16), transparent 65%)",
              "linear-gradient(100deg, var(--brand-light) 0%, var(--brand-soft) 48%, var(--brand-light) 100%)",
            ].join(","),
      }}
    >
      {/* 얇은 세로 격자 — 남색 면에서만 쓴다.
          밝은 면에 깔면 선이 글자보다 눈에 띄어 표처럼 읽혔다 (1차 검증) */}
      {isBrand && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "linear-gradient(to right, transparent, #000 25%, #000 75%, transparent)",
          }}
        />
      )}

      {/* 스크린리더용 — 완성된 문장 한 줄 */}
      <p className="sr-only">{sentence}</p>

      <div
        aria-hidden="true"
        className="relative mx-auto flex max-w-6xl items-center px-4"
        style={{ minHeight: "clamp(7rem, 15vw, 11.5rem)" }}
      >
        {reduced ? (
          // 모션 최소화 — 순환 없이 전체 문장을 한 줄로
          <p className="py-8 text-2xl leading-tight font-black md:text-4xl">
            {sentence}
          </p>
        ) : (
          <p
            // key 가 바뀌면 자식 span 들이 새로 마운트되며 등장 애니메이션이 다시 돈다
            key={index}
            className="flex flex-wrap items-baseline gap-x-[0.35em] gap-y-1 py-6 text-[clamp(2.25rem,7.5vw,5.25rem)] leading-[1.15] font-black tracking-tight"
          >
            {frame.words.map((w, wi) => (
              <span
                key={`${index}-${wi}`}
                className="animate-promo-word inline-block"
                style={{ animationDelay: `${wi * 170}ms` }}
              >
                <span
                  className={
                    w.accent
                      ? isBrand
                        ? "text-accent"
                        : "text-brand"
                      : undefined
                  }
                >
                  {w.t}
                </span>
              </span>
            ))}
          </p>
        )}

        {/* 진행 눈금 — 이 밴드가 "한 문장을 나눠 보여주는 중"임을 알린다.
            레퍼런스엔 없지만, 없으면 문장 일부만 깜빡이는 것처럼 읽힌다 */}
        {!reduced && frames.length > 1 && (
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 pl-6 sm:flex">
            {frames.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  i === index
                    ? `w-7 ${isBrand ? "bg-white" : "bg-brand"}`
                    : `w-2 ${isBrand ? "bg-white/35" : "bg-brand/25"}`
                }`}
              />
            ))}
          </span>
        )}
      </div>
    </section>
  );
}
