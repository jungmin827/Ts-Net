import { SITE, type CarrierMenuItem, hasTel } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/**
 * 통신사 서브 히어로.
 *
 * 메인과 같이 흰 면을 기본으로 둔다. 통신사 색은 상단 6px 스트라이프·뱃지·
 * 아주 옅은 광원 세 군데에만 쓴다 — 진초록 풀블리드 위에 얹었을 때보다
 * KT 빨강/SK 주황/LG 자홍/스카이라이프 파랑이 훨씬 또렷하게 구분된다.
 */
export default function CarrierHero({ carrier }: { carrier: CarrierMenuItem }) {
  return (
    <section
      className="relative isolate overflow-hidden border-t-[6px] bg-white"
      style={{ borderTopColor: `var(${carrier.colorVar})` }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            `radial-gradient(42rem 26rem at 88% -20%, color-mix(in srgb, var(${carrier.colorVar}) 13%, transparent), transparent 66%)`,
            "linear-gradient(180deg, #f7fafc 0%, #ffffff 62%)",
          ].join(","),
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 md:py-16">
        <span
          className="rounded-full px-3.5 py-1.5 text-sm font-black text-white shadow-card"
          style={{ backgroundColor: `var(${carrier.inkVar})` }}
        >
          {carrier.label}
        </span>
        <h1 className="text-3xl leading-tight font-black text-foreground md:text-[2.5rem]">
          {carrier.fullLabel} 가입 상담
        </h1>
        <p className="text-base text-muted md:text-lg">{carrier.tagline}</p>

        <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href="#consult"
            className="inline-flex items-center justify-center gap-2 rounded-xl cta-fill px-7 py-3.5 font-black shadow-cta transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0"
          >
            {SITE.hero.cta}
            <Icon name="arrowRight" size={18} />
          </a>
          {hasTel() && (
          <a
            href={`tel:${SITE.tel}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand/30 bg-white px-7 py-3.5 font-black text-brand-deep transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-brand hover:shadow-card active:translate-y-0"
          >
            <Icon name="phone" size={18} className="text-brand-dark" />
            <span className="tabular">{SITE.tel}</span>
          </a>
          )}
        </div>
      </div>
    </section>
  );
}
