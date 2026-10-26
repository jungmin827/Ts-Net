import { NextRequest, NextResponse } from "next/server";
import { reviewSubmitSchema } from "@/lib/validation";
import { verifyTurnstile, TURNSTILE_FAILURE } from "@/lib/turnstile";
import { readJsonBody, noStore, issueMessage } from "@/lib/http";
import { publicClient } from "@/lib/supabase/public";
import { clientIp } from "@/lib/client-ip";
import { isSameOrigin } from "@/lib/admin/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONTENT_TYPE,
  MAX_FULL_BYTES,
  MAX_REVIEW_IMAGES,
  MAX_THUMB_BYTES,
  MAX_UPLOAD_BODY,
  REVIEW_IMAGE_BUCKET,
  sniffImage,
  thumbPath,
  type ReviewImageExt,
} from "@/lib/review-images";

/**
 * 후기 제출 — `/api/leads` 와 같은 자리에 같은 순서로 둔다.
 * (honeypot → zod → Turnstile → 폭증 상한 → 사진 업로드 → INSERT)
 *
 * ── 왜 이 라우트가 필요했는가 (전문: docs/REVIEW_AUTHORSHIP.md) ──
 * `reviews` 에는 anon INSERT 정책도, 작성 폼도 없었다. 쓰기는 어드민뿐이고
 * 어드민은 단일 계정 1개(운영자)다. 즉 `/review` 에 "가입 후기" 로 뜰 수
 * 있는 글은 **전부 운영자가 쓴 글**이었다 — 소비자가 제3자의 경험으로
 * 읽도록 배치한 자리에 사업자의 자기 서술이 들어가면 표시광고법상
 * 거짓·과장 광고 소지가 있다. CLAUDE.md 규칙 1 이 `leads` 를 두고 막으려던
 * 것과 같은 종류다.
 *
 * ── 승인 전 글이 새지 않는 보장은 여기가 아니라 RLS 에 있다 ──────
 * 이 라우트가 `is_published: false` 를 넣지만, 그걸 **믿지 않는다.**
 * `008` 의 `reviews_public_insert` 가 `is_published = false` 인 행만
 * 통과시키고 anon 에게 UPDATE 를 주지 않는다. 라우트가 틀려도 DB 가 막는다.
 *
 * ── 사진 (010, 2026-10-26) ──────────────────────────────────────
 * 사진이 있으면 브라우저가 `multipart/form-data` 로 보낸다(글은 `payload`
 * 필드에 JSON 으로). 사진 없는 제출은 예전처럼 JSON 이다.
 *   · 업로드는 **Turnstile·폭증 상한을 통과한 뒤에만** 한다. 앞에서 올리면
 *     봇이 검증 실패를 감수하고 스토리지만 채울 수 있다.
 *   · 경로는 여기서 무작위로 정하고 **응답에 싣지 않는다** — public 버킷에서
 *     승인 전 사진을 가리는 장치가 "주소를 아무도 모른다" 뿐이다(010 주석).
 *   · 업로드 후 INSERT 가 실패하면 올린 파일을 지운다. 행이 없는 파일은
 *     어드민 화면에도 안 보여서 아무도 못 지운다.
 */

/** 폭증 창·임계치. 판정은 DB 함수 `review_submit_flood()` 안에서 한다 */
const FLOOD_WINDOW_MIN = 10;

export async function POST(req: NextRequest) {
  return noStore(await respond(req));
}

