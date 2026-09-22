"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { PARTNER_CARD } from "@/lib/site-config";

/** 제휴카드 할인 안내 + 상세 모달 (SPEC §1.2). 구체적 할인액은 근거 확보 후 config에서 교체 */
export default function PartnerCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start gap-5 rounded-panel border border-brand/15 bg-brand-light/60 p-7 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-brand">
              <Icon name="card" size={24} />
            </span>
            <div>
              <h2 className="mb-1.5 text-xl font-black md:text-2xl">
                {PARTNER_CARD.title}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                {PARTNER_CARD.summary}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="w-full shrink-0 md:w-auto"
          >
            자세히 보기
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={PARTNER_CARD.title}
      >
        <ul className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
          {PARTNER_CARD.details.map((d) => (
            <li key={d} className="flex gap-2.5">
              <Icon
                name="check"
                size={17}
                className="mt-0.5 shrink-0 text-brand"
              />
              {d}
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
