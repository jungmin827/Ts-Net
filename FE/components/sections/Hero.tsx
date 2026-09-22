import { SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

const TRUST_CHIPS = [
  { icon: "bolt" as const, label: "접수 후 순차 연락" },
  { icon: "compare" as const, label: "통신사 4사 조건 비교" },
  { icon: "shield" as const, label: "연락처 암호화 보관" },
];

/**
 * 히어로 — 단색 그라데이션 한 장이던 것을 레이어로 쌓아 깊이를 만든다.
 * (1) 사선 그라데이션 → (2) 두 개의 방사형 광원 → (3) 격자 패턴 → (4) 하단 페이드
 * 배경 이미지를 넣을 경우 (1)과 (2) 사이 레이어로 삽입한다.
 */
export default function Hero() {
  return (
    // 광원은 blur 필터가 아니라 radial-gradient 레이어로 만든다.
    // 같은 결과를 내면서 필터 합성 비용이 없다 (모바일 성능 요구사항).
    <section
      className="relative isolate overflow-hidden text-white"
      style={{
        backgroundImage: [
          "radial-gradient(55rem 38rem at 88% -12%, rgba(125,165,255,0.45), transparent 62%)",
          "radial-gradient(42rem 32rem at -8% 118%, rgba(88,120,255,0.38), transparent 62%)",
          "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-dark) 52%, var(--brand) 100%)",
        ].join(","),
      }}
    >
      {/* 격자 — 아주 옅게 깔아 면이 비어 보이지 않게 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm">
          <Icon name="bolt" size={14} />
          KT · SK · LG · KT스카이라이프
        </span>

        <h1 className="mt-5 max-w-3xl text-[2rem] leading-[1.25] font-black md:text-5xl md:leading-[1.2]">
          {SITE.hero.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-white/80 md:text-xl">
          {SITE.hero.sub}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="#consult"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-4 text-lg font-black text-white shadow-accent transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-float active:translate-y-0"
          >
            {SITE.hero.cta}
            <Icon name="arrowRight" size={20} />
          </a>
          <a
            href={`tel:${SITE.tel}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-lg font-bold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/20 active:translate-y-0"
          >
            <Icon name="phone" size={19} />
            {SITE.tel}
          </a>
        </div>

        {/* 신뢰 칩 — 히어로 하단의 빈 공간을 메우면서 불안 요소를 미리 해소 */}
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
          {TRUST_CHIPS.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-2 text-sm font-medium text-white/85"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/15">
                <Icon name={c.icon} size={16} />
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
