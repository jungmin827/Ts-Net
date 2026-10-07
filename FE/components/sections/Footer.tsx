import Image from "next/image";
import { SITE, hasTel, isPlaceholder } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import LegalLinks from "./LegalLinks";

// 푸터 = 마지막 전환 구역 + 법적 고지.
// 사업자 정보 6종 표기는 법적 필수 (런칭 전 체크리스트).
// 이용약관·개인정보처리방침은 LegalLinks 가 모달로 연다 (전문은 content/*.mdx 작성 후 교체)
/** 사업자 정보 6종 중 하나라도 확정 전인가 */
const BUSINESS_ROWS_PENDING = [
  SITE.business.companyName,
  SITE.business.ceo,
  SITE.business.bizRegNo,
  SITE.business.telecomReportNo,
  SITE.business.mailOrderNo,
  SITE.business.address,
].some(isPlaceholder);

export default function Footer() {
  const b = SITE.business;

  return (
    <footer>
      {/* 전환 밴드 — 스크롤 끝까지 내려온 사람에게 마지막으로 행동을 제안한다 */}
      {/* 전환 밴드. 예전에는 진초록 풀블리드였지만, 레퍼런스 실측 결과
          그 사이트에는 진한 색 밴드가 단 하나도 없었다 — CTA 섹션조차
          포인트색 3% 농도의 틴트(#fff8f2→#fff0e7)이고 푸터는 #f8f9fb 다.
          색면으로 소리치지 않고 CTA 버튼 하나만 튀게 둔다. */}
      <section
        className="relative isolate overflow-hidden border-y border-line"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #f3fcf6 0%, #e9f8ef 55%, #f3fcf6 100%)",
        }}
      >
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <div>
            <h2 className="text-2xl leading-snug font-black text-foreground md:text-3xl">
              어떤 상품이 맞는지 고민되시나요?
            </h2>
            <p className="mt-2.5 text-muted">
              연락처를 남겨주시면 조건을 비교해 안내해 드립니다
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto">
            <a
              href="#consult"
              className="inline-flex items-center justify-center gap-2 rounded-xl cta-fill px-7 py-4 font-black shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float active:translate-y-0"
            >
              상담 신청하기
              <Icon name="arrowRight" size={18} />
            </a>
            {hasTel() && (
            <a
              href={`tel:${SITE.tel}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand/30 bg-white px-7 py-4 font-black text-brand-deep transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-card active:translate-y-0"
            >
              <Icon name="phone" size={18} className="text-brand-dark" />
              <span className="tabular">{SITE.tel}</span>
            </a>
            )}
          </div>
        </div>
      </section>

      {/* 법적 고지 — 조용한 영역. 필수 6종은 반드시 유지 */}
      <div className="border-t border-line bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <Image
              src={SITE.logo.src}
              alt={SITE.name}
              width={SITE.logo.width}
              height={SITE.logo.height}
              className="h-[30px] w-auto"
            />
            <LegalLinks />
          </div>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs leading-relaxed text-muted sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["상호", b.companyName],
              ["대표자", b.ceo],
              ["사업자등록번호", b.bizRegNo],
              ["부가통신사업 신고번호", b.telecomReportNo],
              ["통신판매업 신고번호", b.mailOrderNo],
              ["주소", b.address],
            ].map(([label, value]) => {
              // 자리표시자를 **숨기지 않는다.**
              //
              // 한때 `TODO 상호` 같은 값이 그대로 보이는 게 보기 싫어 항목을
              // 걸러냈는데, 그 결과 6개 항목이 통째로 사라져 `<dl></dl>` 만 남았다.
              // 전자상거래법 §10 의 표시 항목이 화면에서 0개가 된 것이다.
              // "미완성이 보이는 것"보다 "의무 표기가 사라지는 것"이 훨씬 무겁다.
              //
              // 그래서 항목은 항상 자리를 지키고, 값이 없을 때만 그 사실을 적는다.
              // 값이 채워지면 자동으로 정상 표기로 바뀐다.
              const pending = isPlaceholder(value);
              return (
                <div key={label} className="flex gap-2">
                  {/* 전자상거래법 표기 항목이다. `--faint` 로 깔면 이 옅은 면
                      (#f5f8fa) 위에서 4.52:1 — 기준을 0.02 차로 넘긴다.
                      법으로 보이라고 요구하는 정보를 그 여유로 두지 않는다.
                      `--muted` 는 같은 면 위에서 5.8:1 이다. */}
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className={pending ? "text-muted italic" : undefined}>
                    {pending ? "등록 전" : value}
                  </dd>
                </div>
              );
            })}
          </dl>

          {/* 하나라도 비어 있으면 그 사실을 숨기지 않는다. 운영자와 검수자 모두
              이 줄을 보고 런칭 전 처리해야 할 일이 남았음을 알 수 있어야 한다. */}
          {BUSINESS_ROWS_PENDING && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              사업자 정보 일부가 아직 등록 전입니다. 확정 후 표기됩니다.
            </p>
          )}

          <p className="mt-5 border-t border-line pt-5 text-xs leading-relaxed text-muted">
            본 사이트는 통신사 공식 대리점/판매점의 가입 상담 접수 페이지이며,
            계약 체결은 각 통신사 절차에 따릅니다.{hasTel() ? ` 대표번호 ${SITE.tel}` : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}
