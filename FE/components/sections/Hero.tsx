"use client";

import Image from "next/image";
import { useState } from "react";
import { SITE, hasTel } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import LeadForm from "@/components/forms/LeadForm";

/** 폼 카드 아래 신뢰 문구 — 번호를 남길지 망설이는 순간에 읽히는 자리 */
const TRUST_CHIPS = [
  { icon: "bolt" as const, label: "접수 후 순차 연락" },
  { icon: "compare" as const, label: "통신사 4사 조건 비교" },
  { icon: "shield" as const, label: "연락처 암호화 보관" },
];

/**
 * 히어로 — 왼쪽은 브랜드 약속, 오른쪽은 접수 폼.
 *
 * 왼쪽 구성은 시안 `docs/태산넷 메인 좌측 영역.pdf` 를 옮긴 것이다.
 * 시안을 이미지로 붙이지 않고 텍스트 + CSS 로 다시 그린 이유 —
 * 문구 수정·모바일 줄바꿈·검색 노출이 전부 살아 있어야 하기 때문이다
 * (`SITE.hero.background` 주석의 "글자가 박힌 이미지는 넣지 마라"와 같은 이유).
 *
 * 시안에서 뽑은 값
 * - 글자색 `#1c2c24` → `--foreground`, 초록 `#24843c` → `--brand-dark`,
 *   좌상단 바 `#2c9c54` → `--brand`, 점 격자 `#c4dccc` → `--line-strong`
 * - 좌여백 8.8%, 제목:본문 잉크 높이 1.74:1, 블록 간격 5.3~7.9%
 */

/** 시안 우상단의 점 격자. 6×5 로 깔고 오른쪽 위로 흐려지게 둔다 */
function DotGrid() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1 right-1 hidden h-[90px] w-[108px] lg:block"
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--line-strong) 1.5px, transparent 1.6px)",
        backgroundSize: "18px 18px",
      }}
    />
  );
}

/** 마무리 문구 오른쪽으로 뻗는 점선 화살표 — 시선을 폼 쪽으로 넘긴다 */
function DashedArrow() {
  return (
    <span
      aria-hidden="true"
      className="hidden min-w-0 flex-1 items-center text-brand sm:flex"
    >
      {/* 선은 늘어나도 되지만 화살촉은 늘어나면 안 된다 — 둘을 분리한다 */}
      <span className="h-0 flex-1 border-t-2 border-dashed border-current" />
      <svg
        width="13"
        height="12"
        viewBox="0 0 13 12"
        className="-ml-px shrink-0"
        fill="currentColor"
      >
        <path d="M0 0.5 L12.5 6 L0 11.5 Z" />
      </svg>
    </span>
  );
}

/** 좁은 화면에서는 강제 줄바꿈을 풀고 자연 줄바꿈에 맡긴다 */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={line}>
          {line}
          {i < lines.length - 1 && (
            <>
              {" "}
              <br className="hidden md:inline" />
            </>
          )}
        </span>
      ))}
    </>
  );
}

