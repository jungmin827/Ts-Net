import { noticeBlocks } from "@/lib/legal-notices";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 요금 고지 섹션.
 *
 * 요금을 표시하는 페이지에는 그 금액의 전제(약정·결합·VAT)와 표시 금액 밖의 비용
 * (설치비·장비 임대료), 중도 해지 시 비용, 사은품 조건이 같은 페이지에 있어야 한다.
 * 각주 한 줄로는 고지 역할을 못 한다 — 그래서 블록으로 세우고, 본문 톤도 `faint` 가
 * 아니라 `muted` 로 둔다.
 *
 * 구현은 `<details>` 다. 스크립트 없이 열리고, 접힌 상태에서도 모든 문장이 HTML 안에
 * 남는다 — 고지는 JS 실행 여부에 의존해서는 안 되는 정보다. 아코디언 `name` 은 주지
 * 않았다: 여러 블록을 동시에 펼쳐 비교해 읽는 쪽이 고지에는 맞다.
 */
export default function PlanNotice({
  hasPrices = true,
}: {
  /** 요금표가 있는 페이지인지. 요금 미등록 통신사에서는 요금 전제 블록을 빼고 렌더한다 */
  hasPrices?: boolean;
}) {
  const blocks = noticeBlocks(hasPrices);
  if (blocks.length === 0) return null;

  return (
    <section id="plan-notice" className="scroll-mt-24 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          eyebrow="필수 확인"
          title="신청 전 확인사항"
          description="화면 요금이 어떤 기준인지, 따로 드는 비용은 뭐가 있는지 적어 뒀어요"
        />

        <div className="flex flex-col gap-2.5">
          {blocks.map((block) => (
            <details
              key={block.id}
              id={`notice-${block.id}`}
              open={block.defaultOpen}
              className="group rounded-panel border border-line bg-surface-muted"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 md:p-6 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-bold md:text-lg">
                    {block.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {block.summary}
                  </span>
                </span>
                <Icon
                  name="chevronDown"
                  size={20}
                  className="mt-0.5 shrink-0 text-brand-dark transition-transform duration-200 group-open:rotate-180"
                />
              </summary>

              <ul className="flex flex-col gap-2.5 border-t border-line px-5 py-5 text-sm leading-relaxed text-muted md:px-6">
                {block.items.map((item) => (
                  <li key={item.text} className="flex gap-2.5">
                    <Icon
                      name="check"
                      size={16}
                      className="mt-1 shrink-0 text-brand-dark"
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
