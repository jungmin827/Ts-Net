import { SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

// 푸터 = 마지막 전환 구역 + 법적 고지.
// 사업자 정보 6종 표기는 법적 필수 (런칭 전 체크리스트).
// TODO: 이용약관·개인정보처리방침 모달 (content/terms.mdx, privacy.mdx 작성 후 연결)
export default function Footer() {
  const b = SITE.business;

  return (
    <footer className="pb-20 lg:pb-0">
      {/* 전환 밴드 — 스크롤 끝까지 내려온 사람에게 마지막으로 행동을 제안한다 */}
      <section
        className="relative isolate overflow-hidden text-white"
        style={{
          backgroundImage: [
            "radial-gradient(40rem 28rem at 92% -20%, rgba(125,165,255,0.42), transparent 62%)",
            "linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-dark) 55%, var(--brand) 100%)",
          ].join(","),
        }}
      >
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:py-16">
          <div>
            <h2 className="text-2xl leading-snug font-black md:text-3xl">
              어떤 상품이 맞는지 고민되시나요?
            </h2>
            <p className="mt-2.5 text-white/80">
              연락처를 남겨주시면 조건을 비교해 안내해 드립니다
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto">
            <a
              href="#consult"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-7 py-4 font-black text-white shadow-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-float active:translate-y-0"
            >
              상담 신청하기
              <Icon name="arrowRight" size={18} />
            </a>
            <a
              href={`tel:${SITE.tel}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 font-bold backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0"
            >
              <Icon name="phone" size={18} />
              {SITE.tel}
            </a>
          </div>
        </div>
      </section>

      {/* 법적 고지 — 조용한 영역. 필수 6종은 반드시 유지 */}
      <div className="border-t border-line bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <span className="text-lg font-black text-brand-deep">
              {SITE.name}
            </span>
            <nav className="flex gap-5 text-sm font-bold text-slate-600">
              <span className="cursor-pointer transition-colors hover:text-brand">
                이용약관
              </span>
              <span className="cursor-pointer transition-colors hover:text-brand">
                개인정보처리방침
              </span>
            </nav>
          </div>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs leading-relaxed text-muted sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["상호", b.companyName],
              ["대표자", b.ceo],
              ["사업자등록번호", b.bizRegNo],
              ["부가통신사업 신고번호", b.telecomReportNo],
              ["통신판매업 신고번호", b.mailOrderNo],
              ["주소", b.address],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-slate-400">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 border-t border-line pt-5 text-xs leading-relaxed text-slate-400">
            본 사이트는 통신사 공식 대리점/판매점의 가입 상담 접수 페이지이며,
            계약 체결은 각 통신사 절차에 따릅니다. 대표번호 {SITE.tel}
          </p>
        </div>
      </div>
    </footer>
  );
}
