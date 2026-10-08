/**
 * 프리뷰 하네스 전용 `next/navigation` 대체품.
 *
 * `next/navigation` 을 번들하면 CJS 경로를 타며 `react` 를 동적 require 해서
 * ESM 번들이 실행되지 않는다. 정적 미리보기에는 라우팅이 없고, 훅은 호출만
 * 되면 된다 — 버튼을 눌러 보는 게 아니라 **그려진 결과의 대비·크기를 재는**
 * 용도이기 때문이다.
 *
 * 이 파일은 앱 번들에 들어가지 않는다 — esbuild alias 로만 쓴다.
 */
export function useRouter() {
  return {
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function redirect() {
  throw new Error("preview harness: redirect() 는 호출되지 않아야 한다");
}

export function notFound() {
  throw new Error("preview harness: notFound() 는 호출되지 않아야 한다");
}
