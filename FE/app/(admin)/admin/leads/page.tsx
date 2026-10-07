import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logAccess } from "@/lib/audit";
import {
  PAGE_SIZE,
  filterToAuditDetail,
  filterToQuery,
  parseLeadFilter,
  resolvePeriod,
} from "@/lib/admin/filters";
import {
  LEAD_LIST_COLUMNS,
  buildLeadQuery,
  type LeadListRow,
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
import { formatKstDateTime } from "@/lib/kst";
import LeadFilterBar from "./LeadFilterBar";

// 상담신청 목록.
// 연락처는 phone_masked 만 노출한다 — 목록에서 평문은 절대 보이지 않는다 (CLAUDE.md 규칙 3).
// 조회 자체를 access_logs 에 LIST + 필터조건으로 기록하고, 기록이 실패하면 목록을 띄우지 않는다.

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, admin } = await requireAdmin("/admin/leads");

  const raw = await searchParams;
  const filter = parseLeadFilter(raw);
  const range = resolvePeriod(filter);

  const offset = (filter.page - 1) * PAGE_SIZE;

  let rows: LeadListRow[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const { data, count, error } = await buildLeadQuery(
      supabase,
      LEAD_LIST_COLUMNS,
      filter,
      range,
      { count: true },
    )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    rows = (data ?? []) as unknown as LeadListRow[];
    total = count ?? 0;

    // 개인정보(이름·마스킹번호)가 화면에 뜨는 경로이므로 strict 기록.
    // 기록이 실패하면 아래 catch 로 떨어져 목록을 렌더링하지 않는다.
    await logAccess({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "LIST",
      target: "leads",
      rowCount: rows.length,
      detail: filterToAuditDetail(filter, range),
    });
  } catch (e) {
    rows = [];
    loadError = e instanceof Error ? e.message : "조회 실패";
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 내보내기는 부수효과(복호화 + exported_at 갱신)가 있어 POST 로 보낸다.
  // 링크(GET)였을 때는 외부 페이지가 어드민 쿠키를 실어 호출할 수 있었다.
  const exportFields = Object.fromEntries(
    new URLSearchParams(
      filterToQuery(filter, { page: 1, from: range.from, to: range.to }).replace(
        /^\?/,
        "",
      ),
    ).entries(),
  );

  // 내보내기 실패는 JSON 페이지로 이탈시키지 않고 이 화면에서 알린다
  const exportError =
    typeof raw.exportError === "string" ? raw.exportError : null;

  return (
    <div className="flex flex-col gap-4">
      {exportError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {exportError}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">상담신청</h1>
          <p className="mt-0.5 text-xs text-muted">
            총 {total}건 · {filter.page}/{totalPages} 페이지 · 접수일시 내림차순
          </p>
        </div>
      </div>

      <LeadFilterBar filter={filter} range={range} exportFields={exportFields} />

      {loadError && (
        <p
          role="alert"
          className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          목록을 표시할 수 없습니다 — {loadError}
          <br />
          <span className="text-xs">
            개인정보 조회는 access_logs 기록이 성공해야만 진행됩니다. 감사로그 기록에
            실패하면 목록이 비어 있게 됩니다.
          </span>
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-line bg-surface-muted text-xs text-muted">
            <tr>
              <Th>접수일시 (KST)</Th>
              <Th>이름</Th>
              <Th>연락처</Th>
              <Th>통신사</Th>
              <Th>관심상품</Th>
              <Th>유입경로</Th>
              <Th>상태</Th>
              <Th>사은품</Th>
              <Th>내보냄</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loadError && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted">
                  조건에 맞는 접수 내역이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line/70 last:border-0 hover:bg-brand-soft"
              >
                <Td>
                  <Link
                    href={`/admin/leads/${row.id}`}
                    className="font-bold text-brand-dark underline-offset-2 hover:underline"
                  >
                    {formatKstDateTime(row.created_at)}
                  </Link>
                </Td>
                <Td>{row.name}</Td>
                {/* 평문 번호는 상세에서 "번호 보기"를 눌러야 복호화된다 */}
                <Td className="tabular-nums">{row.phone_masked}</Td>
                <Td>{carrierLabel(row.carrier)}</Td>
                <Td>{row.product ?? "-"}</Td>
                <Td className="max-w-[140px] truncate">
                  {row.utm_source ?? "(직접유입)"}
                </Td>
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      STATUS_BADGE[row.status as LeadStatus] ?? "bg-slate-100"
                    }`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </Td>
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                      GIFT_BADGE[row.gift_status as GiftStatus] ?? "bg-slate-100"
                    }`}
                  >
                    {giftLabel(row.gift_status)}
                  </span>
                </Td>
                <Td className="text-xs text-muted">
                  {row.exported_at ? formatKstDateTime(row.exported_at) : "-"}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 50건 단위 */}
      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5">
          {filter.page > 1 && (
            <PageLink filter={filter} page={filter.page - 1} label="이전" />
          )}
          {pageWindow(filter.page, totalPages).map((p) => (
            <PageLink
              key={p}
              filter={filter}
              page={p}
              label={String(p)}
              active={p === filter.page}
            />
          ))}
          {filter.page < totalPages && (
            <PageLink filter={filter} page={filter.page + 1} label="다음" />
          )}
        </nav>
      )}
    </div>
  );
}

function pageWindow(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  const out: number[] = [];
  for (let p = start; p <= end; p += 1) out.push(p);
  return out;
}

function PageLink({
  filter,
  page,
  label,
  active = false,
}: {
  filter: ReturnType<typeof parseLeadFilter>;
  page: number;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={`/admin/leads${filterToQuery(filter, { page })}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors duration-200 ${
        active
          ? "bg-brand-dark text-white"
          : "border border-line-strong bg-white text-muted hover:border-brand hover:text-brand-dark"
      }`}
    >
      {label}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 whitespace-nowrap ${className}`}>{children}</td>;
}
