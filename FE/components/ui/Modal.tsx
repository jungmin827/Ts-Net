"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /**
   * 본문 최대 폭. 기본 `md`(512px).
   * `lg`(768px)는 약관·처리방침처럼 **표가 들어가는 문서**용이다 —
   * 4열 표를 512px 안에 넣으면 셀마다 글자가 한 자씩 끊긴다.
   */
  size?: "md" | "lg";
  children: React.ReactNode;
}

/** 공용 모달 — 약관·제휴카드 안내에 사용. 브라우저 기본 dialog/alert은 쓰지 않는다 */
export default function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  /** 모달을 연 요소. 닫을 때 여기로 포커스를 돌려보낸다 */
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    // 1) 열기 직전의 포커스 위치를 기억한다
    openerRef.current = document.activeElement;

    // 2) 포커스를 모달 안으로 옮긴다.
    //    이게 없으면 키보드 사용자는 모달이 열려도 뒤쪽 페이지를 계속 훑는다 —
    //    처리방침처럼 본문이 긴 모달에서는 내용에 아예 닿을 수 없다.
    const panel = panelRef.current;
    panel?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // 3) Tab 을 모달 안에 가둔다. 배경이 aria-hidden 이 아니므로
      //    가두지 않으면 보이지 않는 뒤쪽 컨트롤로 포커스가 새어 나간다.
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // 4) 포커스 복귀. 복귀 대상이 사라졌을 수 있으니 존재 확인 후에만 호출한다
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-pop max-h-[85vh] w-full overflow-y-auto rounded-panel bg-white p-6 shadow-float outline-none ${
          size === "lg" ? "max-w-3xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
          <h3 className="text-lg font-black">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-muted hover:text-brand-dark"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
