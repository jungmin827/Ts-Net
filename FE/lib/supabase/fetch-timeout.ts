/**
 * Supabase 호출에 상한 시간을 거는 fetch.
 *
 * supabase-js 는 기본 타임아웃이 없다. DB 가 응답을 안 주면 라우트도
 * 응답을 안 주고, 방문자 화면에서는 "접수 중…" 이 끝나지 않는다 —
 * 그 사이 함수 실행 시간이 상한에 닿으면 플랫폼이 **HTML 504** 를 돌려
 * 우리 쪽 JSON 오류 처리도 건너뛴다. 정해진 시간 안에 실패로 끝내야
 * 라우트의 `error` 분기가 사용자 문구를 낼 수 있다.
 *
 * 호출부가 자기 signal 을 넘겼으면 둘 중 먼저 끊기는 쪽을 따른다.
 */
export function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal =
      init?.signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([init.signal, timeout])
        : (init?.signal ?? timeout);
    return fetch(input, { ...init, signal });
  };
}

/** 공개 경로 한 번의 왕복 상한. 서울 리전 정상 응답은 수십 ms 다 */
export const SUPABASE_TIMEOUT_MS = 8_000;
