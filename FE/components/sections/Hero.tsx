"use client";

import Image from "next/image";
import { useState } from "react";
import { SITE, hasTel } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import LeadForm from "@/components/forms/LeadForm";

/** 전화번호 아래 짧은 안심 문구 — 번호를 남길지 망설이는 순간에 읽힌다 */
const TRUST_CHIPS = [
  { icon: "phone" as const, label: "남겨주시면 순서대로 전화드려요" },
  { icon: "check" as const, label: "4개 통신사 다 봐드려요" },
  { icon: "shield" as const, label: "번호는 암호화해서 보관해요" },
];

/**
 * 히어로 — 왼쪽은 상담원의 첫마디, 오른쪽은 접수 폼.
 * 카피는 `SITE.heroPitch` 에만 있다. 장식(점 격자·점선 화살표)은 걷어냈다 —
 * 오프화이트 바탕에 검은 글자만으로 위계를 만든다.
 */

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
      className="relative isolate scroll-mt-20 overflow-hidden border-b border-line"
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

      {/*
        좁은 화면 폭 계산 — Turnstile 위젯이 바닥을 정한다.

        `size: "flexible"` 의 **최소 폭이 300px** 이라 그보다 좁아지지 않는다.
        360px 기기에서 거터 16px + 카드 패딩 24px + 테두리 2px 를 양쪽에 두면
        카드가 352px 를 요구해 뷰포트를 8px 넘겼다(실측).
        처음에는 **거터**를 12px 로 줄였는데 그건 틀린 선택이었다 — 이 페이지의
        다른 컨테이너 19곳은 전부 `px-4` 라, 히어로만 4px 밖으로 튀어나와
        **모바일 전 구간(320~639px)에서 좌측 정렬선이 어긋났다.**
        헤더 로고(left 16)와 히어로 H1(left 12)이 어긋나는 걸 퍼스트뷰에서 본다.
        거터는 16px 그대로 두고 **카드 패딩만** 12px 로 내리면
        360 − 32 − 24 − 4 = 300 으로 **같은 결과**가 나온다. 정렬선을 깨지 않는 쪽을 쓴다.

        `min-w-0` 는 안전장치다 — 그리드 항목의 기본 `min-width: auto` 때문에
        안쪽에 안 줄어드는 요소가 하나라도 생기면 **트랙 전체가 밀려** 페이지에
        가로 스크롤이 생긴다. 0 으로 두면 페이지 대신 그 요소만 넘친다.
      */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:py-16 lg:grid-cols-12 lg:gap-12 lg:py-16">
        {/* ── 왼쪽: 상담원의 첫마디 ──────────────────── */}
        <div className="flex min-w-0 flex-col lg:col-span-7">
          <p className="text-sm font-bold text-muted">인터넷 · TV 가입 상담</p>

          <h1 className="mt-4 text-[1.875rem] leading-[1.3] font-black tracking-tight text-foreground md:text-[2.5rem]">
            {p.titleParts[0]}
            <br className="hidden md:inline" />
            <span className="underline decoration-[3px] underline-offset-[6px]">
              {p.titleParts[1]}
            </span>
            {p.titleParts[2]}
          </h1>

          <p className="mt-7 text-base leading-[1.75] text-foreground md:text-[1.0625rem]">
            <Lines lines={p.intro} />
          </p>

          <ul className="mt-6 flex flex-col gap-2 border-l-2 border-foreground pl-4 text-base leading-[1.7] md:text-[1.0625rem]">
            {p.emphasis.map(([accent, rest]) => (
              <li key={accent}>
                <strong className="font-black">{accent}</strong>
                {rest}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-base leading-[1.75] text-muted md:text-[1.0625rem]">
            <Lines lines={p.outro} />
          </p>

          <p className="mt-8 text-xl font-black tracking-tight md:text-2xl">
            {p.closing}
            <span aria-hidden="true" className="ml-2 hidden lg:inline">→</span>
          </p>

          {/* 폼이 왼쪽보다 길어서 남는 아래 공간에 전화 수단과 안심 문구를 붙인다 */}
          <div className="mt-8 lg:mt-auto lg:pt-10">
            {/* 대표번호가 설정되지 않았으면 전화 수단을 아예 내린다 */}
            {hasTel() && (
              <a
                href={`tel:${SITE.tel}`}
                className="inline-flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-5 py-3 transition-colors hover:border-foreground"
              >
                <Icon name="phone" size={18} />
                <span className="flex flex-col items-start leading-none">
                  <span className="text-xs font-bold text-muted">
                    통화가 편하시면
                  </span>
                  <span className="tabular mt-1 text-xl font-black">
                    {SITE.tel}
                  </span>
                </span>
              </a>
            )}

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
              {TRUST_CHIPS.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted"
                >
                  <Icon name={c.icon} size={15} className="text-foreground" />
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── 오른쪽: 접수 폼 ──────────────────────────── */}
        <div className="min-w-0 lg:col-span-5">
          <div className="rounded-panel border border-line-strong bg-surface p-3 shadow-card sm:p-6 md:p-7">
            <div className="mb-5">
              <p className="text-xl leading-snug font-black text-foreground">
                상담 신청
              </p>
              <p className="mt-1 text-sm text-muted">
                남겨주시면 상담사가 직접 전화드려요
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
