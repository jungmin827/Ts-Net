"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { PARTNER_CARD } from "@/lib/site-config";

/** 제휴카드 할인 안내 + 상세 모달 (SPEC §1.2). 구체적 할인액은 근거 확보 후 config에서 교체 */
export default function PartnerCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-brand-light p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-2 text-xl font-black md:text-2xl">
              💳 {PARTNER_CARD.title}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
              {PARTNER_CARD.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 cursor-pointer rounded-lg bg-brand px-6 py-3 font-bold text-white transition-colors hover:bg-brand-dark"
          >
            자세히 보기
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={PARTNER_CARD.title}
      >
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-gray-600">
          {PARTNER_CARD.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
