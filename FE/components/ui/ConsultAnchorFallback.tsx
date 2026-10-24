"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `#consult` 앵커가 없는 페이지의 상담 링크를 메인 상담폼으로 보낸다.
 *
 * 헤더·푸터·하단바는 모든 페이지에서 `href="#consult"` 로 건다. 그런데
 * `/review/write` 처럼 폼을 일부러 두지 않은 페이지에서는 눌러도 아무 일이
 * 일어나지 않았다. 링크마다 분기하지 않고 여기 한 곳에서 클릭을 받아
 * 앵커가 없을 때만 `/#consult` 로 이동시킨다.
 */
export default function ConsultAnchorFallback() {
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href="#consult"]');
      if (!link || document.getElementById("consult")) return;
      e.preventDefault();
      router.push("/#consult");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  return null;
}
