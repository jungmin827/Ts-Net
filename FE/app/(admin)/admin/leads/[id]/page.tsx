import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { logAccess } from "@/lib/audit";
import {
  LEAD_DETAIL_COLUMNS,
  type LeadDetailRow,
  type LeadLogRow,
} from "@/lib/admin/leads";
import {
  GIFT_BADGE,
  STATUS_BADGE,
  carrierLabel,
  giftLabel,
  statusLabel,
  type GiftStatus,
  type LeadStatus,
} from "@/lib/admin/labels";
import { formatKstDate, formatKstDateTime } from "@/lib/kst";
import PhoneReveal from "./PhoneReveal";
import StatusEditor from "./StatusEditor";

// 상세. 화면이 처음 열릴 때는 마스킹 번호만 보이고, "번호 보기"를 눌러야 복호화된다.
// 상세 조회 자체는 access_logs 에 VIEW, 복호화는 DECRYPT 로 따로 기록된다.

const idSchema = z.coerce.number().int().positive();

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) notFound();
  const id = parsedId.data;

  const { supabase, admin } = await requireAdmin(`/admin/leads/${id}`);

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        상세를 불러오지 못했습니다 — {error.message}
      </p>
    );
  }
  if (!data) notFound();

  const lead = data as unknown as LeadDetailRow;

  // 개인정보(이름·마스킹번호·메모)가 화면에 뜨므로 strict 기록.
  // 기록이 실패하면 내용을 렌더링하지 않는다.
  try {
    await logAccess({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "VIEW",
      target: `leads:${id}`,
      rowCount: 1,
      detail: { source: "admin_detail" },
    });
  } catch (e) {
    return (
      <p
        role="alert"
        className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        접속기록을 남길 수 없어 상세를 표시하지 않았습니다 —{" "}
        {e instanceof Error ? e.message : "원인 불명"}
      </p>
    );
  }

  const { data: logs } = await supabase
    .from("lead_logs")
    .select("id, field, before_val, after_val, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const timeline = (logs ?? []) as unknown as LeadLogRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/leads"
            className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-dark"
          >
            ← 목록
          </Link>
          <h1 className="text-lg font-bold">
            접수 #{lead.id}
            <span className="ml-2 text-sm font-normal text-muted">
              {formatKstDateTime(lead.created_at)} (KST)
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded px-2 py-1 text-xs font-bold ${
              STATUS_BADGE[lead.status as LeadStatus] ?? "bg-slate-100"
            }`}
          >
            {statusLabel(lead.status)}
          </span>
          <span
            className={`rounded px-2 py-1 text-xs font-bold ${
              GIFT_BADGE[lead.gift_status as GiftStatus] ?? "bg-slate-100"
            }`}
          >
            사은품 {giftLabel(lead.gift_status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* 신청 정보 */}
        <section className="rounded-card border border-line bg-surface p-5 lg:col-span-3">
          <h2 className="mb-3 text-base font-bold">신청 정보</h2>
          <dl className="flex flex-col divide-y divide-line">
            <Row label="이름">{lead.name}</Row>
            <Row label="연락처">
              <PhoneReveal leadId={lead.id} masked={lead.phone_masked} />
            </Row>
            <Row label="통신사">{carrierLabel(lead.carrier)}</Row>
            <Row label="관심상품">{lead.product ?? "-"}</Row>
            <Row label="개인정보 동의">
              {lead.consent_privacy ? "동의" : "미동의"}
              {lead.consent_at && (
                <span className="ml-2 text-xs text-muted">
                  {formatKstDateTime(lead.consent_at)}
                </span>
              )}
            </Row>
            <Row label="마케팅 수신 동의">
              {lead.consent_marketing ? "동의" : "미동의"}
            </Row>
            <Row label="보유기간 만료">{formatKstDate(lead.purge_at)}</Row>
            <Row label="내보냄">
              {lead.exported_at ? formatKstDateTime(lead.exported_at) : "미내보내기"}
            </Row>
          </dl>
        </section>

        {/* 유입 경로 */}
        <section className="rounded-card border border-line bg-surface p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-bold">유입 경로</h2>
          <dl className="flex flex-col divide-y divide-line">
            <Row label="utm_source">{lead.utm_source ?? "(직접유입)"}</Row>
            <Row label="utm_medium">{lead.utm_medium ?? "-"}</Row>
            <Row label="utm_campaign">{lead.utm_campaign ?? "-"}</Row>
            <Row label="utm_content">{lead.utm_content ?? "-"}</Row>
            <Row label="랜딩경로">{lead.landing_path ?? "-"}</Row>
            <Row label="referrer">
              <span className="block max-w-full truncate text-xs" title={lead.referrer ?? ""}>
                {lead.referrer ?? "-"}
              </span>
            </Row>
          </dl>
        </section>
      </div>

      {/* 상태 변경 */}
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-3 text-base font-bold">상태 변경 · 메모</h2>
        <StatusEditor
          leadId={lead.id}
          status={lead.status}
          giftStatus={lead.gift_status}
          memo={lead.memo ?? ""}
        />
      </section>

      {/* 변경 이력 */}
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-3 text-base font-bold">변경 이력</h2>
        {timeline.length === 0 ? (
          <p className="py-4 text-sm text-muted">변경 이력이 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {timeline.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-2 border-l-2 border-brand-light pl-3 text-sm"
              >
                <span className="text-xs text-muted tabular-nums">
                  {formatKstDateTime(log.created_at)}
                </span>
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-bold">
                  {log.field === "status"
                    ? "진행상태"
                    : log.field === "gift_status"
                      ? "사은품"
                      : log.field === "memo"
                        ? "메모"
                        : log.field}
                </span>
                <span className="text-muted">
                  {labelFor(log.field, log.before_val)} →{" "}
                  <strong className="text-foreground">
                    {labelFor(log.field, log.after_val)}
                  </strong>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function labelFor(field: string, value: string | null): string {
  if (value === null) return "-";
  if (field === "status") return statusLabel(value);
  if (field === "gift_status") return giftLabel(value);
  return value;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2 py-2.5">
      <dt className="w-32 shrink-0 text-xs font-bold text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}
