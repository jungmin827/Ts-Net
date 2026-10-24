import LeadForm from "@/components/forms/LeadForm";
import SectionHeading from "@/components/ui/SectionHeading";
import type { Carrier } from "@/lib/validation";

/**
 * `#consult` 상담 섹션 — 메인 히어로 밖의 모든 페이지가 이걸 쓴다.
 *
 * ── 왜 공용으로 빼는가 ────────────────────────────────────────────
 * 헤더의 주 CTA(`Header.tsx`)와 noscript 하단바(`(site)/layout.tsx`)는
 * **모든 페이지에서** `href="#consult"` 로 건다. 그런데 그 앵커를 가진 건
 * 메인 히어로와 통신사 4페이지뿐이었다. 게시판처럼 앵커 없는 페이지에서는
 * 헤더 CTA 를 눌러도 **아무 일도 일어나지 않는다** — 에러도 아니고 이동도 아닌,
 * 가장 알아채기 어려운 고장이다. 섹션을 공용으로 두고 페이지마다 붙이면
 * 앵커와 페이지가 같이 생긴다.
 *
 * ── 폭 계산 ──────────────────────────────────────────────────
 * `LeadForm` 안의 Turnstile 은 `size:"flexible"` 이어도 **최소 300px** 이다.
 * 거터는 다른 섹션과 같은 16px 로 두고(히어로에서 거터를 줄였다가 좌측
 * 정렬선이 4px 어긋나는 일을 겪었다) 카드 패딩만 12px 로 내린다 —
 * 360 − 32 − 24 − 2 = 302px. 360px 실측 302.0 / 320px 262.0(compact) 확인.
 */
export default function ConsultSection({
  title = "가입 상담 신청",
  description = "남겨주시면 순서대로 전화드릴게요",
  defaultCarrier,
}: {
  title?: string;
  description?: string;
  defaultCarrier?: Carrier;
}) {
  return (
    <section id="consult" className="scroll-mt-24 bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-xl px-4">
        <div className="rounded-panel border border-line bg-white p-3 shadow-float sm:p-6 md:p-8">
          <SectionHeading title={title} description={description} />
          <LeadForm variant="compact" defaultCarrier={defaultCarrier} />
        </div>
      </div>
    </section>
  );
}
