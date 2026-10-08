/**
 * 프리뷰 하네스 전용 `next/image` 대체품.
 *
 * `next/image` 를 그대로 번들하면 CJS 경로를 타며 `react/jsx-runtime` 을
 * 동적 require 해서 ESM 번들이 실행되지 않는다. 정적 미리보기에는 이미지
 * 최적화가 필요 없고 평범한 `<img>` 면 충분하다.
 *
 * 이 파일은 앱 번들에 들어가지 않는다 — esbuild alias 로만 쓰인다.
 */
export default function Image({
  src,
  alt,
  width,
  height,
  ...rest
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  unoptimized?: boolean;
  priority?: boolean;
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  const { unoptimized: _u, priority: _p, ...img } = rest;
  void _u;
  void _p;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={width} height={height} {...img} />;
}
