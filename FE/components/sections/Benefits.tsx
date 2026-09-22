import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

export default function Benefits() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="WHY TS넷"
          title={
            <>
              <span className="text-brand">{SITE.name}</span>에서 신청해야 하는
              이유
            </>
          }
          description="상담부터 설치, 사은품 지급까지 과정을 투명하게 안내합니다"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 80}>
              {/* 카드 전체가 hover에서 떠오르고, 아이콘 타일은 색이 반전된다 */}
              <div className="group h-full rounded-panel border border-line bg-white p-6 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-lift">
                <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
                  <Icon name={b.icon as IconName} size={26} />
                </span>
                <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
                <p className="text-sm leading-relaxed text-muted">
                  {b.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
