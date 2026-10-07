"use client";

import { useState } from "react";

// 상담 접수 제출 로직 — 인라인 폼(LeadForm)과 하단 고정 바(StickyConsultBar)가 공유한다.
// 접수 규격은 /api/leads 한 곳에만 있으므로 여기서도 그 계약만 맞춘다.

export interface LeadPayload {
  name: string;
  phone: string;
  carrier?: string;
  product?: string;
  consent_privacy: boolean;
  consent_marketing: boolean;
  turnstileToken: string;
  /** honeypot. 봇이 채우면 서버가 조용히 폐기한다 */
  website: string;
}

interface Tracking {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  landing_path?: string;
  referrer?: string;
}

const UTM_KEY = "tsnet_utm";

/** 최초 진입 시점의 UTM을 세션에 고정해 폼 위치와 무관하게 유입경로를 보존 */
function collectTracking(): Tracking {
  if (typeof window === "undefined") return {};
  try {
    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Tracking;
    const sp = new URLSearchParams(window.location.search);
    const t: Tracking = {
      utm_source: sp.get("utm_source") ?? undefined,
      utm_medium: sp.get("utm_medium") ?? undefined,
      utm_campaign: sp.get("utm_campaign") ?? undefined,
      utm_content: sp.get("utm_content") ?? undefined,
      landing_path: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
    };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(t));
    return t;
  } catch {
    return {};
  }
}

/** 접수 성공 시 전환 이벤트 발화. 스크립트 미설치 환경에서는 조용히 무시 */
function fireConversion() {
  const w = window as unknown as Record<
    string,
    ((...args: unknown[]) => void) | undefined
  >;
  w.gtag?.("event", "generate_lead");
  w.fbq?.("track", "Lead");
  // TODO: 네이버·카카오 픽셀은 트래킹 스크립트 도입 시 함께 연결
}

/** 입력 중 하이픈을 자동으로 넣어준다. 서버는 어차피 숫자만 남겨 정규화한다 */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
}

export type LeadStatus = "idle" | "loading" | "done";

export function useLeadSubmit() {
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [error, setError] = useState("");

  /** 성공하면 true. 실패 시 error 에 사용자용 문구가 채워진다 */
  async function submit(payload: LeadPayload): Promise<boolean> {
    if (status === "loading") return false;
    setError("");
    setStatus("loading");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...collectTracking() }),
      });
      // 서버가 JSON 이 아닌 것을 돌려줄 수도 있다(프록시 오류 페이지, 502 HTML 등).
      // 여기서 파싱이 터지면 catch 로 넘어가 "네트워크 오류"로 뭉뚱그려지므로,
      // 응답 형태를 먼저 방어한 뒤 상태코드로 판단한다.
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.ok !== false) {
        fireConversion();
        setStatus("done");
        return true;
      }
      setError(data.error ?? "접수에 실패했습니다. 잠시 후 다시 시도해 주세요");
    } catch {
      setError("네트워크 오류입니다. 잠시 후 다시 시도해 주세요");
    }
    setStatus("idle");
    return false;
  }

  function reset() {
    setStatus("idle");
    setError("");
  }

  /** 서버에 보내기 전 단계에서 막혔을 때 쓰는 클라이언트측 안내.
      (예: 필수 동의 미체크 — 버튼을 비활성으로 두는 대신 이유를 말해준다) */
  function fail(message: string) {
    setError(message);
  }

  return { status, error, submit, reset, fail };
}
