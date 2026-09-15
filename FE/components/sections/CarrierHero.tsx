import { SITE, type CarrierMenuItem } from "@/lib/site-config";

/** 통신사 서브 히어로 — 통신사 아이덴티티 컬러에서 브랜드 남색으로 이어지는 그라데이션 */
export default function CarrierHero({ carrier }: { carrier: CarrierMenuItem }) {
  return (
    // 베이스는 브랜드 남색으로 고정하고, 통신사 컬러는 상단 스트라이프·뱃지 액센트로만 쓴다.
    // 4개 서브페이지가 같은 브랜드 인상을 유지하면서 통신사 구분이 되도록.
    <section
      className="border-t-[6px] bg-gradient-to-br from-brand-dark via-brand to-brand/85 text-white"
      style={{ borderTopColor: `var(${carrier.colorVar})` }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 md:py-20">
        <span
          className="rounded-full px-3 py-1 text-sm font-bold"
          style={{ backgroundColor: `var(${carrier.colorVar})` }}
        >
          {carrier.label}
        </span>
        <h1 className="text-3xl leading-tight font-black md:text-4xl">
          {carrier.fullLabel} 가입 상담
        </h1>
        <p className="text-base text-white/85 md:text-lg">{carrier.tagline}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a
            href="#consult"
            className="rounded-lg bg-accent px-7 py-3.5 font-bold text-white transition-transform hover:scale-105"
          >
            {SITE.hero.cta}
          </a>
          <a
            href={`tel:${SITE.tel}`}
            className="rounded-lg border border-white/50 px-7 py-3.5 font-bold text-white hover:bg-white/10"
          >
            📞 {SITE.tel}
          </a>
        </div>
      </div>
    </section>
  );
}
