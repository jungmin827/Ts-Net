// 사이트 전역 아이콘 세트 — 24px 그리드, 라인 스타일로 통일.
// 이모지·외부 3D 클립아트를 섞지 않는다 (docs/DESIGN_BRIEF_PROMPT.md §10).

export type IconName =
  | "phone"
  | "menu"
  | "close"
  | "chevronDown"
  | "chevronRight"
  | "arrowRight"
  | "bolt"
  | "compare"
  | "gift"
  | "shield"
  | "chat"
  | "clipboard"
  | "calendar"
  | "wrench"
  | "wallet"
  | "star"
  | "check"
  | "card";

const PATHS: Record<IconName, React.ReactNode> = {
  phone: (
    <path d="M6.6 3.5 9 8.2l-2 1.8a12 12 0 0 0 5 5l1.8-2 4.7 2.4v3.3c0 1-.8 1.8-1.8 1.7A16.5 16.5 0 0 1 3.3 5.3c-.1-1 .7-1.8 1.7-1.8h1.6Z" />
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowRight: <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" />,
  bolt: <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13L13.5 3Z" />,
  compare: (
    <>
      <path d="M4 7h7M4 12h5M4 17h7" />
      <path d="M20 17V5m0 0-3 3m3-3 3 3" />
    </>
  ),
  gift: (
    <>
      <path d="M3 10h18v3H3zM4.5 13v7.5h15V13" />
      <path d="M12 10v10.5M12 10S9.5 10 8.3 8.8A2.3 2.3 0 0 1 11.6 5.5c1 1 .4 4.5.4 4.5Zm0 0s2.5 0 3.7-1.2a2.3 2.3 0 0 0-3.3-3.3c-1 1-.4 4.5-.4 4.5Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9 4.1-1.2 7-4.8 7-9V6l-7-3Z" />
      <path d="m9.3 11.8 2 2 3.4-3.6" />
    </>
  ),
  chat: (
    <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5c-1.2 0-2.4-.3-3.4-.8L4.5 20l1.3-4.3A7.5 7.5 0 1 1 20 12Z" />
  ),
  clipboard: (
    <>
      <path d="M9 4.5h6v2.2H9zM8 6h-.8A1.2 1.2 0 0 0 6 7.2v12.1c0 .7.5 1.2 1.2 1.2h9.6c.7 0 1.2-.5 1.2-1.2V7.2c0-.7-.5-1.2-1.2-1.2H16" />
      <path d="M9.2 12h5.6M9.2 16h3.6" />
    </>
  ),
  calendar: (
    <>
      <path d="M5 6.5h14v13.5H5zM5 11h14M8.5 3.5V7M15.5 3.5V7" />
      <path d="M9 15h2" />
    </>
  ),
  wrench: (
    <path d="M15.6 4.5a4.7 4.7 0 0 0-5.8 6l-5.2 5.2a1.6 1.6 0 0 0 0 2.3l1.4 1.4c.6.6 1.6.6 2.3 0l5.2-5.2a4.7 4.7 0 0 0 6-5.8L17 10.7 13.3 7l2.3-2.5Z" />
  ),
  wallet: (
    <>
      <path d="M4 8.2C4 7 5 6 6.2 6h11.6C19 6 20 7 20 8.2v9.6c0 1.2-1 2.2-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8V8.2Z" />
      <path d="M4 10h16M16.2 14.5h.8" />
    </>
  ),
  star: (
    <path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 4Z" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  card: (
    <>
      <path d="M3.5 7.5h17v10h-17zM3.5 11h17" />
      <path d="M7 14.5h3" />
    </>
  ),
};

interface Props extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  /** px 단위. 기본 24 */
  size?: number;
  /** 면으로 채울지 (별점 등). 기본은 라인 */
  filled?: boolean;
}

export default function Icon({
  name,
  size = 24,
  filled = false,
  className = "",
  ...props
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
