import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/auth";
import { isSameOrigin } from "@/lib/admin/same-origin";
import { requestIp } from "@/lib/admin/audit";
import { logAccess } from "@/lib/audit";
import { decryptPhone } from "@/lib/crypto";

// 전화번호 복호화 — 어드민 상세조회에서 "번호 보기"를 눌렀을 때만.
// 기록(access_logs DECRYPT)이 성공하기 전에는 평문을 절대 반환하지 않는다 (CLAUDE.md 규칙 3).

const idSchema = z.coerce.number().int().positive();

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // 평문 전화번호를 꺼내는 경로다. 교차 출처에서 부를 수 있어서는 안 된다.
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 403 },
    );
  }

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id: rawId } = await ctx.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }
  const id = parsedId.data;

  const { data, error } = await guard.supabase
    .from("leads")
    .select("id, phone_enc")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "조회에 실패했습니다" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 건입니다" }, { status: 404 });
  }

  // 1) 먼저 기록한다 — 기록 실패 시 복호화 결과를 내보내지 않기 위함
  try {
    await logAccess({
      actorId: guard.admin.userId,
      actorEmail: guard.admin.email,
      action: "DECRYPT",
      target: `leads:${id}`,
      rowCount: 1,
      detail: { reason: "admin_detail_reveal" },
      ip: requestIp(req.headers),
    });
  } catch (e) {
    console.error(
      "[/api/admin/leads/decrypt] 감사로그 기록 실패:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { ok: false, error: "접속기록을 남길 수 없어 번호를 표시하지 않았습니다" },
      { status: 500 },
    );
  }

  // 2) 복호화 — 결과는 응답으로만 흐른다. 서버 로그에 남기지 않는다.
  //    평문이 실린 응답이므로 어떤 캐시(브라우저·프록시)에도 남기지 않는다.
  try {
    const phone = decryptPhone(data.phone_enc as string);
    return NextResponse.json(
      { ok: true, phone },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "복호화에 실패했습니다. ENCRYPTION_KEY를 확인해 주세요" },
      { status: 500 },
    );
  }
}
