import {
  CATEGORY_LABEL,
  formatContract,
  formatWon,
  groupByCategory,
  type Plan,
} from "@/lib/plans";
import { PLAN_DISCLAIMER } from "@/lib/site-config";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/** 요금제 표 — 카테고리(결합/인터넷/TV)별로 분리. 좁은 화면에서는 표만 가로 스크롤 */
export default function PlanTable({ plans }: { plans: Plan[] }) {
  const groups = groupByCategory(plans);
  if (groups.length === 0) return null;

  return (
    <section className="bg-brand-soft py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow="PRICING" title="요금제 안내" />

        <div className="flex flex-col gap-10">
          {groups.map(([category, list], gi) => (
            <Reveal key={category} delay={gi * 60}>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <span className="h-4 w-1 rounded-full bg-brand" />
                  {CATEGORY_LABEL[category]}
                </h3>
                <div className="overflow-x-auto rounded-panel border border-line bg-white shadow-card">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-brand-light/70 text-left">
                        <th className="px-5 py-3.5 font-bold">상품명</th>
                        <th className="px-5 py-3.5 font-bold">속도</th>
                        <th className="px-5 py-3.5 text-right font-bold">
                          월 요금
                        </th>
                        <th className="px-5 py-3.5 text-center font-bold">
                          약정
                        </th>
                        <th className="px-5 py-3.5 text-right font-bold">
                          현금 사은품
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-line/70 transition-colors hover:bg-brand-soft"
                        >
                          <td className="px-5 py-3.5 font-medium">{p.name}</td>
                          <td className="px-5 py-3.5 text-muted">
                            {p.speed ?? "-"}
                          </td>
                          <td className="px-5 py-3.5 text-right text-base font-black text-brand">
                            {formatWon(p.monthly_fee)}
                          </td>
                          <td className="px-5 py-3.5 text-center text-muted">
                            {formatContract(p.contract_months)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-accent">
                            {p.gift_amount == null
                              ? "-"
                              : `최대 ${formatWon(p.gift_amount)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          {PLAN_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
