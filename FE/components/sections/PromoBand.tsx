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
 * - **기본 상태는 완성된 문장이다.** 순환은 마운트 뒤에만 시작한다.
 *   예전에는 SSR 이 `frames[0]` 한 장만 그렸다. 스크립트가 막히면 그 한 조각이
 *   영구히 남아, 문장의 앞부분만 덩그러니 놓인 화면이 된다
 *   (완성 문장은 `sr-only` 에만 있어 눈으로는 볼 수 없었다).
 *   화면에 보이는 기본값은 언제나 "다 보여준 상태"여야 하고,
 *   애니메이션은 그 위에 얹는 것이어야 한다.
 */
export default function PromoBand() {
  const { frames, holdMs, enabled } = PROMO_BAND;
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  /**
   * 자동 순환 정지 수단 (WCAG 2.2.2 Pause, Stop, Hide).
   * 5초 넘게 자동으로 바뀌는 내용에는 멈출 방법이 있어야 한다.
   * 이 밴드는 2.4초마다 무한히 바뀌는데 그동안 멈출 수가 없었다.
   */
  const [paused, setPaused] = useState(false);
  /** 하이드레이션 완료 여부. false 인 동안에는 순환 없이 전체 문장을 보여준다 */
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!mounted || reduced || paused || frames.length < 2) return;
    const id = window.setInterval(
      () => setIndex((v) => (v + 1) % frames.length),
      holdMs,
    );
    return () => window.clearInterval(id);
  }, [mounted, reduced, paused, frames.length, holdMs]);

  if (!enabled || frames.length === 0) return null;

  const sentence = frames
    .map((f) => f.words.map((w) => w.t).join(" "))
    .join(" ");
  const frame = frames[index];
  // tone 은 이제 면의 명암이 아니라 옅은 틴트 유무만 가른다.
  // 예전엔 "brand" 프레임이 진초록 풀블리드였는데, 2.4초마다 퍼스트뷰 바로 아래가
  // 통째로 초록으로 덮여 흰 면 기조가 무너졌다. 색은 강조 단어에만 남긴다.
  const tinted = frame.tone === "brand";
  /** 순환을 돌리지 않는 상태 — 마운트 전이거나 모션 최소화 설정 */
  const still = !mounted || reduced;

  return (
    <section
      aria-label="안내 문구"
      className="relative overflow-hidden border-y border-line text-brand-deep transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        backgroundImage: tinted
          ? "linear-gradient(100deg, var(--surface-muted) 0%, #fff 55%, var(--surface-muted) 100%)"
          : "linear-gradient(100deg, #fff 0%, var(--surface-muted) 50%, #fff 100%)",
      }}
    >
      {/* 스크린리더용 — 완성된 문장 한 줄 */}
      <p className="sr-only">{sentence}</p>

      <div
        className="relative mx-auto flex max-w-6xl items-center px-4"
        style={{ minHeight: "clamp(5.5rem, 11vw, 8.5rem)" }}
      >
        {still ? (
          // 순환 없이 전체 문장을 한 줄로 (하이드레이션 전 · 모션 최소화)
          <p aria-hidden="true" className="font-display py-7 text-xl leading-tight md:text-3xl">
            {sentence}
          </p>
        ) : (
          <p
            aria-hidden="true"
            // key 가 바뀌면 자식 span 들이 새로 마운트되며 등장 애니메이션이 다시 돈다
            key={index}
            className="font-display flex flex-wrap items-baseline gap-x-[0.35em] gap-y-1 py-6 text-[clamp(1.75rem,5.2vw,3.5rem)] leading-[1.15] tracking-tight"
          >
            {frame.words.map((w, wi) => (
              <span
                key={`${index}-${wi}`}
                className="animate-promo-word inline-block"
                style={{ animationDelay: `${wi * 170}ms` }}
              >
                {/* 강조는 색을 바꾸는 대신 초록 마커를 깐다.
                    연초록 글자를 연초록 면에 얹었더니 강조 단어가 오히려 가장
                    흐리게 읽혔다 (대비 2.6:1). 지금은 강조어가 가장 진하다 */}
                <span
                  className={w.accent ? "px-1" : undefined}
                  style={
                    w.accent
                      ? {
                          backgroundImage:
                            "linear-gradient(transparent 62%, var(--brand-light) 62%, var(--brand-light) 94%, transparent 94%)",
                        }
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
        {!still && frames.length > 1 && (
          <span className="ml-auto flex shrink-0 items-center gap-2.5 pl-4 sm:gap-3 sm:pl-6">
            {frames.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full bg-brand transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  i === index ? "w-7" : "w-2 opacity-25"
                }`}
              />
            ))}
            {/* 이 버튼만 aria-hidden 밖에 있어야 하므로, 바깥 래퍼의
                aria-hidden 을 믿지 말고 여기서 직접 레이블을 단다 */}
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              aria-label={paused ? "문구 자동 넘김 다시 시작" : "문구 자동 넘김 멈춤"}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-white text-brand-dark transition-colors hover:border-brand"
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
            </button>
          </span>
        )}
      </div>
    </section>
  );
}
