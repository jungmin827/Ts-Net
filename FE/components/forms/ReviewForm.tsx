"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CARRIER_MENU } from "@/lib/site-config";
import { fieldBase, selectBase } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";

/** 응답 대기 상한 — 서버 최악 경로(Turnstile 5초 + DB 왕복 8초 ×2)보다 길게 */
const SUBMIT_TIMEOUT_MS = 25_000;

/**
 * 후기 작성 폼.
 *
 * ── 받지 않는 것 (전문: docs/REVIEW_AUTHORSHIP.md) ──────────────
 * 이름·비밀번호·이미지를 받지 않는다. 레퍼런스(인터넷다모아)도 작성자
 * 입력란이 없다(전부 `익명`). 개인정보를 한 종류라도 덜 받는 쪽이 항상
 * 안전하고, 후기의 신뢰는 이름이 아니라 "실제 가입자가 썼다" 는 경로에서
 * 나온다. 받지 않으면 마스킹할 것도, 유출될 것도 없다.
 *
 * 그래서 **개인정보 동의 체크박스가 없다.** 개인정보를 받지 않으므로
 * 동의를 받을 대상이 없다 — 받지도 않는 동의를 체크하라고 하면 그게 더
 * 이상한 화면이다. (상담 폼은 이름·연락처를 받으므로 거기엔 있다.)
 *
 * ── 승인 전이라고 분명히 말한다 ────────────────────────────────
 * 제출해도 바로 안 보인다. 그리고 제출자는 **자기 글을 다시 찾을 수 없다**
 * (본인 확인 수단을 안 받는 게 의도다). 그 사실을 제출 전과 후에 모두
 * 말해야 "올렸는데 사라졌다" 는 오해가 안 생긴다.
 */
