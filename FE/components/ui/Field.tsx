// 폼 요소 공통 스타일 — LeadForm·퀵상담바가 같은 인풋 인상을 갖도록 한 곳에 모은다.

/** 인풋·셀렉트 공통. 포커스 시 테두리 + 링이 함께 들어와 경계가 또렷해진다 */
export const fieldBase =
  "w-full rounded-xl border border-line-strong bg-white px-4 py-3.5 text-base text-foreground transition-all duration-200 outline-none placeholder:text-faint hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/15";

export const fieldError =
  "border-red-400 focus:border-red-500 focus:ring-red-500/15";

/** 셀렉트는 기본 화살표를 숨기고 커스텀 셰브론을 쓴다.
    셰브론 자체는 globals.css 의 `.select-chevron` — Tailwind 임의값 URL 안 공백 때문에
    유틸리티가 생성되지 않아 화살표가 사라지던 문제가 있었다. */
export const selectBase = `${fieldBase} select-chevron cursor-pointer appearance-none pr-11`;

interface ConsentProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
  /** 동의 문구 아래에 작게 깔리는 법정 고지 항목들 */
  detail?: readonly string[];
}

/**
 * 동의 체크박스 — 개인정보(필수)와 마케팅(선택)은 반드시 분리된 항목으로 노출한다
 * (CLAUDE.md 규칙 2). 필수/선택 위계가 시각적으로 드러나야 한다.
 */
export function ConsentCheck({
  checked,
  onChange,
  required = false,
  children,
  detail,
}: ConsentProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm leading-relaxed transition-colors duration-200 ${
        checked
          ? "border-brand/35 bg-brand-soft"
          : "border-line bg-white hover:border-line-strong hover:bg-surface-muted"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand"
      />
      <span className={required ? "text-foreground" : "text-muted"}>
        <span
          className={`mr-1 font-bold ${required ? "text-brand-dark" : "text-faint"}`}
        >
          [{required ? "필수" : "선택"}]
        </span>
        {children}
        {/* 법정 고지는 동의 문구보다 한 단 작게 깔아 위계를 만든다.
            단 **가장 작은 글씨가 되어서는 안 된다** — 수집목적·보유기간·거부권은
            법이 알리라고 요구하는 내용이다. 11px 로 깔려 있었는데, 페이지 전체
            13px 미만 비중이 24.7% 였던 원인 중 하나이기도 했다.
            위계는 크기 한 단 차이(14 → 13)와 톤(muted)으로 충분히 만들어진다. */}
        {detail && (
          <span className="mt-1.5 block text-xs leading-[1.6] text-muted">
            {detail.map((d) => (
              <span key={d} className="block">
                {d}
              </span>
            ))}
          </span>
        )}
      </span>
    </label>
  );
}
