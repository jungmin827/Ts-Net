import { NextRequest, NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { requireAdminApi } from "@/lib/admin/auth";
import { isSameOrigin } from "@/lib/admin/same-origin";
import { requestIp } from "@/lib/admin/audit";
import { buildLeadsWorkbook, type ExportRecord } from "@/lib/admin/excel";
import {
  filterToAuditDetail,
  parseExportFilter,
  resolvePeriod,
} from "@/lib/admin/filters";
import {
  LEAD_EXPORT_COLUMNS,
  buildLeadQuery,
  type LeadExportRow,
} from "@/lib/admin/leads";
import { logAccess } from "@/lib/audit";
import { decryptPhone } from "@/lib/crypto";
import { compactKstDate } from "@/lib/kst";

// 엑셀 내보내기 — 기간(+화면 필터)을 받아 xlsx 를 스트리밍한다.
//
// 전화번호를 평문으로 반출하는 유일한 경로이므로 (CLAUDE.md 규칙 3):
//   1) access_logs 에 EXPORT + 건수 + 필터조건을 먼저 기록한다
//   2) 기록이 실패하면 파일을 만들지 않는다
//   3) 평문은 워크북 셀에만 들어가며 서버 로그에는 남기지 않는다
// 내보낸 행의 exported_at 을 갱신해 중복 배분을 막는다.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 한 번에 내보낼 수 있는 상한 — 메모리 보호 */
const EXPORT_MAX = 20000;
const UPDATE_CHUNK = 300;

/**
 * 실패를 **JSON 으로 돌려주지 않는다.**
 *
 * 이 엔드포인트는 폼 POST 로 호출된다. JSON 을 돌려주면 브라우저가 그 JSON 을
 * 문서로 띄워, 어드민이 `{"ok":false,...}` 만 적힌 흰 화면에 갇힌다.
 * "대상 0건" 같은 흔한 경우에도 그렇게 된다.
 * 목록으로 되돌리고 **어느 단계에서 실패했는지 코드만** 넘긴다.
 *
 * ⚠ 문장을 URL 에 싣지 않는 이유 —
 *   목록 화면은 `exportError` 를 `role="alert"` 빨간 배너로 렌더한다.
 *   문장을 그대로 실으면, 로그인된 운영자에게 링크 하나를 보내는 것만으로
 *   **사이트 자신의 어드민 셸 안에서, 자신의 오류 배너 스타일로, 임의 문장**을
 *   띄울 수 있다. (React 가 이스케이프하므로 XSS 는 아니고, 내용 주입이다.)
 *   단일 계정 + 2FA 구조에서 가장 값싼 공격은 운영자를 속이는 것이라
 *   그 경로를 열어 둘 이유가 없다. 코드만 넘기고 문구는 화면이 갖는다.
 *
 * ⚠ 필터를 함께 싣는 이유 —
 *   예전에는 `/admin/leads` 로만 돌려보내 `period`·`carrier`·`q` 등 9개가
 *   전부 날아갔다. 배너는 "선택한 기간·조건에 내보낼 내역이 없습니다"라고 하는데
 *   **그 '선택한 조건'이 이미 화면에서 사라진 뒤**라 말과 화면이 어긋났고,
 *   가장 흔한 실패에서 매번 조건을 다시 입력해야 했다.
 *   보낸 폼 값을 그대로 되돌려 준다 (목록 쪽에서 다시 검증한다).
 */
export type ExportErrorCode =
  | "filter"
  | "query"
  | "empty"
  | "audit"
  | "decrypt"
  | "update";

function backToList(
  req: NextRequest,
  code: ExportErrorCode,
  raw: Record<string, string>,
): NextResponse {
  const url = new URL("/admin/leads", req.url);
  for (const [k, v] of Object.entries(raw)) {
    // exportError 는 우리가 정한다. 폼이 보낸 값을 그대로 되돌리지 않는다
    if (k === "exportError" || !v) continue;
    url.searchParams.set(k, v);
  }
  url.searchParams.set("exportError", code);
  // 303 이어야 POST 가 GET 으로 바뀐다 (302 는 메서드가 유지될 수 있다)
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 403 },
    );
  }

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  // 폼 전송(application/x-www-form-urlencoded)과 쿼리스트링 양쪽을 받는다
  const form = await req.formData().catch(() => null);
  const raw = form
    ? Object.fromEntries(
        [...form.entries()].map(([k, v]) => [k, String(v)]),
      )
    : Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = parseExportFilter(raw);
  if (!parsed.success) {
    console.error(
      "[/api/admin/export] 필터 검증 실패:",
      parsed.error.issues[0]?.message,
    );
    return backToList(req, "filter", raw);
  }
  const filter = parsed.data;
  const range = resolvePeriod(filter);

  // 1. 대상 조회 (phone_enc 포함 — 이 경로에서만 암호문을 읽는다)
  const { data, error } = await buildLeadQuery(
    guard.supabase,
    LEAD_EXPORT_COLUMNS,
    filter,
    range,
  )
    .order("created_at", { ascending: false })
    .limit(EXPORT_MAX);

  if (error) {
    console.error("[/api/admin/export] 조회 실패:", error.code, error.message);
    return backToList(req, "query", raw);
  }

  const rows = (data ?? []) as unknown as LeadExportRow[];
  if (rows.length === 0) {
    return backToList(req, "empty", raw);
  }

  // 2. 반출 사실을 먼저 기록한다 — 실패하면 복호화도 하지 않는다
  try {
    await logAccess({
      actorId: guard.admin.userId,
      actorEmail: guard.admin.email,
      action: "EXPORT",
      target: "leads",
      rowCount: rows.length,
      detail: {
        ...filterToAuditDetail(filter, range),
        decrypted_phone: true,
        format: "xlsx",
      },
      ip: requestIp(req.headers),
    });
  } catch (e) {
    console.error(
      "[/api/admin/export] 감사로그 기록 실패:",
      e instanceof Error ? e.message : e,
    );
    return backToList(req, "audit", raw);
  }

  // 3. 복호화 + 워크북 생성
  let records: ExportRecord[];
  try {
    records = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      name: r.name,
      phone: decryptPhone(r.phone_enc),
      carrier: r.carrier,
      product: r.product,
      status: r.status,
      gift_status: r.gift_status,
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      memo: r.memo,
    }));
  } catch {
    return backToList(req, "decrypt", raw);
  }

  const workbook = buildLeadsWorkbook(records, {
    from: range.from,
    to: range.to,
    exportedBy: guard.admin.email,
  });

  // 4. exported_at 갱신 — 중복 배분 방지 ("미내보내기만" 필터의 근거)
  const exportedAt = new Date().toISOString();
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
    const chunk = ids.slice(i, i + UPDATE_CHUNK);
    const { error: updateError } = await guard.supabase
      .from("leads")
      .update({ exported_at: exportedAt })
      .in("id", chunk);
    if (updateError) {
      // 파일은 이미 만들어졌다 — 사용자가 중복 배분 위험을 알 수 있도록 실패를 알린다
      console.error(
        "[/api/admin/export] exported_at 갱신 실패:",
        updateError.code,
        updateError.message,
      );
      return backToList(req, "update", raw);
    }
  }

  // 5. 스트리밍 응답. 파일명에 기간을 넣는다
  const fileName = `상담신청_${compactKstDate(range.from)}-${compactKstDate(range.to)}.xlsx`;
  const asciiName = `leads_${compactKstDate(range.from)}-${compactKstDate(range.to)}.xlsx`;

  const pass = new PassThrough();
  // exceljs 가 zip 스트림을 pass 로 pipe 하고 완료 시 end() 까지 호출한다
  workbook.xlsx.write(pass).catch((e: unknown) => {
    console.error(
      "[/api/admin/export] xlsx 작성 실패:",
      e instanceof Error ? e.message : e,
    );
    pass.destroy(e instanceof Error ? e : new Error("xlsx 작성 실패"));
  });

  const body = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${asciiName}"; ` +
        `filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
      "X-Export-Row-Count": String(rows.length),
    },
  });
}
