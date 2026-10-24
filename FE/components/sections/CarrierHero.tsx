import { SITE, type CarrierMenuItem, hasTel } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/**
 * 통신사 서브 히어로.
 *
 * 통신사색은 쓰지 않는다 — 헤더 밑 색 띠·광원·색 배지를 모두 걷어냈다.
 * 어느 통신사 페이지인지는 제목 글자가 말한다.
 */
export default function CarrierHero({ carrier }: { carrier: CarrierMenuItem }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 md:py-16">
        <span className="rounded-full border border-foreground px-3 py-1 text-sm font-bold text-foreground">
          {carrier.label}
        </span>
        <h1 className="text-3xl leading-tight font-black text-foreground md:text-[2.5rem]">
          {carrier.fullLabel} 가입 상담
        </h1>
        <p className="text-base text-muted md:text-lg">{carrier.tagline}</p>

        <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href="#consult"
            className="cta-fill inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-black transition-colors"
          >
            {SITE.hero.cta}
            <Icon name="arrowRight" size={18} />
          </a>
          {hasTel() && (
            <a
              href={`tel:${SITE.tel}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-7 py-3.5 font-black text-foreground transition-colors hover:border-foreground"
            >
              <Icon name="phone" size={18} />
              <span className="tabular">{SITE.tel}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