export default function ReviewForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [carrier, setCarrier] = useState("");
  const [token, setToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const tsRef = useRef<TurnstileInstance | null>(null);
  /**
   * 위젯·스크립트가 실패했는지. 광고 차단기나 사내망이 challenges.cloudflare.com
   * 을 막으면 토큰이 영영 안 온다 — 그때 "잠시 기다려 주세요" 는 거짓말이다.
   */
  const [tsFailed, setTsFailed] = useState(false);
  // 스크립트 주입 effect 가 이 객체를 의존성으로 본다 — 매 렌더 새 객체면 주입을 재시도한다
  const tsScriptOptions = useMemo(() => ({ onError: () => setTsFailed(true) }), []);
  /** 진행 중 잠금. `sending` 은 렌더 시점 값이라 다시 그려지기 전 두 번째 제출을 못 막는다 */
  const inFlight = useRef(false);

  // 좁은 화면에서 Turnstile 을 compact(150×140)로 — `flexible` 은 최소 300px 이다
  const [compactTs, setCompactTs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 359px)");
    const sync = () => setCompactTs(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    /*
     * 버튼을 **비활성으로 두지 않는다** (CLAUDE.md). 누르면 무엇이 빠졌는지
     * 말해 준다. 회색으로 죽은 버튼은 페이지 전체를 미완성으로 읽히게 한다.
     */
    if (title.trim().length < 2) return setError("제목을 2자 이상 입력해 주세요");
    if (content.trim().length < 10) return setError("내용을 10자 이상 입력해 주세요");
    if (!token) {
      return setError(
        tsFailed
          ? "보안 확인을 불러오지 못했습니다. 광고 차단 기능을 끄거나 새로고침한 뒤 다시 시도해 주세요"
          : "보안 검증이 완료될 때까지 잠시 기다려 주세요",
      );
    }
    if (inFlight.current) return;
    if (navigator.onLine === false) {
      return setError("인터넷 연결이 끊겨 있습니다. 연결을 확인한 뒤 다시 눌러 주세요");
    }

    inFlight.current = true;
    setSending(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          ...(rating ? { rating } : {}),
          ...(carrier ? { carrier } : {}),
          turnstileToken: token,
        }),
        signal: ctrl.signal,
        cache: "no-store",
      });
      const json: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !json.ok) {
        // JSON 이 없으면(프록시 HTML 오류 등) 상태코드로만 말한다
        setError(
          json.error ??
            (res.status === 429
              ? "요청이 많습니다. 몇 분 뒤 다시 시도해 주세요"
              : res.status >= 500
                ? "서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요"
                : "등록에 실패했습니다. 잠시 후 다시 시도해 주세요"),
        );
        // Turnstile 토큰은 1회용 — 실패하면 재발급받아야 다시 보낼 수 있다
        setToken("");
        tsRef.current?.reset();
        return;
      }
      setDone(true);
    } catch (e) {
      // 시간초과는 "모름" 이다 — 서버는 이미 저장했을 수 있다. 후기에는 당일
      // 중복 차단이 없으므로 다시 누르면 같은 글이 두 번 접수될 수 있다고 말한다
      setError(
        e instanceof DOMException && e.name === "AbortError"
          ? "응답이 늦어 등록 여부를 확인하지 못했습니다. 이미 접수됐을 수 있으니 잠시 뒤 다시 시도해 주세요"
          : "네트워크 오류입니다. 연결을 확인하고 다시 시도해 주세요",
      );
      setToken("");
      tsRef.current?.reset();
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSending(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-panel border-2 border-brand-light bg-brand-soft p-6 text-center md:p-8"
      >
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-dark text-white">
          <Icon name="check" size={28} />
        </span>
        <p className="font-black text-brand-deep">후기를 접수했습니다</p>
        {/* 바로 안 보인다는 사실과, 다시 찾을 수 없다는 사실을 같이 말한다 */}
        <p className="mt-3 text-sm leading-relaxed text-muted">
          운영자 확인 후 게시됩니다. 작성자 정보를 받지 않으므로 게시 전까지는
          목록에서 보이지 않고, 작성한 글을 직접 수정하거나 삭제할 수는 없습니다.
          수정이 필요하시면 상담으로 알려 주세요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* honeypot — 사람에게는 보이지 않고 스크립트만 채운다 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute size-0 opacity-0"
      />

      <div>
        <label htmlFor="rv-title" className="mb-1.5 block text-sm font-bold">
          제목
        </label>
        <input
          id="rv-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="예) 상담에서 들은 금액과 청구서가 같았습니다"
          className={fieldBase}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rv-carrier" className="mb-1.5 block text-sm font-bold">
            가입한 통신사{" "}
            <span className="font-medium text-muted">(선택)</span>
          </label>
          <select
            id="rv-carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className={selectBase}
          >
            <option value="">선택하지 않음</option>
            {CARRIER_MENU.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">
            평점 <span className="font-medium text-muted">(선택)</span>
          </legend>
          {/*
            별을 **버튼으로** 둔다. `input[type=range]` 는 값이 숫자로만
            읽혀 "몇 점인지" 가 안 보이고, 별 그림만 두면 누를 수 있는지
            모른다. 안 고르면 `null` 이고, 그러면 목록·상세에서 별을
            아예 그리지 않는다 — 평가 없는 후기를 만점으로 둔갑시키지 않는다.
          */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? null : n)}
                aria-pressed={rating === n}
                aria-label={`${n}점`}
                // 터치 타깃 44px (SC 2.5.8)
                className="flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-surface-muted"
              >
                <Icon
                  name="star"
                  size={24}
                  filled
                  className={
                    rating !== null && n <= rating
                      ? "text-star"
                      : "text-line-strong"
                  }
                />
              </button>
            ))}
            {rating !== null && (
              <button
                type="button"
                onClick={() => setRating(null)}
                className="ml-1 min-h-11 px-2 text-xs font-bold text-muted underline underline-offset-2"
              >
                평점 지우기
              </button>
            )}
          </div>
        </fieldset>
      </div>

      <div>
        <label htmlFor="rv-content" className="mb-1.5 block text-sm font-bold">
          내용
        </label>
        <textarea
          id="rv-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={4000}
          rows={7}
          placeholder="상담·설치 과정에서 어떤 점이 좋았는지, 아쉬웠는지 적어 주세요."
          className={`${fieldBase} resize-y`}
        />
        <p className="mt-1.5 text-xs text-muted">
          {content.trim().length}/4000자 · 10자 이상
        </p>
      </div>

      {/*
        개인정보를 받지 않으므로 동의 체크박스가 없다. 대신 **무엇을 받지
        않는지** 를 적는다 — 후기 작성에 이름·연락처가 필요하다고 생각해
        망설이는 쪽이 훨씬 많다.
      */}
      <p className="rounded-lg border border-line bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-muted">
        이름·연락처·비밀번호를 받지 않습니다. 작성하신 글은 운영자 확인 후
        게시되며, 작성자 정보를 보관하지 않으므로 직접 수정·삭제할 수는 없습니다.
      </p>

      {siteKey ? (
        <div className="w-full overflow-x-auto">
          <Turnstile
            ref={tsRef}
            siteKey={siteKey}
            onSuccess={(t) => {
              setToken(t);
              setTsFailed(false);
            }}
            onExpire={() => setToken("")}
            onError={() => {
              setToken("");
              setTsFailed(true);
            }}
            onUnsupported={() => setTsFailed(true)}
            scriptOptions={tsScriptOptions}
            options={{ size: compactTs ? "compact" : "flexible", theme: "light" }}
          />
        </div>
      ) : (
        <p className="text-xs text-red-500">
          Turnstile 사이트 키가 설정되지 않았습니다 (.env.local)
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="animate-pop rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="cta-fill flex min-h-12 items-center justify-center gap-1.5 rounded-xl font-bold transition-colors duration-200"
      >
        {sending ? "등록 중…" : "후기 등록"}
        {!sending && <Icon name="arrowRight" size={17} />}
      </button>
    </form>
  );
}
