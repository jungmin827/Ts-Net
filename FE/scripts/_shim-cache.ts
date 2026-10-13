/**
 * `next/cache` 의 하네스용 대역. 검사 스크립트는 Next 런타임 밖에서
 * 번들되므로 실제 모듈을 해석할 수 없다 (`next/image`·`next/navigation`
 * 에 둔 대역과 같은 이유다).
 *
 * `unstable_cache` 는 **캐시 없이 원 함수를 그대로** 돌려준다. 이 하네스가
 * 보는 것은 정렬 키와 입력 해석이고, 캐시 계층은 그 판정에 끼어들면 안 된다 —
 * 캐시가 있으면 두 번째 호출이 첫 결과를 돌려줘 검사가 아무것도 재지 않는다.
 */
export function unstable_cache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return fn;
}
// `revalidateTag`/`revalidatePath` 는 대역을 두지 않는다 — 지금 아무도
// 쓰지 않고, 안 쓰는 대역은 "이것도 번들된다" 는 오해만 남긴다.
