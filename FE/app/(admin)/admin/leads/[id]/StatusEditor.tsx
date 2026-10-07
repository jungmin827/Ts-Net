"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GIFT_LABEL,
  GIFT_STATUSES,
  LEAD_STATUSES,
  STATUS_LABEL,
  type GiftStatus,
  type LeadStatus,
} from "@/lib/admin/labels";

// 상태·사은품상태·메모 변경. 변경은 Route Handler(PATCH)가 처리하고
// lead_logs / access_logs 기록도 거기서 함께 이뤄진다.

const selectCls =
  "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm outline-none focus:border-brand";

interface Props {
  leadId: number;
  status: string;
  giftStatus: string;
  memo: string;
}

export default function StatusEditor({ leadId, status, giftStatus, memo }: Props) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextGift, setNextGift] = useState(giftStatus);
  const [nextMemo, setNextMemo] = useState(memo);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    nextStatus !== status || nextGift !== giftStatus || nextMemo !== memo;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(nextStatus !== status ? { status: nextStatus } : {}),
          ...(nextGift !== giftStatus ? { gift_status: nextGift } : {}),
          ...(nextMemo !== memo ? { memo: nextMemo } : {}),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "변경에 실패했습니다");
      } else {
        setMessage("저장했습니다");
        router.refresh();
      }
    } catch {
      setError("네트워크 오류입니다");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">진행상태</span>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className={selectCls}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s as LeadStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-muted">사은품 상태</span>
          <select
            value={nextGift}
            onChange={(e) => setNextGift(e.target.value)}
            className={selectCls}
          >
            {GIFT_STATUSES.map((g) => (
              <option key={g} value={g}>
                {GIFT_LABEL[g as GiftStatus]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-muted">메모</span>
        <textarea
          value={nextMemo}
          onChange={(e) => setNextMemo(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="상담 내용·설치 일정 등"
          className={`${selectCls} resize-y`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="cursor-pointer rounded-lg bg-brand-dark px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
        >
          {saving ? "저장 중…" : "변경 저장"}
        </button>
        {message && <span className="text-sm text-brand-dark">{message}</span>}
        {error && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
