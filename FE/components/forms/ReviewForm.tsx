"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CARRIER_MENU } from "@/lib/site-config";
import { fieldBase, selectBase } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { ANONYMOUS, maskName } from "@/lib/mask-name";
import { MAX_REVIEW_IMAGES } from "@/lib/review-images";
import { encodeReviewPhoto, PhotoError, type EncodedPhoto } from "@/lib/review-image-encode";

/** 응답 대기 상한 — 서버 최악 경로(Turnstile 5초 + DB 왕복 8초 ×2)보다 길게 */
const SUBMIT_TIMEOUT_MS = 25_000;
/** 사진이 붙으면 업로드 시간이 더해진다 — 느린 모바일망에서 2~3MB 를 올릴 여유 */
const SUBMIT_TIMEOUT_WITH_PHOTOS_MS = 60_000;

interface Photo extends EncodedPhoto {
  key: string;
  /** 썸네일 Blob 의 object URL — 빼거나 화면을 떠날 때 반납한다 */
  preview: string;
}

/**
 * 후기 작성 폼.
 *
 * ── 받지 않는 것 (전문: docs/REVIEW_AUTHORSHIP.md) ──────────────
 * 연락처·비밀번호를 받지 않는다. 개인정보를 한 종류라도 덜 받는
 * 쪽이 항상 안전하고, 후기의 신뢰는 "실제 가입자가 썼다" 는 경로에서 나온다.
 *
 * ── 사진 (최대 3장, 2026-10-26 사용자 결정) ─────────────────────
 * 고르는 즉시 브라우저에서 줄여 다시 굽는다(`lib/review-image-encode.ts`) —
 * 원본은 이 기기 밖으로 나가지 않고, 촬영 위치(EXIF GPS)도 그때 떨어진다.
 * 가입 후기 사진은 계약서·고지서인 경우가 많아 이름·주소가 찍혀 온다.
 * 그래서 고르는 자리 바로 아래에 "가리고 올려 달라" 를 적고, 운영자는
 * 승인 화면에서 사진을 한 장씩 뺄 수 있다.
 *
 * 이름을 적거나 **익명**을 고른다 — 둘 중 하나는 해야 한다(10-26 사용자 결정).
 * 이름은 **가린 형태만 보낸다.**
 * 입력칸 아래에 게시될 모습(`박*민`)을 바로 보여 주고, 보낼 때 `maskName`
 * 을 건다 — 원래 이름은 이 기기 밖으로 나가지 않는다. 서버도 한 번 더 가린다.
 *
 * 그래서 여전히 **개인정보 동의 체크박스가 없다.** 원래 이름을 받지 않으므로
 * 동의를 받을 대상이 없다. (상담 폼은 이름·연락처를 받으므로 거기엔 있다.)
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
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  /** 게시될 모습 — 익명이면 `익명`, 아니면 가린 이름 */
  const author = anonymous ? ANONYMOUS : maskName(name);
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

  const [photos, setPhotosState] = useState<Photo[]>([]);
  /**
   * 같은 값을 ref 로도 든다. 사진 처리는 비동기라 끝나는 시점의 장수를 봐야
   * 하는데 `photos` 는 고를 때의 값에 묶여 있다. 그리고 object URL 반납은
   * 부수효과라 setState 갱신 함수 안에 둘 수 없다(StrictMode 가 두 번 부른다).
   */
  const photosRef = useRef<Photo[]>([]);
  const setPhotos = (next: Photo[]) => {
    photosRef.current = next;
    setPhotosState(next);
  };
  /** 줄이는 중인 장수. 0 이 아니면 제출을 미룬다 */
  const [preparing, setPreparing] = useState(0);
  const [photoNote, setPhotoNote] = useState("");

  // 화면을 떠날 때 미리보기 주소를 반납한다
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  async function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPhotoNote("");
    const room = MAX_REVIEW_IMAGES - photosRef.current.length - preparing;
    const picked = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > picked.length) {
      setPhotoNote(`사진은 ${MAX_REVIEW_IMAGES}장까지 올릴 수 있어요. 앞의 ${picked.length}장만 넣었어요`);
    }
    setPreparing((n) => n + picked.length);
    for (const file of picked) {
      try {
        const enc = await encodeReviewPhoto(file);
        const preview = URL.createObjectURL(enc.thumb);
        if (photosRef.current.length >= MAX_REVIEW_IMAGES) {
          URL.revokeObjectURL(preview);
        } else {
          setPhotos([...photosRef.current, { ...enc, preview, key: preview }]);
        }
      } catch (e) {
        setPhotoNote(e instanceof PhotoError ? e.message : "사진을 처리하지 못했어요. 다른 사진으로 올려 주세요");
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  }

  function removePhoto(key: string) {
    const target = photosRef.current.find((p) => p.key === key);
    if (target) URL.revokeObjectURL(target.preview);
    setPhotos(photosRef.current.filter((p) => p.key !== key));
    setPhotoNote("");
  }

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
    if (!anonymous) {
      if (!name.trim()) return setError("이름을 입력하거나 익명을 선택해 주세요");
      if (/[^\p{L}\s]/u.test(name)) return setError("이름에는 글자만 입력해 주세요");
    }
    if (preparing > 0) return setError("사진을 준비하고 있어요. 잠시만 기다려 주세요");
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
    const timer = setTimeout(
      () => ctrl.abort(),
      photos.length > 0 ? SUBMIT_TIMEOUT_WITH_PHOTOS_MS : SUBMIT_TIMEOUT_MS,
    );
    const payload = JSON.stringify({
      title: title.trim(),
      content: content.trim(),
      ...(rating ? { rating } : {}),
      ...(carrier ? { carrier } : {}),
      // 가린 형태(또는 `익명`)만 보낸다 — 원래 이름은 요청에 실리지 않는다
      author,
      turnstileToken: token,
    });
    /*
     * 사진이 없으면 예전 그대로 JSON 이다. 있으면 multipart — 글은 `payload`
     * 한 칸에 같은 JSON 으로, 사진은 원본(`image`)·썸네일(`thumb`)을 같은 순서로.
     * content-type 은 적지 않는다(브라우저가 경계 문자열을 붙여야 한다).
     */
    let body: BodyInit = payload;
    const headers: Record<string, string> = {};
    if (photos.length > 0) {
      const fd = new FormData();
      fd.append("payload", payload);
      photos.forEach((p, i) => {
        fd.append("image", p.full, `${i}.${p.ext}`);
        fd.append("thumb", p.thumb, `${i}.t.${p.ext}`);
      });
      body = fd;
    } else {
      headers["content-type"] = "application/json";
    }
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers,
        body,
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
              : res.status === 413
                ? "사진 용량이 너무 커요. 장수를 줄여 다시 올려 주세요"
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
          운영자 확인 후 게시됩니다. 본인 확인 정보를 받지 않으므로 게시 전까지는
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
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor="rv-name" className="text-sm font-bold">
            이름
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="size-4 cursor-pointer accent-brand"
            />
            익명으로 올릴게요
          </label>
        </div>
        {/* 익명이면 칸을 잠근다 — 적어 둔 이름은 지우지 않아, 체크를 풀면 그대로 돌아온다 */}
        <input
          id="rv-name"
          value={anonymous ? "" : name}
          onChange={(e) => setName(e.target.value)}
          disabled={anonymous}
          maxLength={20}
          autoComplete="name"
          aria-describedby="rv-name-help"
          placeholder={anonymous ? "익명으로 게시돼요" : "예) 박정민"}
          className={`${fieldBase} disabled:cursor-not-allowed disabled:bg-surface-muted`}
        />
        {/* 게시될 모습을 바로 보여 준다 — "내 이름이 그대로 뜨나" 를 묻기 전에 답한다 */}
        <p id="rv-name-help" className="mt-1.5 text-xs text-muted">
          {anonymous ? (
            <>
              <span className="font-bold text-foreground">{ANONYMOUS}</span>으로 게시돼요
            </>
          ) : author ? (
            <>
              <span className="font-bold text-foreground">{author}</span> 으로 게시돼요. 가린
              이름만 저장해요
            </>
          ) : (
            "박*민 처럼 가려서 게시돼요. 이름을 남기기 싫으시면 익명을 선택해 주세요"
          )}
        </p>
      </div>

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

      <div>
        <p id="rv-photos-label" className="mb-1.5 text-sm font-bold">
          사진{" "}
          <span className="font-medium text-muted">(선택 · 최대 {MAX_REVIEW_IMAGES}장)</span>
        </p>
        <ul aria-labelledby="rv-photos-label" className="flex flex-wrap gap-2.5">
          {photos.map((p, i) => (
            <li
              key={p.key}
              className="relative size-24 overflow-hidden rounded-lg border border-line bg-surface-muted"
            >
              {/* 고른 사진의 미리보기 — 이 기기 안의 Blob 이라 최적화할 것이 없다 */}
              <Image
                src={p.preview}
                alt={`첨부한 사진 ${i + 1}`}
                width={96}
                height={96}
                unoptimized
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(p.key)}
                aria-label={`사진 ${i + 1} 빼기`}
                // 사진 위에 얹히므로 진한 면 + 흰 글자. 터치 타깃은 보이는 원보다 크게 잡는다
                className="absolute top-0 right-0 flex size-11 items-start justify-end p-1"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground/85 text-white">
                  <Icon name="close" size={15} />
                </span>
              </button>
            </li>
          ))}
          {Array.from({ length: preparing }, (_, i) => (
            <li
              key={`prep-${i}`}
              className="flex size-24 items-center justify-center rounded-lg border border-line bg-surface-muted text-xs font-bold text-muted"
            >
              준비 중…
            </li>
          ))}
          {photos.length + preparing < MAX_REVIEW_IMAGES && (
            <li>
              {/*
                파일 입력은 숨기고 label 을 누르게 한다. `sr-only` 라 키보드
                포커스는 입력이 받으므로, 포커스 표시는 label 의 focus-within 으로 그린다.
                `accept="image/*"` — iOS 는 이때 HEIC 를 JPEG 로 바꿔서 넘겨준다.
              */}
              <label
                htmlFor="rv-photos"
                className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-xs font-bold text-muted transition-colors focus-within:border-foreground focus-within:text-foreground hover:border-foreground hover:text-foreground"
              >
                <Icon name="camera" size={22} />
                사진 추가
                <input
                  id="rv-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  aria-describedby="rv-photos-help"
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    // 같은 사진을 뺐다가 다시 고를 수 있게 비운다
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </li>
          )}
        </ul>
        {/*
          고르는 자리 **바로 아래**에 적는다. 가입 후기 사진은 계약서·고지서인
          경우가 많고, 거기엔 이름·주소·고객번호가 찍혀 있다. 폼 맨 아래 안내문에
          섞어 두면 사진을 다 고른 뒤에야 읽힌다.
        */}
        <p id="rv-photos-help" className="mt-1.5 text-xs leading-relaxed text-muted">
          계약서·요금 고지서처럼 이름·주소·번호가 보이는 사진은 가리고 올려 주세요. 보이면
          그 사진은 빼고 게시할게요. 사진 속 위치 정보는 올리기 전에 지워져요.
        </p>
        {photoNote && (
          <p role="status" className="mt-1.5 text-xs font-bold text-red-600">
            {photoNote}
          </p>
        )}
      </div>

      {/*
        원래 이름·연락처를 받지 않으므로 동의 체크박스가 없다. 대신 **무엇을
        받지 않는지** 를 적는다 — 후기 작성에 연락처가 필요하다고 생각해
        망설이는 쪽이 훨씬 많다.
      */}
      <p className="rounded-lg border border-line bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-muted">
        연락처·비밀번호를 받지 않습니다. 이름은 가린 형태로만 저장하며, 작성하신 글과 사진은
        운영자 확인 후 게시됩니다. 본인 확인 정보를 보관하지 않으므로 직접 수정·삭제할 수는 없습니다.
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