async function respond(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error(
      "[/api/reviews] 처리 중 예외:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }
}

async function handlePost(req: NextRequest) {
  // JSON 이 아니거나 상한(32KB)을 넘는 본문은 파싱 전에 거절한다.
  // 사진이 붙은 제출은 multipart 이고, 사진 검사(형식·크기·장수)까지 여기서 끝낸다
  const read = await readSubmission(req);
  if (!read.ok) return read.response;
  const { body, photos } = read;

  // 1. honeypot — 채워져 있으면 성공처럼 응답하고 조용히 폐기
  if (
    typeof body === "object" &&
    body !== null &&
    "website" in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true });
  }

  // 2. zod
  const parsed = reviewSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: issueMessage(parsed.error.issues) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 3. Turnstile
  const { ip } = clientIp(req.headers);
  const human = await verifyTurnstile(input.turnstileToken, ip ?? undefined);
  if (human !== "ok") {
    const { status, error } = TURNSTILE_FAILURE[human];
    return NextResponse.json({ ok: false, error }, { status });
  }

  const supabase = publicClient();
  if (!supabase) {
    console.error("[/api/reviews] Supabase anon 키 미설정 — 등록 불가");
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  /*
   * 4. 폭증 상한.
   *
   * 후기는 IP 를 저장하지 않는다 — 익명 제출이고, 넣을 이유가 없다.
   * 그래서 **전역 창**으로 본다: 짧은 시간에 전체 제출이 폭증하면 사람이
   * 아니라 스크립트다. 개별 공격자를 막는 건 Turnstile 과 Cloudflare
   * 레이트리밋의 일이고, 이건 그 둘이 뚫렸을 때의 마지막 상한이다.
   *
   * 함수를 못 부르면 **막지 않되 조용히 넘어가지 않는다** — 통제가 꺼진
   * 상태는 운영자가 반드시 알아야 한다 (`/api/leads` 와 같은 판단).
   */
  const { data: flooded, error: floodError } = await supabase.rpc(
    "review_submit_flood",
  );
  if (floodError) {
    console.error(
      "[/api/reviews] 폭증 상한 미작동 — review_submit_flood 호출 실패 " +
        "(008 미적용 가능):",
      floodError.code,
      floodError.message,
    );
  } else if (flooded === true) {
    return NextResponse.json(
      {
        ok: false,
        error: `등록 요청이 많습니다. ${FLOOD_WINDOW_MIN}분 후 다시 시도해 주세요`,
      },
      { status: 429 },
    );
  }

  /*
   * 6. INSERT.
   *
   * `author` 는 zod 가 이미 가린 값(`박*민`)이거나 없다 — 원래 이름은 여기까지
   * 오지 않는다. `view_count`·`admin_reply` 는 명시하지 않는다(기본값).
   * 008 의 정책이 그 셋을 검사하므로, 실수로 넣으면 INSERT 자체가 거부된다.
   */
  /*
   * 5. 사진 업로드 — service_role 로만 한다. anon 에게는 storage 정책이
   * 하나도 없다(010): 라우트를 거치지 않는 업로드 경로가 없다는 뜻이다.
   */
  let uploaded: Uploaded | null = null;
  if (photos.length > 0) {
    uploaded = await uploadPhotos(photos);
    if (!uploaded) {
      return NextResponse.json(
        { ok: false, error: "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요" },
        { status: 500 },
      );
    }
  }

  const { error } = await supabase.from("reviews").insert({
    title: input.title,
    content: input.content,
    rating: input.rating ?? null,
    carrier: input.carrier ?? null,
    author: input.author ?? null,
    // 경로만 적는다. 대체 텍스트는 운영자가 승인할 때 쓴다(010 이 anon 의 값을 거부한다)
    image_paths: uploaded ? uploaded.paths : null,
    is_published: false,
  });

  if (error) {
    // 행이 없는 파일은 아무 화면에도 안 보여 지울 사람이 없다 — 여기서 지운다
    if (uploaded) await removeObjects(uploaded.client, uploaded.objects);
    // 42501 = RLS 거부. 008 미적용이면 이걸 받는다 — 원인을 이름으로 찍는다.
    if (error.code === "42501") {
      console.error(
        "[/api/reviews] RLS 가 INSERT 를 거부했습니다 — " +
          "008·010 마이그레이션 미적용 가능:",
        error.message,
      );
    } else {
      console.error("[/api/reviews] INSERT 실패:", error.code, error.message);
    }
    return NextResponse.json(
      { ok: false, error: "등록에 실패했습니다. 잠시 후 다시 시도해 주세요" },
      { status: 500 },
    );
  }

  /*
   * 성공 응답에 **"바로 공개된다" 고 말하지 않는다.** 승인 후 노출이고,
   * 제출자는 자기 글을 다시 볼 수 없다(본인 확인 수단을 안 받는다).
   * 그 사실을 여기서 분명히 말해야 "올렸는데 안 보인다" 는 오해가 안 생긴다.
   */
  return NextResponse.json({ ok: true });
}

// ── 본문 읽기 ──────────────────────────────────────────────────────

interface Photo {
  full: Uint8Array;
  thumb: Uint8Array;
  ext: ReviewImageExt;
}

type Submission =
  | { ok: true; body: unknown; photos: Photo[] }
  | { ok: false; response: NextResponse };

function bad(status: number, error = "잘못된 요청입니다"): Submission {
  return { ok: false, response: NextResponse.json({ ok: false, error }, { status }) };
}

