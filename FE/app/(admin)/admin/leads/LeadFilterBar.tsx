import Link from "next/link";
import {
  PERIODS,
  PERIOD_LABEL,
  filterToQuery,
  type LeadFilter,
  type Period,
} from "@/lib/admin/filters";
import {
  GIFT_LABEL,
  GIFT_STATUSES,
  LEAD_STATUSES,
  STATUS_LABEL,
  carrierLabel,
  type GiftStatus,
  type LeadStatus,
} from "@/lib/admin/labels";
import { CARRIERS } from "@/lib/validation";

// 필터 바. GET 폼이라 클라이언트 자바스크립트가 필요 없다 —
// 어드민은 기본 서버 컴포넌트라는 규칙을 그대로 지킨다.

const selectCls =
  "rounded-lg border border-line-strong bg-white px-2.5 py-2 text-sm outline-none focus:border-brand";

interface Props {
  filter: LeadFilter;
  range: { from: string; to: string };
  /** 내보내기 POST 폼에 실을 필드 (현재 필터·기간 그대로) */
  exportFields: Record<string, string>;
}

export default function LeadFilterBar({ filter, range, exportFields }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      {/* 기간 프리셋 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => {
          const active = filter.period === p;
          return (
            <Link
              key={p}
              href={`/admin/leads${filterToQuery(filter, { period: p as Period, page: 1 })}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-200 ${
                active
                  ? "bg-brand-dark text-white"
                  : "border border-line-strong bg-white text-muted hover:border-brand hover:text-brand-dark"
              }`}
            >
              {PERIOD_LABEL[p as Period]}
            </Link>
          );
        })}
        <span className="ml-1 text-xs text-muted">
          {range.from} ~ {range.to} (KST)
        </span>
      </div>

      <form method="get" action="/admin/leads" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="period" value={filter.period} />

        {filter.period === "custom" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted">시작일</span>
              <input
                type="date"
                name="from"
                defaultValue={range.from}
                className={selectCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted">종료일</span>
              <input
                type="date"
                name="to"
                defaultValue={range.to}
                className={selectCls}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">통신사</span>
          <select name="carrier" defaultValue={filter.carrier ?? ""} className={selectCls}>
            <option value="">전체</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {carrierLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">상태</span>
          <select name="status" defaultValue={filter.status ?? ""} className={selectCls}>
            <option value="">전체</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s as LeadStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">사은품</span>
          <select name="gift" defaultValue={filter.gift ?? ""} className={selectCls}>
            <option value="">전체</option>
            {GIFT_STATUSES.map((g) => (
              <option key={g} value={g}>
                {GIFT_LABEL[g as GiftStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          {/* 라벨이 "내보내기" 였다. 바로 옆에 "엑셀 내보내기" **버튼**이 있어서
              거르는 조건인지 실행하는 버튼인지 한눈에 갈리지 않았다.
              표의 열 이름이 "내보냄" 이므로 같은 말로 맞춘다 —
              한 흐름 안에서 같은 것을 같은 이름으로 부른다. */}
          <span className="text-[11px] font-bold text-muted">내보냄 여부</span>
          <select name="exported" defaultValue={filter.exported} className={selectCls}>
            <option value="all">전체</option>
            <option value="no">아직 안 내보냄</option>
            <option value="yes">내보냄</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">유입경로</span>
          <input
            type="text"
            name="utm"
            defaultValue={filter.utm ?? ""}
            placeholder="utm_source"
            className={`${selectCls} w-28`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">이름·번호뒷자리</span>
          <input
            type="search"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="홍길동 / 5678"
            className={`${selectCls} w-36`}
          />
        </label>

        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-brand-dark px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep"
        >
          검색
        </button>
        <Link
          href="/admin/leads"
          className="rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-bold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-dark"
        >
          초기화
        </Link>

      </form>

      {/*
        엑셀 내보내기는 **별도 POST 폼**이다. 필터 폼(GET) 안에 둘 수 없어
        형제로 뺐다 — HTML 은 폼 중첩을 허용하지 않는다.

        링크(GET)가 아닌 이유: 이 요청은 전화번호를 복호화하고 `exported_at` 을
        갱신한다. GET 이면 외부 페이지가 이미지 태그 한 줄로 로그인된 어드민의
        쿠키를 실어 보낼 수 있다. 서버도 `Sec-Fetch-Site` 를 함께 검증한다.
        JS 없이 동작하므로 서버 컴포넌트 그대로 쓸 수 있다.
      */}
      <form
        method="post"
        action="/api/admin/export"
        className="flex justify-end border-t border-line pt-3"
      >
        {Object.entries(exportFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-ink transition-colors duration-200 hover:bg-accent-dark"
        >
          엑셀 내보내기
        </button>
      </form>
    </div>
  );
}
