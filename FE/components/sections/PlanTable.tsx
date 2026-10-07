import {
  CATEGORY_LABEL,
  formatContract,
  formatWon,
  groupByCategory,
  groupBySpeed,
  minMonthlyFee,
  type Plan,
  type PlanCategory,
} from "@/lib/plans";
import {
  PRICE_BASIS_LINE,
  PRICE_SOURCE_LINE,
  TABLE_SCROLL_HINT,
} from "@/lib/legal-notices";
import { PLAN_DISCLAIMER } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 요금제 표 — 카테고리(결합/인터넷/TV/휴대폰)별로 분리하고,
 * 행이 많은 카테고리는 **인터넷 속도별로 접는다**.
 *
 * 접기를 `<details name>` 네이티브 아코디언으로 구현한 이유 —
 * 요금은 "JS 가 돌아야 보이는 정보" 가 되면 안 된다. `<details>` 는 스크립트 없이
 * 열고 닫히고, 접힌 행도 HTML 안에 그대로 있어서 검색·브라우저 찾기·크롤러에 잡힌다.
 * `name` 을 주면 한 카테고리에서 한 묶음만 열린 상태가 유지된다(미지원 브라우저는
 * 여러 개가 같이 열릴 뿐 정보가 사라지지 않는다).
 *
 * 열 구성은 **월 요금을 두 번째 열**로 둔다. 좁은 화면에서 가로 스크롤 전에
 * 보이는 두 열이 `상품명 / 월 요금` 이어야 가격 페이지로서 성립한다.
 *
 * TV 구성 열은 **정보를 더할 때만** 세운다.
 * 통신사에 따라 상품명이 이미 구성을 품고 있다(`100M+WIFI+TV베이직`).
 * 그럴 때 열을 하나 더 세우면 같은 글자가 한 줄에 두 번 나오고,
 * 모바일에서는 표 최소 폭만 130px 늘어 가로 스크롤이 길어진다.
 * 반대로 이름이 구성을 말해주지 않는 통신사에서는, 설명문까지 비어 있으면
 * (레퍼런스 카피 제거 후 전부 NULL) 금액이 다른 행 여럿만 남고
 * **왜 다른지가 화면 어디에도 없다.** 그 경우에만 DB 값을 열로 세운다.
 */

/** 이 행 수를 넘고 속도 축이 2개 이상일 때만 속도별로 접는다 */
const ACCORDION_MIN_ROWS = 6;

interface Cols {
  speed: boolean;
  /** TV 구성 열. 상품명이 이미 그 구성을 품고 있으면 중복이므로 숨긴다 */
  tv: boolean;
  /** 할인 전 금액 열. 전 행이 할인 전·후가 같으면 숨긴다 */
  discount: boolean;
  gift: boolean;
}

/** 열 폭 합으로 표 최소 폭을 구한다 — 숨긴 열만큼 가로 스크롤이 줄어든다 */
const COL_WIDTH = {
  name: 220,
  fee: 120,
  discount: 110,
  speed: 90,
  tv: 130,
  contract: 90,
  gift: 120,
} as const;

function tableMinWidth(cols: Cols): number {
  return (
    COL_WIDTH.name +
    COL_WIDTH.fee +
    COL_WIDTH.contract +
    (cols.discount ? COL_WIDTH.discount : 0) +
    (cols.speed ? COL_WIDTH.speed : 0) +
    (cols.tv ? COL_WIDTH.tv : 0) +
    (cols.gift ? COL_WIDTH.gift : 0)
  );
}

