/**
 * 후기 한 건 변경 요청 — 승인·답글(`ReviewRowActions`)과 사진(`ReviewPhotoEditor`)이
 * 같이 쓴다. 실패 문구를 고르는 규칙이 두 군데 있으면 같은 실패가 두 말로 나온다.
 */
export async function patchReview(
  id: number,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return { ok: false, error: json.error ?? "변경에 실패했습니다" };
    return { ok: true };
  } catch {
    return { ok: false, error: "네트워크 오류입니다" };
  }
}
