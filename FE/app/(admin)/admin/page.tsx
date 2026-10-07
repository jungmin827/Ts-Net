import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { logAccessSoft } from "@/lib/admin/audit";
import { buildLeadQuery } from "@/lib/admin/leads";
import {
  GIFT_LABEL,
  GIFT_STATUSES,
  LEAD_STATUSES,
  STATUS_BADGE,
  STATUS_LABEL,
  carrierLabel,
  type GiftStatus,
  type LeadStatus,
} from "@/lib/admin/labels";
import { monthStartKst, todayKst, weekStartKst } from "@/lib/kst";
import { CARRIERS } from "@/lib/validation";

// 대시보드 — 오늘/이번주/이번달 접수 건수 + 상태 분포 + 유입경로별 건수.
// 유입경로가 광고비 판단 근거이므로 가장 크게 배치한다 (docs/SPEC.md §3.6).
// 집계값만 다루고 이름·번호는 조회하지 않는다.

const BASE_FILTER = {
  period: "custom" as const,
  exported: "all" as const,
};

/** 분포 집계에 가져오는 행 상한. 넘으면 화면에 그 사실을 적는다 (E-10) */
const MONTH_ROW_CAP = 5000;

interface MonthRow {
  status: string;
  gift_status: string;
  carrier: string | null;
  utm_source: string | null;
}

export default async function AdminDashboardPage() {
  const { supabase, admin } = await requireAdmin("/admin");

  const today = todayKst();
  const weekStart = weekStartKst();
  const monthStart = monthStartKst();

  /**
   * 분포 집계용 행 상한. 이 수를 넘으면 **집계가 조용히 틀린다** —
   * 카드의 총계는 exact count 라 정확한데 막대 합계만 모자라기 때문이다.
   * 그래서 상한에 닿으면 화면에 그 사실을 적는다 (아래 `truncated`).
   */
  const countFor = async (from: string, to: string) => {
    const { count, error } = await buildLeadQuery(
      supabase,
      "id",
      BASE_FILTER,
      { from, to },
      { count: true, head: true },
    );
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  let monthRows: MonthRow[] = [];
  let loadError: string | null = null;

  try {
    [todayCount, weekCount, monthCount] = await Promise.all([
      countFor(today, today),
      countFor(weekStart, today),
      countFor(monthStart, today),
    ]);

    const { data, error } = await buildLeadQuery(
      supabase,
      "status, gift_status, carrier, utm_source",
      BASE_FILTER,
      { from: monthStart, to: today },
    ).limit(MONTH_ROW_CAP);
    if (error) throw new Error(error.message);
    monthRows = (data ?? []) as unknown as MonthRow[];

    // 집계 조회는 개인정보가 드러나지 않으므로 soft 기록 (실패해도 화면은 열린다)
    await logAccessSoft({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "LIST",
      target: "leads:dashboard",
      rowCount: monthRows.length,
      detail: { from: monthStart, to: today, aggregate: true },
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "조회 실패";
  }

  const statusCount = new Map<string, number>();
  const giftCount = new Map<string, number>();
  const carrierCount = new Map<string, number>();
  const utmCount = new Map<string, number>();
  for (const row of monthRows) {
    statusCount.set(row.status, (statusCount.get(row.status) ?? 0) + 1);
    giftCount.set(row.gift_status, (giftCount.get(row.gift_status) ?? 0) + 1);
    const c = row.carrier ?? "미지정";
    carrierCount.set(c, (carrierCount.get(c) ?? 0) + 1);
    const u = row.utm_source?.trim() || "(직접유입)";
    utmCount.set(u, (utmCount.get(u) ?? 0) + 1);
  }
  /** 상한에 닿았다 = 막대 합계가 총계보다 작다 */
  const truncated = monthRows.length >= MONTH_ROW_CAP;

  const utmRanking = [...utmCount.entries()].sort((a, b) => b[1] - a[1]);
  const utmMax = utmRanking[0]?.[1] ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">대시보드</h1>
          <p className="mt-0.5 text-xs text-muted">
            모든 날짜·시간은 한국 표준시(KST) 기준입니다.
          </p>
        </div>
        <Link
          href="/admin/leads"
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
        >
          상담신청 목록 →
        </Link>
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          접수 현황을 불러오지 못했습니다 — {loadError}
        </p>
      )}

      {/* 기간별 접수 건수 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="오늘" value={todayCount} href="/admin/leads?period=today" />
        <SummaryCard
          label={`이번주 (${weekStart} ~)`}
          value={weekCount}
          // 카드 숫자는 weekStartKst()(이번 주 월요일)로 세는데 period=7d 는
          // 최근 7일 롤링이라 화~일요일 내내 다른 집합이었다.
          // "이 숫자를 누르면 이 건들을 본다"는 계약을 지킨다.
          href={`/admin/leads?period=custom&from=${weekStart}&to=${today}`}
        />
        <SummaryCard
          label={`이번달 (${monthStart} ~)`}
          value={monthCount}
          href="/admin/leads?period=month"
        />
      </section>

      {/* 유입경로별 건수 — 광고비 손익의 근거이므로 가장 크게 */}
      <section className="rounded-card border border-line bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">유입경로별 접수 (이번달)</h2>
          <span className="text-xs text-muted">
            총 {monthCount}건
            {truncated && ` (분포는 ${MONTH_ROW_CAP.toLocaleString()}건까지만 집계)`}
          </span>
        </div>
        {utmRanking.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            이번달 접수 데이터가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {utmRanking.map(([source, count]) => (
              <li key={source} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm font-bold" title={source}>
                  {source}
                </span>
                <span className="h-5 min-w-1 flex-1 overflow-hidden rounded-full bg-brand-soft">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${utmMax ? (count / utmMax) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums">
                  {count}건
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 상태별 분포 */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-base font-bold">상태별 (이번달)</h2>
          <ul className="flex flex-col gap-1.5">
            {LEAD_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  href={`/admin/leads?period=month&status=${s}`}
                  className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[s as LeadStatus]}`}
                >
                  {STATUS_LABEL[s as LeadStatus]}
                </Link>
                <span className="font-bold tabular-nums">
                  {statusCount.get(s) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 사은품 상태 */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-base font-bold">사은품 (이번달)</h2>
          <ul className="flex flex-col gap-1.5">
            {GIFT_STATUSES.map((g) => (
              <li key={g} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{GIFT_LABEL[g as GiftStatus]}</span>
                <span className="font-bold tabular-nums">
                  {giftCount.get(g) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 통신사별 */}
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-base font-bold">통신사별 (이번달)</h2>
          <ul className="flex flex-col gap-1.5">
            {[...CARRIERS, "미지정"].map((c) => (
              <li key={c} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{carrierLabel(c === "미지정" ? null : c)}</span>
                <span className="font-bold tabular-nums">
                  {carrierCount.get(c) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-surface p-5 transition-all duration-200 hover:border-brand hover:shadow-card"
    >
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-bold tabular-nums text-brand-deep">
        {value}
        <span className="ml-1 text-base font-bold text-muted">건</span>
      </p>
    </Link>
  );
}