function PlanRows({ list, cols }: { list: Plan[]; cols: Cols }) {
  return (
    // 모바일에서 표가 화면보다 넓다. 스크롤 가능함을 글자(힌트)와 우측 페이드 둘로 알린다
    <div className="relative">
      <p className="flex items-center gap-1.5 px-5 pt-3 text-xs text-muted md:hidden">
        <Icon name="arrowRight" size={14} className="shrink-0 text-brand-dark" />
        {TABLE_SCROLL_HINT}
      </p>
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm"
          style={{ minWidth: `${tableMinWidth(cols)}px` }}
        >
          <thead>
            <tr className="border-b border-line bg-surface-muted text-left">
              <th scope="col" className="px-5 py-3.5 font-bold">
                상품명
              </th>
              <th scope="col" className="px-5 py-3.5 text-right font-bold">
                월 요금
              </th>
              {cols.discount && (
                <th scope="col" className="px-5 py-3.5 text-right font-bold">
                  할인 전
                </th>
              )}
              {cols.speed && (
                <th scope="col" className="px-5 py-3.5 font-bold">
                  속도
                </th>
              )}
              {cols.tv && (
                <th scope="col" className="px-5 py-3.5 font-bold">
                  TV 구성
                </th>
              )}
              <th scope="col" className="px-5 py-3.5 text-center font-bold">
                약정
              </th>
              {cols.gift && (
                <th scope="col" className="px-5 py-3.5 text-right font-bold">
                  현금 사은품
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr
                key={p.id}
                className="border-t border-line/70 transition-colors hover:bg-surface-muted"
              >
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left font-medium"
                >
                  {p.name}
                </th>
                <td className="tabular px-5 py-3.5 text-right text-base font-black text-brand-dark">
                  {formatWon(p.monthly_fee)}
                </td>
                {cols.discount && (
                  <td className="tabular px-5 py-3.5 text-right text-muted">
                    {p.list_fee != null && p.list_fee !== p.monthly_fee ? (
                      <span className="line-through">
                        {formatWon(p.list_fee)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
                {cols.speed && (
                  <td className="px-5 py-3.5 text-muted">{p.speed ?? "-"}</td>
                )}
                {cols.tv && (
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                    {p.tv_option ?? "-"}
                  </td>
                )}
                <td className="px-5 py-3.5 text-center text-muted">
                  {formatContract(p.contract_months)}
                </td>
                {cols.gift && (
                  <td className="px-5 py-3.5 text-right font-bold text-accent-ink">
                    {p.gift_amount == null
                      ? "-"
                      : `최대 ${formatWon(p.gift_amount)}`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* 우측 페이드 — 더 볼 내용이 있다는 신호. md 이상에서는 스크롤이 없어 숨긴다 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent md:hidden"
      />
    </div>
  );
}

function CategoryBlock({
  category,
  list,
}: {
  category: PlanCategory;
  list: Plan[];
}) {
  const speedGroups = groupBySpeed(list);
  const useAccordion =
    speedGroups.length >= 2 && list.length >= ACCORDION_MIN_ROWS;

  // 전 행이 비어 있는 열은 "없음"을 반복 선언하는 셈이라 아예 렌더하지 않는다.
  // 판정은 그룹 단위다 — 같은 카테고리인데 묶음마다 열 수가 달라지면 비교가 안 된다.
  // 속도별로 접은 경우 한 묶음 안의 행은 모두 같은 속도라, 속도 열은 요약줄과 중복된다.
  const cols: Cols = {
    speed: !useAccordion && list.some((p) => p.speed != null),
    // 이름에 이미 들어 있는 행은 열이 필요 없다. 한 행이라도 이름만으로
    // 구성을 알 수 없으면 그 묶음 전체에 열을 세운다 (묶음마다 열 수가
    // 달라지면 비교가 안 되므로 판정은 그룹 단위다).
    //
    // 비교 전에 공백을 지운다 — `TV 이코노미`(상품명)와 `TV이코노미`(구성값)는
    // 같은 것을 가리키는데 글자만 보면 어긋나, 쓸데없는 열이 하나 생긴다.
    // 반대로 `500M+WIFI+T스탠다드`(원문 오타를 보존한 행)처럼 **정말로** 이름이
    // 등급을 말해주지 않는 경우는 그대로 걸러져 열이 선다.
    tv: list.some((p) => {
      if (!p.tv_option) return false;
      const flat = (v: string) => v.replace(/\s+/g, "");
      return !flat(p.name).includes(flat(p.tv_option));
    }),
    discount: list.some(
      (p) => p.list_fee != null && p.list_fee !== p.monthly_fee,
    ),
    gift: list.some((p) => p.gift_amount != null),
  };

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className="h-4 w-1 rounded-full bg-brand" />
        {CATEGORY_LABEL[category]}
      </h3>

      {useAccordion ? (
        <>
          <p className="mb-2.5 text-sm text-muted">
            인터넷 속도를 골라 해당 구성만 확인하세요.
          </p>
          <div className="flex flex-col gap-2">
            {speedGroups.map(([speed, rows], i) => {
              const min = minMonthlyFee(rows);
              return (
                <details
                  key={speed ?? "etc"}
                  name={`plan-${category}`}
                  open={i === 0}
                  className="group overflow-hidden rounded-panel border border-line bg-white shadow-card"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2.5">
                      <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-black text-brand-deep">
                        {speed ?? "기타"}
                      </span>
                      <span className="text-sm font-bold">
                        {rows.length}개 구성
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {min != null && (
                        <span className="tabular">
                          월 {formatWon(min)}부터
                        </span>
                      )}
                      <Icon
                        name="chevronDown"
                        size={18}
                        className="shrink-0 text-brand-dark transition-transform duration-200 group-open:rotate-180"
                      />
                    </span>
                  </summary>
                  <div className="border-t border-line">
                    <PlanRows list={rows} cols={cols} />
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-white shadow-card">
          <PlanRows list={list} cols={cols} />
        </div>
      )}
    </div>
  );
}

export default function PlanTable({ plans }: { plans: Plan[] }) {
  const groups = groupByCategory(plans);
  if (groups.length === 0) return null;

  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="요금제 안내" />

        <div className="flex flex-col gap-10">
          {groups.map(([category, list]) => (
            <CategoryBlock key={category} category={category} list={list} />
          ))}
        </div>

        {/* 각주 — 요금 표시의 전제·기준일은 금액 바로 옆에 있어야 고지로서 기능한다.
            faint 는 읽히지 않는 톤이라 muted 로 올렸다 */}
        <div className="mt-6 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <p>{PRICE_BASIS_LINE}</p>
          <p>{PRICE_SOURCE_LINE}</p>
          <p>{PLAN_DISCLAIMER}</p>
          <p>
            <a
              href="#plan-notice"
              className="font-bold text-brand-dark underline underline-offset-2"
            >
              약정·설치비·사은품 조건 전체 보기
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