async function readSubmission(req: NextRequest): Promise<Submission> {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("multipart/form-data")) {
    const read = await readJsonBody(req);
    return read.ok ? { ok: true, body: read.body, photos: [] } : read;
  }

  /*
   * multipart 는 교차 출처 `<form>` 이 사전 요청 없이 보낼 수 있는 형식이다
   * (`lib/http.ts` 가 text/plain 을 거절하는 것과 같은 이유). JSON 경로는
   * 형식 자체가 막아 주지만 여기는 아니므로 출처를 직접 본다.
   */
  if (!isSameOrigin(req)) return bad(403);

  // `formData()` 는 본문을 다 받은 뒤 파싱한다 — 크기는 그 전에 끊는다.
  // 브라우저는 FormData 에 길이를 항상 붙인다. 길이를 숨긴 요청은 받지 않는다
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return bad(411);
  if (declared > MAX_UPLOAD_BODY) return bad(413, "사진 용량이 너무 커요. 장수를 줄여 다시 올려 주세요");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad(400);
  }

  const payload = form.get("payload");
  if (typeof payload !== "string" || payload.length > 32 * 1024) return bad(400);
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return bad(400);
  }

  const fulls = form.getAll("image");
  const thumbs = form.getAll("thumb");
  if (fulls.length !== thumbs.length) return bad(400);
  if (fulls.length > MAX_REVIEW_IMAGES) {
    return bad(400, `사진은 ${MAX_REVIEW_IMAGES}장까지 올릴 수 있어요`);
  }

  const photos: Photo[] = [];
  for (let i = 0; i < fulls.length; i += 1) {
    const f = fulls[i];
    const t = thumbs[i];
    if (typeof f === "string" || typeof t === "string") return bad(400);
    if (f.size === 0 || f.size > MAX_FULL_BYTES || t.size === 0 || t.size > MAX_THUMB_BYTES) {
      return bad(413, "사진 용량이 너무 커요. 다른 사진으로 올려 주세요");
    }
    const full = new Uint8Array(await f.arrayBuffer());
    const thumb = new Uint8Array(await t.arrayBuffer());
    // 형식은 앞 바이트로 판정한다 — 브라우저가 붙인 Content-Type 은 믿지 않는다.
    // 썸네일 경로를 원본에서 유도하므로(`thumbPath`) 둘의 형식이 같아야 한다
    const ext = sniffImage(full);
    if (!ext || sniffImage(thumb) !== ext) {
      return bad(415, "JPG·WebP 사진만 올릴 수 있어요");
    }
    photos.push({ full, thumb, ext });
  }
  return { ok: true, body, photos };
}

// ── 업로드 ─────────────────────────────────────────────────────────

type StorageClient = ReturnType<typeof createAdminClient>;

interface Uploaded {
  client: StorageClient;
  /** DB 에 적을 원본 경로 */
  paths: string[];
  /** 실제로 올라간 객체 전부(원본 + 썸네일) — 되돌릴 때 지울 목록 */
  objects: string[];
}

/** 128비트 무작위 — 경로가 곧 승인 전 사진의 유일한 가림막이다(010) */
function randomName(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function uploadPhotos(photos: Photo[]): Promise<Uploaded | null> {
  let client: StorageClient;
  try {
    client = createAdminClient();
  } catch (e) {
    console.error(
      "[/api/reviews] 사진 업로드 불가 — service_role 키 미설정:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }

  const paths = photos.map((p) => `r/${randomName()}.${p.ext}`);
  const jobs = photos.flatMap((p, i) => [
    { path: paths[i], bytes: p.full, ext: p.ext },
    { path: thumbPath(paths[i]), bytes: p.thumb, ext: p.ext },
  ]);

  const results = await Promise.all(
    jobs.map(async (j) => {
      const { error } = await client.storage
        .from(REVIEW_IMAGE_BUCKET)
        .upload(j.path, j.bytes, {
          contentType: CONTENT_TYPE[j.ext],
          // 이름이 무작위라 같은 주소의 내용이 바뀌는 일이 없다 — 오래 캐시한다
          cacheControl: "31536000",
          upsert: false,
        });
      if (error) console.error("[/api/reviews] 사진 업로드 실패:", j.path, error.message);
      return error ? null : j.path;
    }),
  );

  const objects = results.filter((p): p is string => p !== null);
  if (objects.length !== jobs.length) {
    // 일부만 올라간 상태로 두지 않는다 — 반쪽짜리 글이 승인 화면에 뜬다
    await removeObjects(client, objects);
    return null;
  }
  return { client, paths, objects };
}

async function removeObjects(client: StorageClient, objects: string[]) {
  if (objects.length === 0) return;
  const { error } = await client.storage.from(REVIEW_IMAGE_BUCKET).remove(objects);
  if (error) {
    // 지우지 못한 파일은 주소를 아무도 모르는 채로 남는다(공개는 안 된다).
    // 용량만 차지하므로 운영자가 알 수 있게 경로를 남긴다
    console.error("[/api/reviews] 되돌리기 실패 — 고아 파일:", objects.join(", "), error.message);
  }
}
