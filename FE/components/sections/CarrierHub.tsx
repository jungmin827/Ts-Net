import Link from "next/link";
import { CARRIER_MENU } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/** 메인의 통신사 4카드 허브 — 서브페이지 진입점. 카드마다 통신사 아이덴티티 컬러 */
export default function CarrierHub() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="CARRIERS"
          title="통신사별 상품 보기"
          description="요금제와 약정 조건을 비교하고 원하는 통신사로 상담을 신청하세요"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARRIER_MENU.map((c, i) => (
            <Reveal key={c.slug} delay={i * 70}>
              {/* 상단 컬러 바가 hover에서 두꺼워지며 해당 통신사를 강조한다 */}
              <Link
                href={`/${c.slug}`}
                className="group relative flex h-full flex-col gap-2 overflow-hidden rounded-panel border border-line bg-white p-6 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-lift"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5"
                  style={{ backgroundColor: `var(${c.colorVar})` }}
                />
                <span
                  className="mb-1 flex size-10 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{ backgroundColor: `var(${c.colorVar})` }}
                  aria-hidden="true"
                >
                  {c.code === "SKYLIFE" ? "SKY" : c.code}
                </span>
                <span className="text-lg font-black text-foreground">
                  {c.label}
                </span>
                <span className="text-sm leading-relaxed text-muted">
                  {c.tagline}
                </span>
                <span className="mt-3 flex items-center gap-1 text-sm font-bold text-brand">
                  상품 보기
                  <Icon
                    name="arrowRight"
                    size={16}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
