import type { PolicyDoc } from "@/lib/site-config";

/**
 * 약관·개인정보처리방침 본문 렌더러.
 *
 * 절 안의 순서는 **문단 → 표 → 목록 → 후주**로 고정한다.
 * 표가 들어간 절(제3자 제공·위탁·보유기간)에서 목록은 언제나 표에 붙는
 * 단서였다. 목록을 표보다 먼저 그리면 "제공에 동의하지 않으실 수 있습니다"가
 * 무엇에 대한 단서인지 모르는 채 먼저 읽히게 된다.
 * 목록 뒤에 와야 하는 문장은 `footnote` 로 넣는다.
 *
 * 표는 가로 스크롤 컨테이너에 넣는다 — 위탁·제3자 제공 표는 4열이라
 * 모바일 폭에서 접히면 어느 값이 어느 항목인지 알 수 없게 된다.
 */
export default function PolicyView({
  doc,
  operatorBlock,
}: {
  doc: PolicyDoc;
  /** `needsOperatorInput` 절 안에 들어갈 내용 (보호책임자 표 등) */
  operatorBlock?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted">
      <div className="flex flex-col gap-2.5">
        {doc.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      {doc.blocks.map((b) => (
        <section key={b.heading} className="flex flex-col gap-2.5">
          <h4 className="text-[15px] font-bold text-foreground">{b.heading}</h4>

          {b.paragraphs?.map((p) => <p key={p}>{p}</p>)}

          {b.table && (
            // 가로로 스크롤되는 영역은 키보드로도 스크롤할 수 있어야 한다.
            // tabIndex 없이 두면 모바일 폭에서 잘린 열을 마우스·터치로만 볼 수 있다.
            <div
              role="region"
              aria-label={b.heading}
              tabIndex={0}
              className="-mx-1 overflow-x-auto px-1"
            >
              <table className="w-full min-w-[460px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-muted">
                    {b.table.head.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border border-line px-2.5 py-2 text-left font-bold text-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.table.rows.map((row) => (
                    <tr key={row.join("|")}>
                      {row.map((cell) => (
                        <td
                          key={cell}
                          className="border border-line px-2.5 py-2 align-top"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {b.items && (
            <ul className="flex flex-col gap-1.5">
              {b.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          )}

          {b.footnote?.map((p) => (
            <p key={p}>{p}</p>
          ))}

          {b.needsOperatorInput && operatorBlock}
        </section>
      ))}

      <p className="border-t border-line pt-4 text-xs text-faint">
        시행일 : {doc.effectiveFrom}
      </p>
    </div>
  );
}
