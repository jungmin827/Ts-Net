import { NextResponse } from "next/server";

/**
 * 공개 POST 라우트(`/api/leads` `/api/reviews`) 공용 입·출구.
 *
 * ── 본문 상한 ────────────────────────────────────────────────
 * `req.json()` 은 본문을 **끝까지 다 받은 뒤** 파싱한다. 상담 본문은
 * 1KB 안팎, 후기도 4000자 상한이라 수십 KB 를 넘을 일이 없는데, 그대로 두면
 * 수 MB 짜리 본문도 메모리에 올려 파싱하고 나서야 zod 가 거절한다.
 * `content-length` 는 없을 수도(chunked) 거짓일 수도 있으므로 **읽으면서 센다.**
 *
 * ── Content-Type ─────────────────────────────────────────────
 * JSON 이 아닌 본문은 받지 않는다. `text/plain` 은 교차 출처 `<form>` 이
 * 사전 요청 없이 보낼 수 있는 형식이라, 받아 주면 남의 페이지가 이 라우트를
 * 두드릴 수 있다. 우리 폼은 전부 `application/json` 으로 보낸다.
 */
export const MAX_JSON_BODY = 32 * 1024;

type JsonBody =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

function reject(status: number): JsonBody {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status },
    ),
  };
}

export async function readJsonBody(
  req: Request,
  maxBytes = MAX_JSON_BODY,
): Promise<JsonBody> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return reject(415);

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return reject(413);
  if (!req.body) return reject(400);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return reject(413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return reject(400);
  }
}

/**
 * 공개 POST 응답은 **어디에도 캐시되지 않는다.**
 * POST 응답을 캐시하는 프록시는 드물지만, 접수 결과("접수되었습니다" /
 * "오늘 이미 접수") 가 공유 캐시에 남아 다른 사람에게 돌아가면 그 자체가
 * 거짓 안내다. 헤더 한 줄로 가능성을 없앤다.
 */
export function noStore<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * zod 첫 이슈를 사용자 문구로.
 *
 * 스키마에 한국어 문구를 단 규칙만 그대로 내보낸다. 문구를 안 단 규칙은
 * zod 기본 영문(`Invalid input: expected string, received undefined`)이
 * 나가는데, 한국어 UI 규칙 위반이자 **스키마 구조를 밖에 알려 준다.**
 */
export function issueMessage(
  issues: ReadonlyArray<{ message: string }>,
  fallback = "입력값을 확인해 주세요",
): string {
  const m = issues[0]?.message;
  return m && /[가-힣]/.test(m) ? m : fallback;
}
