/**
 * `preview-admin.mjs` 전용 `next/link` 대체품.
 * 정적 미리보기에는 라우팅이 필요 없고 평범한 `<a>` 면 충분하다.
 * 이 파일은 앱 번들에 들어가지 않는다 — esbuild alias 로만 쓰인다.
 */
export default function Link({
  href,
  children,
  ...rest
}: {
  href: string;
  children?: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
