import { SITE, type CarrierMenuItem } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/**
 * 통신사 서브 히어로.
 * 베이스는 브랜드 남색으로 고정하고, 통신사 컬러는 상단 스트라이프·뱃지 액센트로만 쓴다.
 * 4개 서브페이지가 같은 브랜드 인상을 유지하면서 통신사 구분이 되도록 (docs/DESIGN.md).
 */
export default function CarrierHero({ carrier }: { carrier: CarrierMenuItem }) {
  return (
    <section
      className="relative isolate overflow-hidden border-t-[6px] text-white"
      style={{
        borderTopColor: `var(${carrier.colorVar})`,
        // 우상단 광원만 통신사 색을 옅게 섞어 페이지마다 미묘한 차이를 준다
        backgroundImage: [
          `radial-gradient(42rem 30rem at 90% -18%, color-mix(in srgb, var(${carrier.colorVar}) 32%, transparent), transparent 62%)`,
          "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-dark) 55%, var(--brand) 100%)",
        ].join(","),
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 40% 40%, #000 40%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 md:py-20">
        <span
          className="rounded-full px-3.5 py-1.5 text-sm font-black shadow-card"
          style={{ backgroundColor: `var(${carrier.colorVar})` }}
        >
          {carrier.label}
        </span>
        <h1 className="text-3xl leading-tight font-black md:text-[2.75rem]">
          {carrier.fullLabel} 가입 상담
        </h1>
        <p className="text-base text-white/80 md:text-lg">{carrier.tagline}</p>

        <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href="#consult"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-3.5 font-black text-white shadow-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-float active:translate-y-0"
          >
            {SITE.hero.cta}
            <Icon name="arrowRight" size={18} />
          </a>
          <a
            href={`tel:${SITE.tel}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 font-bold backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0"
          >
            <Icon name="phone" size={18} />
            {SITE.tel}
          </a>
        </div>
      </div>
    </section>
  );
}
