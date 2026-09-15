import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CarrierHero from "@/components/sections/CarrierHero";
import PlanCards from "@/components/sections/PlanCards";
import PlanTable from "@/components/sections/PlanTable";
import PartnerCard from "@/components/sections/PartnerCard";
import LeadForm from "@/components/forms/LeadForm";
import { getPlansByCarrier } from "@/lib/plans";
import { CARRIER_MENU, SITE, carrierBySlug } from "@/lib/site-config";
import type { Carrier } from "@/lib/validation";

// 통신사 서브페이지 — docs/SPEC.md §1.2, 구성은 docs/DESIGN.md 시안 순서.
// 요금제 변경 반영을 위해 5분 재생성. 등록된 4개 slug 외에는 404.
export const revalidate = 300;
export const dynamicParams = false;

type Params = { params: Promise<{ carrier: string }> };

export function generateStaticParams() {
  return CARRIER_MENU.map((c) => ({ carrier: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { carrier: slug } = await params;
  const info = carrierBySlug(slug);
  if (!info) return {};
  return {
    title: `${info.fullLabel} 가입 상담`,
    description: `${info.label} 인터넷·TV 요금제와 약정 조건을 확인하고 상담을 신청하세요.`,
  };
}

export default async function CarrierPage({ params }: Params) {
  const { carrier: slug } = await params;
  const info = carrierBySlug(slug);
  if (!info) notFound();

  const plans = await getPlansByCarrier(info.code);

  return (
    <main>
      <CarrierHero carrier={info} />

      {plans.length > 0 ? (
        <>
          <PlanCards plans={plans} carrier={info} />
          <PlanTable plans={plans} />
        </>
      ) : (
        // 요금제 미등록 상태에서 빈 표를 보여주지 않는다 — 상담 유도로 대체
        <section className="py-16">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="mb-3 text-2xl font-black">
              {info.label} 요금제 안내를 준비하고 있습니다
            </h2>
            <p className="text-sm leading-relaxed text-gray-500">
              현재 적용 가능한 요금제와 조건은 상담을 통해 안내해 드립니다. 아래
              폼으로 신청해 주시면 확인 후 연락드리겠습니다.
            </p>
          </div>
        </section>
      )}

      <PartnerCard />

      <section id="consult" className="scroll-mt-20 bg-gray-50 py-16">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">
            {info.label} 가입 상담 신청
          </h2>
          <p className="mb-8 text-center text-sm text-gray-500">
            남겨주신 연락처로 확인 후 순차적으로 연락드립니다
          </p>
          <LeadForm variant="compact" defaultCarrier={info.code as Carrier} />
          <p className="mt-6 text-center text-sm text-gray-400">
            전화 상담:{" "}
            <a href={`tel:${SITE.tel}`} className="font-bold text-brand">
              {SITE.tel}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
