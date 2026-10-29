"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

/**
 * 접수 완료 페이지. 접수에 성공하면 어느 폼에서 보냈든 여기로 옮긴다.
 *
 * 광고 대행이 **"URL 이 바뀌어야 전환으로 잡힌다"** 고 요청했다(2026-10-29).
 * 그전에는 폼 자리에서 완료 문구만 바뀌어 주소가 그대로였다.
 * 단, URL 기준 전환은 새로고침·직접 입력·뒤로가기 후 앞으로가기도 센다.
 * 실제 접수 성공에만 나가는 신호는 `fireConversion` 의 Lead 이벤트다.
 */
export const LEAD_COMPLETE_PATH = "/complete";

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

/**
 * 응답 대기 상한. 서버 쪽 최악 경로(Turnstile 5초 + DB 왕복 8초 ×2)보다
 * 길게 잡는다 — 서버가 아직 일하는 중에 클라이언트가 먼저 포기하지 않게.
 * 상한이 없으면 모바일에서 연결이 반쯤 끊긴 채 "접수 중..." 이 영원히 돈다.
 */
const SUBMIT_TIMEOUT_MS = 25_000;

/**
 * 서버가 JSON 을 못 돌려준 경우(프록시 HTML 오류 페이지 등)의 문구.
 * 서버 문구가 있으면 그것이 우선이다 — 여기는 상태코드만 남았을 때다.
 */
function fallbackMessage(status: number): string {
  if (status === 429) return "요청이 너무 많습니다. 몇 분 뒤 다시 시도해 주세요";
  if (status >= 500)
    return "서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요";
  return "접수에 실패했습니다. 잠시 후 다시 시도해 주세요";
}

export function useLeadSubmit() {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus>("idle");
  const [error, setError] = useState("");
  /**
   * 진행 중 여부는 state 가 아니라 ref 로 막는다. `status` 는 렌더 시점 값이라
   * 다시 그려지기 전에 들어온 두 번째 제출(Enter 연타 등)이 `"idle"` 을 본다.
   * 그러면 1회용 토큰을 재사용한 두 번째 요청이 400 으로 돌아와, **먼저 성공한
   * 접수의 완료 화면을 오류 문구로 덮어쓴다.**
   */
  const inFlight = useRef(false);

  /** 성공하면 true. 실패 시 error 에 사용자용 문구가 채워진다 */
  async function submit(payload: LeadPayload): Promise<boolean> {
    if (inFlight.current) return false;

    // 오프라인이면 보내 보지도 않는다 — 요청이 공중에서 실패하길 기다리지 않고 이유를 바로 말한다
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("인터넷 연결이 끊겨 있습니다. 연결을 확인한 뒤 다시 눌러 주세요");
      return false;
    }

    inFlight.current = true;
    setError("");
    setStatus("loading");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...collectTracking() }),
        signal: ctrl.signal,
        cache: "no-store",
      });
      // 서버가 JSON 이 아닌 것을 돌려줄 수도 있다(프록시 오류 페이지, 502 HTML 등).
      // 여기서 파싱이 터지면 catch 로 넘어가 "네트워크 오류"로 뭉뚱그려지므로,
      // 응답 형태를 먼저 방어한 뒤 상태코드로 판단한다.
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      // 성공은 **서버가 `ok: true` 라고 말했을 때만**이다. 공용 와이파이의
      // 로그인 페이지처럼 200 + HTML 을 주는 중간자가 있으면, `ok !== false`
      // 로는 접수가 안 됐는데 완료 화면과 전환 이벤트가 나간다.
      if (res.ok && data.ok === true) {
        // Lead 는 지금 페이지에서 먼저 보낸다 — 이동은 클라이언트 전환이라
        // 페이지가 내려가지 않으므로 나가던 요청이 끊기지 않는다.
        // 완료 상태도 그대로 둔다: 이동이 늦거나 실패해도 폼 자리에 완료 문구가 남는다
        fireConversion();
        setStatus("done");
        router.push(LEAD_COMPLETE_PATH);
        return true;
      }
      setError(data.error ?? fallbackMessage(res.status));
    } catch (e) {
      // 시간초과는 "실패" 가 아니라 "모름" 이다 — 서버는 저장했을 수 있다.
      // 다시 눌러도 당일 중복은 서버가 409 로 막고 "이미 접수" 라고 알려 준다.
      setError(
        e instanceof DOMException && e.name === "AbortError"
          ? "응답이 늦어 접수 여부를 확인하지 못했습니다. 다시 눌러 주시면 이미 접수된 경우 그렇게 안내해 드립니다"
          : "네트워크 오류입니다. 연결을 확인하고 다시 시도해 주세요",
      );
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
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
