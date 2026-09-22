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
      const data: { ok: boolean; error?: string } = await res.json();
      if (res.ok && data.ok) {
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

  return { status, error, submit, reset };
}
