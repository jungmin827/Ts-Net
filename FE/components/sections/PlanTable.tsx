import {
  CATEGORY_LABEL,
  formatContract,
  formatWon,
  groupByCategory,
  type Plan,
} from "@/lib/plans";
import { PLAN_DISCLAIMER } from "@/lib/site-config";

/** 요금제 표 — 카테고리(결합/인터넷/TV)별로 분리. 좁은 화면에서는 표만 가로 스크롤 */
export default function PlanTable({ plans }: { plans: Plan[] }) {
  const groups = groupByCategory(plans);
  if (groups.length === 0) return null;

  return (
    <section className="bg-gray-50 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-8 text-center text-2xl font-black md:text-3xl">
          요금제 안내
        </h2>

        <div className="flex flex-col gap-10">
          {groups.map(([category, list]) => (
            <div key={category}>
              <h3 className="mb-3 text-lg font-bold">
                {CATEGORY_LABEL[category]}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-brand-light text-left">
                      <th className="px-4 py-3 font-bold">상품명</th>
                      <th className="px-4 py-3 font-bold">속도</th>
                      <th className="px-4 py-3 text-right font-bold">월 요금</th>
                      <th className="px-4 py-3 text-center font-bold">약정</th>
                      <th className="px-4 py-3 text-right font-bold">
                        현금 사은품
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {p.speed ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-brand">
                          {formatWon(p.monthly_fee)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">
                          {formatContract(p.contract_months)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-accent">
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
          ))}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-gray-400">
          {PLAN_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
