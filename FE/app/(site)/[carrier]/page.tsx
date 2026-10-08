import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CarrierHero from "@/components/sections/CarrierHero";
import PlanCalculator from "@/components/sections/PlanCalculator";
import PlanCards from "@/components/sections/PlanCards";
import PlanTable from "@/components/sections/PlanTable";
import PartnerCard from "@/components/sections/PartnerCard";
import PlanNotice from "@/components/sections/PlanNotice";
import LeadForm from "@/components/forms/LeadForm";
import { getPlansByCarrier, tableRows } from "@/lib/plans";
import { CARRIER_MENU, SITE, carrierBySlug, hasTel } from "@/lib/site-config";
import type { Carrier } from "@/lib/validation";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

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
  /*
   * 메타 설명. 한국어는 검색결과에서 약 80자까지 보인다.
   *
   * ⚠ **`tagline` 을 쓰지 않는다.** 한동안 붙여 두었는데, 그건
   *   "전국 커버리지와 안정적인 품질"(KT) · "IPTV 콘텐츠 구성이 다양한 편"(LG)
   *   처럼 **비교 대상 없이 쓴 우위 서술**이고 근거 문서가 저장소에 없다.
   *   화면 안의 작은 부제와 검색결과 스니펫은 같은 문자열이라도 무게가 다르다 —
   *   후자는 사업자가 외부에 한 표시 광고로 읽힌다.
   *   CLAUDE.md 는 그 문구들을 "중립 플레이스홀더"로 두라고 적었지,
   *   색인되는 자리에 올리라고 한 적이 없다.
   *
   *   네 페이지가 비슷해지는 것은 감수한다. **다르게 만들려고 근거 없는 말을
   *   넣는 것보다 같아 보이는 편이 낫다.** 통신사명과 상품군이 이미 다르다.
   *
   * ⚠ `fullLabel` 은 "KT 인터넷·IPTV" 처럼 이미 상품군을 포함한다 —
   *   여기에 "인터넷·TV" 를 또 붙이면 "KT 인터넷·IPTV 인터넷·TV" 가 된다.
   */
  return {
    title: `${info.fullLabel} 가입 상담`,
    // ⚠ "휴대폰 1회선 결합" 을 여기 적지 않는다.
    //   SKYLIFE 페이지에는 휴대폰 상품이 0개이고, 그 전제가 실제로 적용되는지
    //   교차검증에서 **미확인**으로 남았다(docs/PRICE_CROSSCHECK_2026-10-08.md 6절).
    //   네 페이지가 같은 문장을 쓰는데 그중 하나에서 사실이 아닐 수 있는 전제는
    //   공통 문구에서 뺀다. 3년 약정(contract_months=36)과 VAT 포함은 전 행 확인됐다.
    //   결합 전제를 포함한 전체 고지는 페이지 안 `PRICE_BASIS_LINE` 이 맡는다.
    description:
      `${info.label} 인터넷·TV 요금제를 3년 약정·VAT 포함 기준으로 정리했습니다. ` +
      `약정·설치비·사은품 조건도 함께 확인하세요.`,
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
          {/* 고르면 바로 계산 → 추천 구성 → 전체 표 순서.
              찾아보기 전에 "내 경우 얼마인지"를 먼저 답해준다 */}
          <PlanCalculator plans={plans} carrier={info} />
          <PlanCards plans={plans} carrier={info} />
          {/* 추천 카드로 이미 보여준 행은 표에서 빼 같은 금액이 두 번 나오지 않게 한다 */}
          <PlanTable plans={tableRows(plans)} />
        </>
      ) : (
        // 요금제 미등록 상태에서 빈 표를 보여주지 않는다 — 상담 유도로 대체
        <section className="bg-white py-16 md:py-20">
          <div className="mx-auto max-w-2xl px-4">
            <div className="rounded-panel border border-dashed border-line-strong bg-surface-muted p-10 text-center">
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand-deep">
                <Icon name="clipboard" size={26} />
              </span>
              <h2 className="mb-3 text-xl font-black md:text-2xl">
                {info.label} 요금제 안내를 준비하고 있습니다
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                현재 적용 가능한 요금제와 조건은 상담을 통해 안내해 드립니다.
                아래 폼으로 신청해 주시면 확인 후 연락드리겠습니다.
              </p>
            </div>
          </div>
        </section>
      )}

      <PartnerCard />

      {/* 요금 고지 — 금액을 보여준 페이지와 같은 화면에 전제·추가비용·해지조건을 둔다.
          요금 미등록 통신사에서는 요금 전제 블록을 빼고 나머지만 렌더한다 */}
      <PlanNotice hasPrices={plans.length > 0} />

      <section
        id="consult"
        className="scroll-mt-24 bg-surface-muted py-16 md:py-20"
      >
        {/*
          히어로와 같은 폭 계산을 여기에도 적용한다.
          `LeadForm` 안의 Turnstile 은 `size:"flexible"` 이어도 **최소 300px** 이다.
          거터 16 + 카드 패딩 24 + 테두리 1 을 양쪽에 두면 360px 기기에서
          내부가 278px 밖에 안 남아 위젯이 22px 잘린다.
          거터는 **다른 섹션과 같은 16px 로 둔다** — 히어로에서 거터를 줄였다가
          좌측 정렬선이 4px 어긋나는 일을 겪었다. 패딩만 12px 로 내리면
          328 − 24 − 2 = 302px 로 같은 결과다.

          ⚠ 히어로만 고치고 여기를 놓쳤었다. 그때 "통신사 4페이지 360px 넘침 0건"
            으로 통과시켰는데, 그 0 을 만든 건 같은 작업에서 넣은
            `overflow-x-auto` 래퍼였다 — **내가 넣은 안전장치가 내 측정 지표를
            무력화한 것**이다. 페이지 넘침이 아니라 **위젯이 제 칸에 들어가는지**를
            따로 재야 한다.
        */}
        <div className="mx-auto max-w-xl px-4">
          <div className="rounded-panel border border-line bg-white p-3 shadow-float sm:p-6 md:p-8">
            <SectionHeading
              title={`${info.label} 가입 상담 신청`}
              description="남겨주신 연락처로 확인 후 순차적으로 연락드립니다"
            />
            <LeadForm variant="compact" defaultCarrier={info.code as Carrier} />
            {hasTel() && (
              <p className="mt-6 text-center text-sm text-muted">
                전화 상담{" "}
                <a
                  href={`tel:${SITE.tel}`}
                  className="font-black text-brand-dark hover:underline"
                >
                  {SITE.tel}
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
