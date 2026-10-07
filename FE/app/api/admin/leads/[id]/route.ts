import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/auth";
import { requestIp } from "@/lib/admin/audit";
import { logAccess } from "@/lib/audit";
import { GIFT_STATUSES, LEAD_STATUSES } from "@/lib/admin/labels";
import { createAdminClient } from "@/lib/supabase/admin";

// 상태·사은품상태·메모 변경.
//
// 쓰기는 **세션 클라이언트를 먼저** 쓰고, RLS 에 막히면 service_role 로 물러난다.
//
// 배경: leads 변경 트리거(log_lead_change)가 lead_logs 에 이력을 남기는데,
// 001 스키마에는 lead_logs INSERT 정책이 없어 authenticated 세션으로는 막힌다.
// 마이그레이션 005 가 그 정책을 열고 트리거를 SECURITY DEFINER 로 올린다.
// 005 적용 후에는 세션 경로가 통과하면서 lead_logs.actor_id 가 채워진다.
// 그 전까지는 service_role 로 물러나므로 actor_id 는 NULL 이고,
// 변경 주체는 access_logs(UPDATE) 로만 확인된다.

const idSchema = z.coerce.number().int().positive();

const patchSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    gift_status: z.enum(GIFT_STATUSES).optional(),
    memo: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "변경할 항목이 없습니다",
  });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  // 읽기 전용 계정은 변경할 수 없다
  if (guard.admin.role !== "OWNER") {
    return NextResponse.json(
      { ok: false, error: "변경 권한이 없는 계정입니다" },
      { status: 403 },
    );
  }

  const { id: rawId } = await ctx.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }
  const id = parsedId.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" },
      { status: 400 },
    );
  }
  const patch = parsed.data;

  // 변경 전 값 — 감사로그와 memo 이력에 남긴다 (전화번호는 읽지 않는다)
  const { data: before, error: beforeError } = await guard.supabase
    .from("leads")
    .select("id, status, gift_status, memo")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    return NextResponse.json({ ok: false, error: "조회에 실패했습니다" }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 건입니다" }, { status: 404 });
  }

  /**
   * 쓰기는 **세션 클라이언트를 먼저 시도**한다.
   *
   * 이유: `leads` 변경 트리거(`log_lead_change`)가 `lead_logs` 에 이력을 남기는데,
   * 그 행의 `actor_id` 는 **호출자 세션**에서 온다. service_role 로 쓰면 누가 바꿨는지가
   * 늘 NULL 로 남아, 변경 이력과 접속기록을 대조해야만 주체를 알 수 있다.
   *
   * 다만 마이그레이션 005(`lead_logs_insert_policy`)가 적용되기 전에는 RLS 가
   * 트리거의 INSERT 를 막아 UPDATE 자체가 실패한다. 그래서 실패하면
   * service_role 로 물러난다 — 기능을 멈추지 않되, 물러났다는 사실은 로그에 남긴다.
   *
   * 005 가 적용되면 자동으로 세션 경로로 올라가고 `actor_id` 가 채워진다.
   */
  const session = guard.supabase;
  let writer = session;
  let { error: updateError } = await session.from("leads").update(patch).eq("id", id);

  if (updateError) {
    console.warn(
      "[/api/admin/leads] 세션 클라이언트 쓰기 실패 — service_role 로 물러납니다",
      "(마이그레이션 005 미적용 시 정상):",
      updateError.code,
    );
    try {
      writer = createAdminClient();
    } catch {
      return NextResponse.json(
        { ok: false, error: "서버 설정 오류입니다 (SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 500 },
      );
    }
    ({ error: updateError } = await writer.from("leads").update(patch).eq("id", id));
  }

  if (updateError) {
    console.error("[/api/admin/leads] update 실패:", updateError.code, updateError.message);
    return NextResponse.json({ ok: false, error: "변경에 실패했습니다" }, { status: 500 });
  }

  // memo 는 트리거 대상이 아니므로 직접 이력을 남긴다 (본문은 길이만)
  if (patch.memo !== undefined && patch.memo !== (before.memo ?? "")) {
    await writer.from("lead_logs").insert({
      lead_id: id,
      actor_id: guard.admin.userId,
      field: "memo",
      before_val: before.memo ? `(${String(before.memo).length}자)` : null,
      after_val: patch.memo ? `(${patch.memo.length}자)` : "(삭제)",
    });
  }

  try {
    await logAccess({
      actorId: guard.admin.userId,
      actorEmail: guard.admin.email,
      action: "UPDATE",
      target: `leads:${id}`,
      rowCount: 1,
      detail: {
        fields: Object.keys(patch),
        status: patch.status
          ? { before: before.status, after: patch.status }
          : undefined,
        gift_status: patch.gift_status
          ? { before: before.gift_status, after: patch.gift_status }
          : undefined,
        memo_changed: patch.memo !== undefined,
      },
      ip: requestIp(req.headers),
    });
  } catch (e) {
    // 변경은 이미 반영됐다 — 기록 실패를 숨기지 않고 알린다
    console.error(
      "[/api/admin/leads] 감사로그 기록 실패:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { ok: false, error: "변경은 저장됐지만 접속기록 저장에 실패했습니다" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
