/**
 * 요청의 접속자 IP — **신뢰할 수 있는지 함께 돌려준다.**
 *
 * 왜 플래그까지 돌려주는가 —
 *   `x-forwarded-for` 의 맨 앞 값은 **클라이언트가 자유롭게 적어 보내는 문자열**이다.
 *   신뢰 프록시 뒤가 아니라면 공격자가 요청마다 바꿔 키를 무한히 회전시킬 수 있다.
 *   그 사실을 모른 채 IP 를 잠금 키로 쓰면
 *     · 공격자는 잠금을 그냥 통과하고
 *     · 반대로 XFF 가 없는 환경에서는 모든 요청이 한 키로 뭉쳐
 *       제3자가 정당한 사용자를 잠글 수 있다
 *   두 방향으로 동시에 틀린다. 그래서 호출부가 **신뢰도에 따라 정책을 달리**
 *   할 수 있도록 값과 신뢰 여부를 같이 준다.
 *
 * 신뢰하는 헤더 (플랫폼이 직접 쓰고, 클라이언트가 보낸 동명 헤더는 덮어쓴다)
 *   · `cf-connecting-ip`      Cloudflare — 이 프로젝트의 DNS·WAF 경로 (CLAUDE.md 확정사항)
 *   · `x-vercel-forwarded-for` Vercel — 배포 대상
 *   · `x-real-ip`             일반적인 리버스 프록시 관행
 *
 * ⚠ 이 신뢰는 **origin 이 직접 노출되지 않을 때만** 성립한다. Vercel 배포 URL 로
 *   Cloudflare 를 우회해 때리면 `cf-connecting-ip` 는 없고 Vercel 헤더만 남는다
 *   (그건 여전히 Vercel 이 쓰는 값이라 신뢰 가능하다). 반대로 셀프호스팅에서
 *   프록시 없이 띄우면 아래 헤더가 전부 없고 XFF 만 남아 `trusted: false` 가 된다.
 */
export interface ClientIp {
  /** 접속자 IP. 아무것도 못 찾으면 undefined */
  ip: string | undefined;
  /** 플랫폼이 설정한 헤더에서 왔는가. false 면 **클라이언트가 조작할 수 있는 값**이다 */
  trusted: boolean;
}

const TRUSTED_HEADERS = [
  "cf-connecting-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

export function clientIp(headers: Headers): ClientIp {
  for (const h of TRUSTED_HEADERS) {
    const v = headers.get(h)?.split(",")[0]?.trim();
    if (v) return { ip: v, trusted: true };
  }
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: fwd || undefined, trusted: false };
}

/** 기록용 — 신뢰 여부와 무관하게 남길 값만 필요할 때 */
export function requestIp(headers: Headers): string | undefined {
  return clientIp(headers).ip;
}
