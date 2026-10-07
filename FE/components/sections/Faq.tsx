import { FAQ } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 자주 묻는 질문.
 *
 * `<details>`/`<summary>` 네이티브 아코디언이다. JS 한 줄도 쓰지 않는다 —
 * 스크립트가 죽어도 열고 닫히고, 열려 있지 않은 답변도 브라우저 찾기(Ctrl+F)와
 * 검색엔진·스크린리더에는 전부 들어 있다. 키보드 조작(Tab/Enter)과
 * `aria-expanded` 상응 동작도 브라우저가 맡는다.
 *
 * 문구는 `lib/site-config.ts` 의 `FAQ` 한 곳에만 있다. 여기에는 없다.
 */
export default function Faq() {
  if (FAQ.items.length === 0) return null;

  // 검색결과용 구조화 데이터. 화면에 보이는 답변과 **같은 문장**만 넣는다.
  // 보이지 않는 내용을 여기에만 넣는 것은 검색엔진 가이드 위반이다.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a.join(" ") },
    })),
  };

  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading
          eyebrow="FAQ"
          title={FAQ.title}
          description={FAQ.sub}
        />

        <ul className="flex flex-col gap-3">
          {FAQ.items.map((item) => (
            <li key={item.q}>
              {/* 테두리만 브랜드색으로 반응한다. 열린 칸을 색면으로 칠하면
                  아코디언 하나 열 때마다 페이지에 초록 면이 하나씩 늘어난다 */}
              <details className="group rounded-card border border-line bg-white transition-colors duration-200 open:border-brand/50 hover:border-line-strong open:hover:border-brand/50">
                <summary className="flex cursor-pointer list-none items-start gap-3 p-5 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="mt-px shrink-0 text-base leading-7 font-black text-brand-dark"
                  >
                    Q
                  </span>
                  <h3 className="flex-1 text-[0.95rem] leading-7 font-bold text-foreground md:text-base">
                    {item.q}
                  </h3>
                  <Icon
                    name="chevronDown"
                    size={20}
                    className="mt-1.5 shrink-0 text-faint transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>

                <div className="mx-5 mb-5 flex flex-col gap-3 border-t border-line pt-4">
                  {item.a.map((p) => (
                    <p key={p} className="text-sm leading-relaxed text-muted">
                      {p}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-muted">
          여기 없는 내용은{" "}
          <a
            href="#consult"
            className="font-bold text-brand-dark underline-offset-4 hover:underline"
          >
            상담 신청
          </a>
          으로 물어보시면 확인해 드립니다.
        </p>
      </div>

      <script
        type="application/ld+json"
        // 정적 문구만 들어가지만, 문구에 꺾쇠가 섞여도 스크립트가 깨지지 않게 막아둔다
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
