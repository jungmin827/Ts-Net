"use client";

import Image from "next/image";
import { useState } from "react";
import { SITE } from "@/lib/site-config";
import LeadForm from "@/components/forms/LeadForm";

/**
 * 히어로 — 맨 위는 메인 포스터, 그 아래 통신사 포스터 위에 상담 폼 카드가 얹힌다.
 * 포스터 경로·제목·대체 텍스트는 `SITE.hero` 에만 있다.
 *
 * 메인 포스터는 16:9 라 아래 포스터들과 같은 폭(페이지 컨테이너 1120px)에 꽉 채운다.
 * 바탕은 페이지색으로 맞춰 두었으므로(`scripts/build-posters.mjs`) 경계 없이 이어진다.
 */
export default function Hero() {
  const poster = SITE.hero.poster;
  const backdrop = SITE.hero.formBackdrop;
  const [carrier, setCarrier] = useState<string>("");

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-4 md:pt-6">
        {/* 포스터가 곧 헤드라인이다. 글자는 그림 안에 있으므로
            제목은 h1 로, 나머지 문구는 alt 로 옮겨 둔다 — 보조기기·검색엔진이 같은 말을 읽는다 */}
        <h1 className="sr-only">{poster.title}</h1>
        <Image
          src={poster.src}
          alt={poster.alt}
          width={poster.width}
          height={poster.height}
          priority
          sizes="(min-width: 1152px) 1120px, 100vw"
          className="h-auto w-full"
        />
      </section>

      {/*
        상담 폼 — 두 번째(통신사) 포스터를 배경 레이어로 깔고, 폼 카드를 그 위
        오른쪽에 반투명으로 얹는다(포스터 왼쪽 제목은 가리지 않는다). `#consult` 앵커는 여기다.

        데스크톱(md+): 포스터를 화면 폭에 맞춰 원래 비율로 깔고 폼 카드를 그 위에 올린다.
        카드 뒤로 포스터 오른쪽 일러스트가 비친다 — 반투명 + 약한 블러.
        모바일: 360px 폭에서 겹치면 포스터가 통째로 가려지므로 포스터 → 폼으로 쌓는다.

        좁은 화면 폭 계산 — Turnstile 위젯이 바닥을 정한다.
        `size: "flexible"` 의 **최소 폭이 300px** 이라 그보다 좁아지지 않는다.
        거터는 페이지 공통 16px(`px-4`) 그대로 두고 **카드 패딩만** 12px 로 내리면
        360 − 32 − 24 − 4 = 300 으로 맞는다. 거터를 줄이면 좌측 정렬선이 어긋난다.
      */}
      <section
        id="consult"
        className="relative isolate mt-6 scroll-mt-20 md:mt-8"
      >
        {/* 모바일 — 그림으로 먼저 */}
        <Image
          src={backdrop.src}
          alt={backdrop.alt}
          width={backdrop.width}
          height={backdrop.height}
          sizes="100vw"
          className="h-auto w-full md:hidden"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-6 pb-4 md:py-10">
          {/* 데스크톱 — 배경 레이어. 아래 상담 방식·가입 절차 포스터와 같은 폭
              (페이지 컨테이너 1120px)에 원래 비율로 붙인다. 폼(약 900px)이 포스터(553px)
              보다 길어서 **세로 가운데**에 둔다 — 위에 붙이면 왼쪽 아래가 390px 비어
              위가 무거워 보였다. 남는 위아래는 포스터 바탕이 페이지색이라 이어져 보인다.
              (`fill` + `object-cover` 로 깔았더니 폼 높이에 맞추느라 1.5배로 확대·크롭돼
               일러스트가 비대해지고 왼쪽 제목 조각이 잘려 나왔다)
              display:none 인 쪽은 보조기기·로딩 모두 건너뛴다 */}
          <Image
            src={backdrop.src}
            alt={backdrop.alt}
            width={backdrop.width}
            height={backdrop.height}
            sizes="(min-width: 1152px) 1120px, 100vw"
            className="absolute inset-x-4 top-1/2 -z-10 hidden h-auto w-[calc(100%-2rem)] -translate-y-1/2 md:block"
          />
          <div className="rounded-panel border border-line-strong bg-surface p-3 shadow-card sm:p-6 md:ml-auto md:max-w-[460px] md:border-white/70 md:bg-surface/70 md:px-6 md:py-5 md:backdrop-blur-[3px]">
            <p className="mb-4 text-xl leading-snug font-black text-foreground">
              상담 신청
            </p>

            <LeadForm
              variant="full"
              dense
              carrier={carrier}
              onCarrierChange={setCarrier}
            />
          </div>
        </div>
      </section>
    </>
  );
}
