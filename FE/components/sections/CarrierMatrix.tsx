import Link from "next/link";
import { getCarrierFeatures, type CarrierFeature } from "@/lib/carrier-features";
import { CARRIER_MENU, PLAN_DISCLAIMER } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 통신사별 선택 폭 비교.
 *
 * `PriceCompare` 는 "500M 결합에서 어디가 얼마인가"(한 점)를 보여준다.
 * 여기는 "어디서 무엇을 고를 수 있는가"(범위)를 보여준다 — 속도 라인업,
 * TV 구성, 월요금 범위, 약정 길이. 둘 다 같은 `plans` 테이블에서 나온다.
 *
 * **우위를 주장하지 않는다.** '추천', '최저가', '가장 빠름' 같은 말을 붙이지 않고
 * 등록된 값만 나란히 놓는다 (CLAUDE.md 규칙 6).
 *
 * 표가 아니라 카드 4장으로 짰다. 가로 스크롤 표는 390px 에서 비교가 불가능해지는데,
 * 카드 안의 항목 순서를 고정해 두면 좁은 화면에서는 위아래로 읽고 넓은 화면에서는
 * 가로로 비교할 수 있다. 스크롤 컨테이너도 필요 없다.
 *
 * 데이터가 없거나 한 곳만 있으면 '비교'가 성립하지 않아 섹션을 렌더링하지 않는다.
 */

/** 월요금 범위. 등록된 상품이 하나뿐이면 범위가 아니라 한 값으로 적는다 */
function feeRange(f: CarrierFeature): string {
  const min = f.minFee.toLocaleString("ko-KR");
  if (f.minFee === f.maxFee) return `${min}원`;
  return `${min}~${f.maxFee.toLocaleString("ko-KR")}원`;
}

export default async function CarrierMatrix() {
  const features = await getCarrierFeatures();
  if (features.length < 2) return null;

  // 메뉴 순서(KT·SK·LG·SKYLIFE)를 따라 세운다. 금액순으로 세우면 순위처럼 읽힌다
  const rows = CARRIER_MENU.flatMap((menu) => {
    const data = features.find((f) => f.carrier === menu.code);
    return data ? [{ menu, data }] : [];
  });

  if (rows.length < 2) return null;

  return (
    <section className="bg-white pb-16 md:pb-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          title="통신사별로 고를 수 있는 것"
          description="등록된 인터넷+TV 결합 상품을 통신사별로 집계했습니다"
        />

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map(({ menu, data }) => (
            <li
              key={menu.slug}
              className="relative flex h-full flex-col overflow-hidden rounded-panel border border-line bg-white"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: `var(${menu.colorVar})` }}
              />

              <div className="flex items-center gap-2.5 border-b border-line px-5 pt-6 pb-4">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
                  // 흰 글자가 얹히므로 ink 변형 (원색은 SK 3.50:1 미달)
                  style={{ backgroundColor: `var(${menu.inkVar})` }}
                  aria-hidden="true"
                >
                  {menu.code === "SKYLIFE" ? "SKY" : menu.code}
                </span>
                <h3 className="text-base leading-snug font-black text-foreground">
                  {menu.label}
                </h3>
              </div>

              {/* 항목 순서가 네 카드에서 같아야 가로로 눈이 움직인다 */}
              <dl className="flex flex-1 flex-col gap-4 px-5 py-5">
                <div>
                  <dt className="text-xs font-bold text-muted">월 요금</dt>
                  {/* 요금 범위가 이 표의 핵심 값이다 — 중간 단계로 세운다 */}
                  <dd className="tabular mt-1 text-[1.375rem] leading-snug font-black text-foreground">
                    {feeRange(data)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-bold text-muted">인터넷 속도</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground">
                    {data.speeds.length > 0 ? data.speeds.join(" · ") : "상담 시 안내"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-bold text-muted">TV 구성</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground">
                    {data.tvOptions.length > 0
                      ? data.tvOptions.join(" · ")
                      : "상담 시 안내"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-bold text-muted">약정</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground">
                    {data.contractMonths.length > 0
                      ? data.contractMonths.map((m) => `${m}개월`).join(" · ")
                      : "상담 시 안내"}
                  </dd>
                </div>
              </dl>

              <Link
                href={`/${menu.slug}`}
                className="group mt-auto flex items-center justify-between border-t border-line px-5 py-4 text-sm font-bold text-brand-dark transition-colors duration-200 hover:bg-surface-muted"
              >
                {menu.label} 요금표 보기
                <Icon
                  name="arrowRight"
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          월 요금은 등록된 인터넷+TV 결합 상품의 최저·최고 금액이며, 3년 약정 ·
          휴대폰 1회선 결합 · VAT 포함 기준입니다. 통신사마다 TV 구성 등급 체계가
          달라 같은 금액이라도 채널 수와 부가서비스가 다릅니다. {PLAN_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
