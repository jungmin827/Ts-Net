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
 * ── ⚠ 이 함수는 **멱등이어야 한다** ───────────────────────────
 * 처음 판은 여기서 `%` `_` 를 `\%` `\_` 로 이스케이프까지 했다. 그게
 * 조용한 오답을 하나 만들었다:
 *
 *   1. `"100% 할인"` → `"100\% 할인"`
 *   2. 그 값이 **페이저 URL**(`?q=100\%25 할인`)에 실려 나간다
 *   3. 2페이지에서 같은 함수를 또 거친다. `\` 는 위 strip 목록에 있어
 *      공백이 되고 → `"100 \% 할인"` — **입력하지 않은 문자가 들어간
 *      다른 검색어**다
 *   4. 결과 0건 → `pages: 1` → 페이저가 사라져 1페이지로 돌아갈 길도 없다
 *      (검색창에는 사용자가 치지 않은 `\` 가 보인다)
 *
 * 그래서 역할을 **둘로 가른다**:
 *   · `safeLikeTerm` — URL·입력창·건수 표시에 실리는 값. DSL 에서 위험한
 *     문자만 버린다. 새 문자를 **넣지 않으므로** 몇 번 거쳐도 같다.
 *   · `likePattern`  — 필터에 들어가는 순간의 패턴. 와일드카드 이스케이프는
 *     여기서만 하고, 그 결과는 **다시 저장·전달되지 않는다.**
 *
 * 길이 상한을 두는 이유 — 긴 패턴은 인덱스를 타지 못하는 전체 스캔이 된다.
 */
export function safeLikeTerm(
  v: string | string[] | undefined,
  maxLength = 50,
): SafeLikeTerm {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return "" as SafeLikeTerm;
  return (
    raw
      .slice(0, maxLength)
      // DSL 에서 의미를 갖는 문자는 **버린다** (이스케이프가 아니다 —
      // PostgREST 의 필터 문법에는 이들을 리터럴로 넣는 방법이 없다).
      // 백슬래시도 버린다: 남기면 아래 `likePattern` 의 이스케이프와
      // 구별이 안 된다.
      .replace(/[,()."':\\*]/g, " ")
      .replace(/\s+/g, " ")
      .trim() as SafeLikeTerm
  );
}

/**
 * 정리된 검색어를 `ilike` 패턴으로 만든다. **호출 결과를 저장하거나 URL 에
 * 싣지 말 것** — 와일드카드 이스케이프가 붙은 값이고, 그 값을 다시
 * `safeLikeTerm` 에 넣으면 백슬래시가 공백으로 바뀌어 검색어가 달라진다.
 *
 * `%` 와 `_` 는 LIKE 와일드카드다. 그대로 두면 `%` 한 글자가 전체 조회가 되고
 * (페이지네이션이 걸려 있어 치명적이진 않지만 검색으로서 거짓말이다),
 * 사용자가 찾으려던 리터럴 `%` 는 못 찾는다.
 */
export function likePattern(term: SafeLikeTerm): string {
  return `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
}

declare const safeFilter: unique symbol;

/**
 * `.or()` 에 그대로 넘길 수 있는 완성된 필터 문자열.
 *
 * ── 왜 타입이 하나 더 필요한가 ───────────────────────────────
 * `SafeLikeTerm` 은 **한 홉만** 막았다. `BoardQuery.q` 경계까지는 타입이
 * 지켜 주지만, 그 다음에 호출부가
 *
 *   query.or(`title.ilike.${pattern},content.ilike.${pattern}`)
 *
 * 처럼 템플릿 리터럴로 문자열을 조립하는 순간 보증이 끝난다. 거기서는
 * 아무 `string` 이나 끼워 넣을 수 있고 컴파일러는 말이 없다. 커밋 메시지와
 * 주석은 "브랜드 타입으로 막았다" 고 적어 뒀는데, 실제로 막힌 범위는
 * 그 경계까지였다 — **읽는 사람이 믿는 범위가 틀린 곳을 가리켰다.**
 *
 * 그래서 조립까지 타입 안으로 넣는다. `ilikeTerm` 과 `orFilter` 만이
 * 이 타입을 만들 수 있고, 둘 다 `SafeLikeTerm` 과 **열 이름 검증**을
 * 지나야 한다. 호출부에는 조립할 자리가 남지 않는다.
 */
export type SafeFilter = string & { readonly [safeFilter]: "safeFilter" };

/**
 * 열 이름은 식별자 모양만 받는다.
 *
 * 여기 오는 값은 전부 코드에 적힌 리터럴이라 사용자 입력이 섞일 경로가
 * 없다 — 그래서 던진다. 열 이름이 틀리면 개발 중에 즉시 터지는 쪽이,
 * 조용히 다른 조건을 만드는 쪽보다 낫다. 운영에서 이 예외가 날 수 있는
 * 유일한 경우는 **코드가 틀렸을 때**다.
 */
function assertColumn(column: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(column)) {
    throw new Error(`[postgrest] 열 이름이 아닙니다: ${column}`);
  }
  return column;
}

/** `열.ilike.%정리된검색어%` 한 조각 */
export function ilikeTerm(column: string, term: SafeLikeTerm): SafeFilter {
  return `${assertColumn(column)}.ilike.${likePattern(term)}` as SafeFilter;
}

/**
 * 조각들을 `.or()` 가 읽는 한 줄로 잇는다.
 *
 * 구분자가 `,` 라서, 조각 안에 정리되지 않은 `,` 가 있으면 조건이 하나 더
 * 생긴다 — 그 가능성을 `ilikeTerm` 이 입구에서 없앤다(`safeLikeTerm` 이
 * `,` 를 버린다). 여기서는 잇는 일만 한다.
 */
export function orFilter(...parts: SafeFilter[]): SafeFilter {
  return parts.join(",") as SafeFilter;
}
