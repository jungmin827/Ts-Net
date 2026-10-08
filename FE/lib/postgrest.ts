/**
 * PostgREST 필터 DSL 에 사용자 입력을 넣기 전에 쓰는 정리 함수.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────
 * `query.or("name.ilike.*X*,phone_masked.ilike.*X*")` 는 서버가 **문자열을
 * 파싱**해 필터를 만든다. 즉 `X` 는 SQL 파라미터가 아니라 그 DSL 의 일부다.
 *   · `X` 에 `,` 가 있으면 조건이 하나 더 생긴다.
 *   · `.` 이 있으면 `열.연산자.값` 구문으로 읽혀 **다른 열**을 가리킬 수 있다.
 *   · `(` `)` 는 `and(...)` / `or(...)` 중첩을 만든다.
 * 어드민은 이미 인증된 주체라 데이터 노출 자체가 새로 열리는 건 아니지만,
 * **이름에 쉼표나 점이 들어간 검색이 조용히 엉뚱한 결과를 낸다.** 조용한
 * 오답이 가장 나쁘다 — 상담사에게 넘길 명단이 한 건 모자라도 아무도 모른다.
 *
 * `%` 와 `_` 는 LIKE 와일드카드, `*` 는 PostgREST 가 `%` 로 번역하는 와일드카드다.
 * 남겨 두면 한 글자가 전체 조회가 되고, 정작 리터럴 `%` 는 못 찾는다.
 *
 * 길이 상한을 두는 이유 — 긴 패턴은 인덱스를 타지 못하는 전체 스캔이 된다.
 */
declare const safeTerm: unique symbol;

/**
 * `safeLikeTerm` 을 통과한 문자열.
 *
 * 평범한 `string` 으로 두면 "여기 오는 값은 이미 정리됐다" 가 **주석의 약속**
 * 일 뿐이라, 다음 사람이 (또는 다음의 나가) 원본 쿼리를 바로 넘겨도 컴파일러가
 * 아무 말을 안 한다. 브랜드 타입으로 두면 정리 함수를 거치지 않은 값은
 * 타입 단계에서 막힌다 — 검사 스크립트보다 먼저, 그리고 확실하게.
 */
export type SafeLikeTerm = string & { readonly [safeTerm]: "safeLikeTerm" };

export function safeLikeTerm(
  v: string | string[] | undefined,
  maxLength = 50,
): SafeLikeTerm {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return "" as SafeLikeTerm;
  return raw
    .slice(0, maxLength)
    // DSL 에서 의미를 갖는 문자는 **버린다** (이스케이프가 아니다 —
    // PostgREST 의 필터 문법에는 이들을 리터럴로 넣는 방법이 없다)
    .replace(/[,()."':\\*]/g, " ")
    // LIKE 와일드카드는 이스케이프해서 리터럴로 찾게 한다
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/\s+/g, " ")
    .trim() as SafeLikeTerm;
}