export default function Hero() {
  const bg = SITE.hero.background;
  const scrim = SITE.hero.overlay;
  const p = SITE.heroPitch;
  const [carrier, setCarrier] = useState<string>("");

  return (
    <section
      id="consult"
      className="relative isolate scroll-mt-20 overflow-hidden bg-white"
    >
      {/* 배경 이미지를 쓰는 경우에만 깔린다. 흰 스크림을 덮어 본문이 검은 글씨로 읽히게 한다 */}
      {bg && (
        <>
          <Image
            src={bg}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
            style={{ objectPosition: SITE.hero.backgroundPosition }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background: `linear-gradient(100deg, rgba(255,255,255,${scrim}) 0%, rgba(255,255,255,${Math.min(scrim + 0.14, 1)}) 48%, rgba(255,255,255,${scrim * 0.72}) 100%)`,
            }}
          />
        </>
      )}

      {/* 면은 찬 뉴트럴로 아주 옅게만 깐다.
          초록 워시를 큰 면적에 깔면 "흰 바탕 + 초록 점" 구조가 무너진다
          (레퍼런스 실측: 배경 면적의 90%가 순백, 포인트색은 배경 상위 10위에 없음).
          초록은 좌상단 바·점격자·강조 글자·CTA 네 군데에만 남긴다. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #f7fafc 0%, #fdfefe 58%, #ffffff 100%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:py-16 lg:grid-cols-12 lg:gap-12 lg:py-16">
        {/* ── 왼쪽: 브랜드 약속 (시안) ──────────────────── */}
        <div className="relative flex flex-col lg:col-span-7">
          <DotGrid />

          {/* 시안 좌상단의 짧은 초록 바 */}
          <span
            aria-hidden="true"
            className="block h-1 w-12 rounded-full bg-brand"
          />

          <h1 className="mt-10 text-[1.75rem] leading-[1.3] font-black tracking-tight text-foreground md:mt-16 md:text-[2.25rem]">
            {p.titleParts[0]}
            <span className="text-brand-dark">{p.titleParts[1]}</span>
            {p.titleParts[2]}
          </h1>

          <p className="mt-6 text-base leading-[1.7] text-foreground md:mt-8 md:text-[1.0625rem]">
            <Lines lines={p.intro} />
          </p>

          {/* 이 두 줄이 카피에서 가장 센 부분이다 — 자신감의 근거라 굵게 간다 */}
          <p className="mt-6 text-base leading-[1.7] font-bold text-foreground md:text-[1.0625rem]">
            {p.emphasis.map(([accent, rest], i) => (
              <span key={accent}>
                <span className="text-brand-dark">{accent}</span>
                {rest}
                {i < p.emphasis.length - 1 && (
                  <>
                    {" "}
                    <br className="hidden md:inline" />
                  </>
                )}
              </span>
            ))}
          </p>

          <p className="mt-6 text-base leading-[1.7] text-foreground md:text-[1.0625rem]">
            <Lines lines={p.outro} />
          </p>

          <p className="mt-9 flex items-center gap-5 md:mt-11">
            <span className="shrink-0 text-2xl font-black tracking-tight text-brand-dark md:text-[2rem]">
              {p.closing}
            </span>
            <DashedArrow />
          </p>

          {/* 폼이 길어 좌측 열 아래에 372px 가 비었다 — 화면에서 가장 비싼 자리다.
              전화 수단과 신뢰 문구를 여기로 내려 채운다. `mt-auto` 로 바닥에 붙여,
              폼 높이가 바뀌어도 둘의 아랫선이 맞는다. 모바일에서는 세로로 쌓이므로
              여분 높이가 없어 그냥 마지막 문구 뒤에 따라붙는다. */}
          <div className="mt-10 lg:mt-auto lg:pt-12">
            {/* 대표번호가 설정되지 않았으면 전화 수단을 아예 내린다 —
                무효 번호로 연결되는 버튼은 없는 편이 낫다 */}
            {hasTel() && (
            <a
              href={`tel:${SITE.tel}`}
              className="inline-flex items-center gap-3 rounded-xl border-2 border-brand/30 bg-white px-6 py-3.5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand hover:shadow-card"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-light text-brand-deep">
                <Icon name="phone" size={18} />
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-bold text-muted">
                  통화가 편하시면
                </span>
                <span className="tabular mt-1 text-xl font-black text-brand-deep">
                  {SITE.tel}
                </span>
              </span>
            </a>
            )}

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2.5">
              {TRUST_CHIPS.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted"
                >
                  <Icon name={c.icon} size={15} className="text-brand-dark" />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 오른쪽: 접수 폼 ──────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="rounded-panel border-2 border-line bg-white p-6 shadow-lift md:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-dark text-white shadow-brand">
                <Icon name="clipboard" size={22} />
              </span>
              <p className="text-xl leading-snug font-black text-foreground">
                최적의 인터넷 요금 상담 받기
              </p>
            </div>

            <LeadForm
              variant="full"
              carrier={carrier}
              onCarrierChange={setCarrier}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
