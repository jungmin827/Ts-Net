/** 익명 선택 시 `author` 에 들어가는 값. 가리지 않고 그대로 저장·표시한다 */
export const ANONYMOUS = "익명";

/**
 * 후기 작성자 이름 가리기 — `박정민` → `박*민`, `김민` → `김*`, `남궁민수` → `남**수`.
 *
 * 브라우저(`ReviewForm`)가 보내기 전에 한 번, 서버(`/api/reviews`)가 저장 전에
 * 한 번 더 건다. 원래 이름은 방문자 기기 밖으로 나가지 않고, DB 에는 가린 형태만
 * 남는다 — 받지 않은 것은 유출될 수도 없다(docs/REVIEW_AUTHORSHIP.md 의 원칙).
 *
 * **멱등이다.** 가린 결과를 다시 넣어도 같은 값이 나온다(`박*민` → `박*민`).
 * 그래서 서버는 받은 값이 이미 가려졌는지 따지지 않고 그냥 다시 가린다 —
 * 브라우저를 거치지 않은 요청이어도 원래 이름이 저장될 길이 없다.
 */
export function maskName(raw: string): string {
  // 글자 단위로 자른다 — 코드 유닛으로 자르면 서로게이트 쌍이 반으로 갈린다
  const chars = Array.from(raw.replace(/\s+/g, ""));
  if (chars.length === 0) return "";
  if (chars.length <= 2) return `${chars[0]}*`;
  return chars[0] + "*".repeat(chars.length - 2) + chars[chars.length - 1];
}
