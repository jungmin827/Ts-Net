/**
 * 6개 대목표 검증 — `node scripts/verify-goals.mjs`
 *
 * 주장이 아니라 **확인된 사실**만 출력한다. 파일시스템·HTTP 응답·렌더된 HTML 을
 * 직접 읽고, 통과/실패와 함께 근거 수치를 적는다. dev 서버가 :3100 에 떠 있어야 한다.
 *
 * 브라우저가 있어야만 잴 수 있는 항목(대비비·색면 면적)은 여기서 재지 않고
 * `scripts/contrast-audit.js` 로 넘긴다 — 잴 수 없는 것을 잰 척하지 않는다.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FE = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(FE, "..");
const BASE = "http://localhost:3100";

const results = [];
const check = (goal, label, pass, detail) =>
  results.push({ goal, label, pass, detail });

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const has = (p) => existsSync(join(ROOT, p));

/**
 * dev 서버에 못 닿은 횟수. **판정 실패와 판정 불가는 다르다.**
 *
 * 이전 판은 서버가 꺼져 있으면 `fetch failed` 스택을 뱉고 **프로세스가
 * 죽었다.** 그러면 서버와 무관한 코드 검사 39개의 결과도 같이 사라진다 —
 * 서버를 띄울 수 없는 환경(CI, 다른 사람 노트북)에서 이 스크립트는
 * "아무것도 모르는" 도구가 된다. 끊기면 그 사실을 적고 계속 간다.
 */
let unreachable = 0;

async function http(path, init) {
  try {
    const res = await fetch(BASE + path, { redirect: "manual", ...init });
    return { status: res.status, text: await res.text().catch(() => "") };
  } catch {
    unreachable += 1;
    return { status: 0, text: "", down: true };
  }
}
const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

// ── G0 내부 링크가 실재하는 라우트를 가리키는가 ────────────────────────
/**
 * `/review` 는 Reviews 섹션이 **후기가 1건 이상일 때만** 그린다. 그래서 지금은
 * 라이브 HTML 에 그 링크가 없고, 라우트가 비어 있어도 아무 증상이 없다.
 * 깨진 링크는 **운영자가 후기를 넣는 순간** 켜진다 — 가장 늦게, 가장 안 좋은
 * 타이밍에. 데이터 상태와 무관하게 "코드가 거는 링크"와 "존재하는 라우트"를
 * 맞춰 두면 그 시점이 오기 전에 여기서 걸린다.
 */
{
  /**
   * 라우트 그룹 `(site)` `(admin)` 은 URL 에 안 나타난다. 한 그룹만 뒤지면
   * 어드민 링크가 전부 "없는 라우트" 로 잡혀 검사가 거짓 실패를 낸다 —
   * 거짓 실패는 몇 번 보면 무시하게 되고, 그때 진짜 하나가 섞여 들어온다.
   */
  const groups = readdirSync(join(FE, "app"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(FE, "app", d.name))
    .concat([join(FE, "app")]);

  /**
   * ⚠ 리터럴 구간은 **동적 디렉터리로 떨어지지 않는다.**
   *
   * 이전 판은 리터럴이 실재하지 않으면 `[...]` 디렉터리로 폴백했다. 그래서
   * `/notice/latest` 가 "존재하는 라우트" 로 통과했다 — `latest` 라는 디렉터리는
   * 없고 `[id]` 가 받는데, `[id]` 는 **숫자 id** 를 받는 자리라 런타임에는
   * `parseId` 가 404 를 낸다. 즉 검사는 통과하고 화면은 404 다.
   * 동적 구간은 `staticPath` 가 `:x` 로 표시해 넘기므로, 폴백은 그때만 쓴다.
   */
  const resolveIn = (base, segs) => {
    let dir = base;
    for (const seg of segs) {
      if (!existsSync(dir)) return false;
      const names = readdirSync(dir);
      const hit =
        seg === ":x"
          ? names.find((n) => /^\[.+\]$/.test(n))
          : names.find((n) => n === seg);
      if (!hit) return false;
      dir = join(dir, hit);
    }
    return existsSync(join(dir, "page.tsx"));
  };

  const routeExists = (path) => {
    const segs = path.split("/").filter(Boolean);
    if (segs.length === 0) return existsSync(join(FE, "app", "(site)", "page.tsx"));
    return groups.some((g) => resolveIn(g, segs));
  };

  /**
   * 템플릿 리터럴에서 **정적으로 알 수 있는 경로**만 뽑는다.
   *
   * 보간이 두 종류라서 한 규칙으로 못 다룬다:
   *   `` `/review/${r.id}` ``        → `/` 뒤에 붙었으니 **경로 구간**. `:x` 로 둔다.
   *   `` `/admin/leads${qs(...)}` `` → 슬래시 없이 붙었으니 쿼리·접미사다.
   *                                    거기서 **잘라낸다** (뒤는 알 수 없다).
   * `\$\{[^}]*\}` 로 한 번에 지우면 보간 안의 `}` (객체 리터럴) 에서 먼저
   * 끊겨 `:x)}` 같은 쓰레기가 남는다 — 그게 거짓 실패를 만들었다.
   * 중괄호 깊이를 세며 직접 훑는다.
   */
  const staticPath = (body) => {
    let out = "";
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] === "$" && body[i + 1] === "{") {
        const segment = out.endsWith("/");
        let depth = 1;
        let j = i + 2;
        for (; j < body.length && depth > 0; j += 1) {
          if (body[j] === "{") depth += 1;
          else if (body[j] === "}") depth -= 1;
        }
        if (!segment) return out.split("?")[0].split("#")[0];
        out += ":x";
        i = j - 1;
        continue;
      }
      out += body[i];
    }
    return out.split("?")[0].split("#")[0];
  };

  const linked = new Set();
  /** `href` 가 몇 번 나왔고 그중 몇 개를 정적으로 판정했는지 — 커버리지를 적는다 */
  const seen = { total: 0, resolved: 0 };
  const walk = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, n.name);
      if (n.isDirectory()) {
        if (n.name !== "node_modules") walk(full);
      } else if (/\.tsx?$/.test(n.name)) {
        const src = readFileSync(full, "utf8");
        /**
         * `href="/..."` 와 `` href={`/...`} `` 둘 다.
         *
         * 템플릿 리터럴의 `${...}` 를 **동적 구간으로 되살려서** 본다.
         * 그냥 잘라 버리면 `` `/review/${r.id}` `` 가 `/review` 로 줄어
         * 목록 페이지만 있으면 통과한다 — 정작 깨지는 건 `/review/1` 인데
         * 그걸 못 잡으면 이 검사를 넣은 이유가 사라진다.
         * 보간을 `:x` 로 바꿔 두면 라우트 해석기가 `[id]` 디렉터리에 맞춘다.
         */
        /*
         * ⚠ `href=` 만 보면 **대부분을 놓친다.** 이 코드베이스의 링크는
         * 상당수가 JSX 속성이 아니라 **객체 속성**으로 적혀 있다 —
         * `breadcrumb={{ href: "/review", … }}`, `SITE.nav` 의 항목,
         * `CARRIER_MENU` 의 slug 조합 등. 그쪽을 안 보면 검사가
         * "코드가 거는 내부 링크 전부" 라고 적으면서 실제로는 일부만 본다.
         * 그래서 `href=` 와 `href:` 두 표기를 같이 모으고, 아래에
         * **판정한 비율을 출력한다** — 못 본 게 몇인지 보이지 않으면
         * 커버리지가 줄어도 아무도 모른다.
         */
        seen.total += (src.match(/\bhref\s*[=:]/g) ?? []).length;
        const patterns = [
          /href=(?:"([^"#?]*)"|\{`([^`]*)`\})/g, // JSX 속성
          /href:\s*(?:"([^"#?]*)"|`([^`]*)`)/g, // 객체 속성
        ];
        for (const re of patterns) {
          for (const m of src.matchAll(re)) {
            const raw = staticPath(m[1] ?? m[2] ?? "");
            if (!raw.startsWith("/")) continue; // 외부 링크·앵커·tel:
            // 선두가 보간이면(`/${slug}`) 어느 라우트인지 정적으로 알 수 없다
            if (raw.startsWith("/:x")) continue;
            const v = raw.replace(/\/$/, "");
            if (v && !v.startsWith("/api")) {
              linked.add(v);
              seen.resolved += 1;
            }
          }
        }
      }
    }
  };
  walk(join(FE, "components"));
  walk(join(FE, "app"));

  const broken = [...linked].filter((v) => !routeExists(v));
  check(
    "G0",
    "코드가 거는 내부 링크가 전부 실재하는 라우트",
    broken.length === 0,
    broken.length
      ? `라우트 없음: ${broken.join(", ")} — 데이터가 들어오면 404 가 노출된다`
      : `고유 경로 ${linked.size}개 전부 라우트 존재 ` +
        `(href 표기 ${seen.total}곳 중 ${seen.resolved}곳을 정적으로 판정 — ` +
        `나머지는 변수·외부 링크·앵커)`,
  );
}

// ── G0a canonical 은 페이지마다, 루트에는 없다 ──────────────────────
/**
 * 루트 레이아웃의 메타는 **모든 페이지로 상속된다.** 거기에
 * `alternates.canonical: "/"` 를 넣었다가 `/kt` `/sk` `/review` 가 전부
 * `canonical = /` 로 나갔다 — 각 페이지가 스스로를 "홈의 중복" 이라고
 * 선언한 것이고, 그러면 색인에서 빠지는 쪽은 그 페이지다.
 * 증상이 브라우저에 안 보이고(화면은 멀쩡하다) 검색결과가 사라질 때까지
 * 몇 주가 걸리는 종류의 고장이라, 검사로 못 박는다.
 */
{
  const layout = read("FE/app/layout.tsx");
  // 주석 안의 언급은 센다고 치고 — 실제 속성만 본다
  const inRoot = /alternates\s*:\s*\{[^}]*canonical/.test(
    layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""),
  );
  check(
    "G0",
    "루트 레이아웃에 canonical 없음 (전 페이지 상속 방지)",
    !inRoot,
    inRoot
      ? "app/layout.tsx 의 alternates.canonical 이 모든 페이지로 상속된다"
      : "루트에 canonical 없음",
  );

  // 공개 라우트의 page.tsx 는 전부 자기 canonical 을 선언해야 한다
  const pages = [];
  const walk = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, n.name);
      if (n.isDirectory()) walk(full);
      else if (n.name === "page.tsx") pages.push(full);
    }
  };
  walk(join(FE, "app", "(site)"));
  const missing = pages.filter(
    (f) => !/alternates\s*:\s*\{[^}]*canonical/.test(readFileSync(f, "utf8")),
  );
  check(
    "G0",
    "공개 페이지가 각자 canonical 을 선언",
    missing.length === 0,
    missing.length
      ? missing.map((f) => f.replace(`${FE}/app/`, "")).join(", ")
      : `페이지 ${pages.length}개 전부 선언`,
  );
}

// ── G0b 게시판 본문의 두 불변식 ──────────────────────────────────────
{
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, n.name);
      if (n.isDirectory()) {
        if (n.name !== "node_modules") walk(full);
      } else if (/\.tsx?$/.test(n.name)) files.push(full);
    }
  };
  walk(join(FE, "app"));
  walk(join(FE, "components"));
  walk(join(FE, "lib"));

  /**
   * 1. 게시글 본문을 HTML 로 꽂지 않는다.
   *    운영자가 쓴 글이라 "믿을 수 있다" 고 생각하기 쉽지만, 어드민 계정이
   *    하나뿐이라(CLAUDE.md) 그 계정이 털리면 저장형 XSS 가 **모든 방문자**
   *    에게 실행된다. 평문 + `whitespace-pre-wrap` 으로 충분하다.
   */
  /*
   * 주석을 지우고 본다. 처음엔 원본을 그대로 훑어서 **"쓰지 말 것" 이라고
   * 적어 둔 주석**까지 위반으로 잡았다 — 검사가 자기 경고문을 위반으로
   * 신고하면 아무도 그 결과를 안 읽는다.
   */
  const strip = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /*
   * JSON-LD(`<script type="application/ld+json">`)는 예외다. 구조화 데이터를
   * 넣는 **표준 방법이 그것뿐**이고, `<` 를 `\u003c` 로 이스케이프하면
   * 스크립트가 깨질 경로가 없다. 그 두 조건을 같이 확인한다 —
   * ld+json 이라는 이유만으로 면제하면 이스케이프를 뺀 판이 통과한다.
   *
   * ⚠ 면제는 **구문 단위**다. 이전 판은 앞뒤 400자 안에 `ld+json` 과
   * 이스케이프가 있으면 면제했다 — 즉 JSON-LD **옆에** 본문 주입을 쓰면
   * 둘 다 통과했다. 같은 파일 안에 구조화 데이터와 게시글 렌더가 같이
   * 있는 건 흔한 배치라 가정이 아니다. 지금은 두 가지를 그 주입 지점
   * 자신에 대해 확인한다:
   *   ① 자기를 감싼 **여는 태그**가 `<script … application/ld+json`
   *   ② 자기 `__html` **표현식 안**에 `<` 이스케이프가 있다
   */
  /** `dangerouslySetInnerHTML={{ … }}` 의 중괄호 표현식을 균형 맞춰 잘라낸다 */
  const htmlExpr = (src, at) => {
    const open = src.indexOf("{", at);
    if (open === -1) return "";
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) return src.slice(open, i + 1);
      }
    }
    return src.slice(open);
  };

  /** 주입 지점을 감싼 여는 태그 (바로 앞의 `<` 부터 주입 지점까지) */
  const enclosingTag = (src, at) => {
    const lt = src.lastIndexOf("<", at);
    if (lt === -1) return "";
    const gt = src.indexOf(">", lt);
    // 태그가 주입 지점보다 먼저 닫혔으면 그 태그 안이 아니다
    if (gt !== -1 && gt < at) return "";
    return src.slice(lt, at);
  };

  const unsafe = files.filter((f) => {
    const src = strip(readFileSync(f, "utf8"));
    let i = src.indexOf("dangerouslySetInnerHTML");
    while (i !== -1) {
      const tag = enclosingTag(src, i);
      const expr = htmlExpr(src, i);
      const jsonLd =
        /^<script\b[^>]*application\/ld\+json/.test(tag) &&
        /replace\(\s*\/</.test(expr);
      if (!jsonLd) return true;
      i = src.indexOf("dangerouslySetInnerHTML", i + 1);
    }
    return false;
  });
  check(
    "G0",
    "게시글 본문을 HTML 로 꽂는 곳 없음",
    unsafe.length === 0,
    unsafe.length
      ? unsafe.map((f) => f.replace(`${FE}/`, "")).join(", ")
      : `검사 ${files.length}개 파일`,
  );

  /**
   * 2. PostgREST 의 `.or()` 는 **문자열을 파싱하는 필터 DSL** 이다.
   *    검색어가 SQL 파라미터가 아니라 그 DSL 의 일부로 들어가므로,
   *    `sanitizeQuery` 를 거치지 않은 값이 닿으면 조건을 하나 더 만들거나
   *    다른 열을 가리킬 수 있다. 호출 지점을 `lib/board-data.ts` 한 곳으로
   *    묶어 두고, 다른 파일에서 쓰이면 실패시킨다.
   */
  /*
   * 허용 지점은 두 곳이다 — 공개 게시판 검색(`lib/board-data.ts`)과
   * 어드민 명단 검색(`lib/admin/leads.ts`). 둘 다 `safeLikeTerm` 을 거쳐야
   * 하므로, `.or(` 를 쓰면서 그 함수를 부르지 않는 파일은 전부 실패다.
   * (어드민 쪽은 한동안 정리 없이 검색어를 그대로 끼워 넣고 있었다.)
   */
  /*
   * ⚠ **파일 단위가 아니라 호출 지점 단위로** 본다.
   *
   * 이전 판은 "`.or(` 를 쓰는 파일에 `safeLikeTerm` 이나 `SafeLikeTerm` 이
   * 나오는가" 였다. 그래서 이미 통과한 파일(`lib/board-data.ts`,
   * `lib/admin/leads.ts`)에 정리를 거치지 않은 `.or()` 를 **하나 더 더하면
   * 영원히 안 걸렸다.** 바로 그 두 파일이 검색 코드를 더할 가장 유력한
   * 자리다. `.or (` (공백)도 못 봤다.
   *
   * 지금 규칙: 모든 `.or(` 호출의 인자는 **`orFilter(...)` 호출**이어야 한다.
   * `orFilter` 는 `SafeFilter` 만 받고, `SafeFilter` 는 `ilikeTerm`(열 이름
   * 검증 + `SafeLikeTerm`)만 만들 수 있다 — 즉 조립 구간에 생문자열이
   * 들어갈 자리가 타입 단계에서 없다. 템플릿 리터럴을 허용하지 않는 이유가
   * 그것이다: 리터럴이 허용되는 한 `${}` 안에 무엇이 오는지는 사람이 본다.
   */
  const orSites = (src) => {
    const sites = [];
    const re = /\.or\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      for (; i < src.length && depth > 0; i += 1) {
        if (src[i] === "(") depth += 1;
        else if (src[i] === ")") depth -= 1;
      }
      sites.push(src.slice(start, i - 1).trim());
    }
    return sites;
  };

  const orProblems = [];
  for (const f of files) {
    const src = strip(readFileSync(f, "utf8"));
    const rel = f.replace(`${FE}/`, "");
    for (const arg of orSites(src)) {
      if (/^orFilter\s*\(/.test(arg)) continue;
      // 변수로 한 번 받아 넘기는 것도 허용 — 단 그 변수가 orFilter 결과여야 한다
      if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
        const declared = new RegExp(
          `(?:const|let|var)\\s+${arg}\\s*=\\s*orFilter\\s*\\(`,
        ).test(src);
        if (declared) continue;
        orProblems.push(`${rel}: ${arg} 가 orFilter 결과가 아니다`);
        continue;
      }
      orProblems.push(`${rel}: orFilter(...) 가 아닌 인자 — ${arg.slice(0, 48)}`);
    }
  }
  const orCount = files.reduce(
    (n, f) => n + orSites(strip(readFileSync(f, "utf8"))).length,
    0,
  );
  check(
    "G0",
    "PostgREST `.or()` 호출 전부가 정리된 패턴만 끼운다",
    orProblems.length === 0,
    orProblems.length
      ? orProblems.join(" / ")
      : `.or() 호출 ${orCount}곳 전부 orFilter(SafeFilter) 경유`,
  );
}

// ── G1 다모아 요금 정합 ────────────────────────────────────────────────
// 2026-10-08 다모아 라이브에서 수집한 **게시 금액 집합** (sub-01~04-test.php).
// 수집 범위: 요금표 셀 + 추천카드 + 각주 할인액 + 요금계산기가 선택에 따라
// 화면에 띄우는 값(인터넷/TV 단독가·휴대폰 정액결합가는 계산기에만 있다).
// 다모아가 게시하지 않는 금액이 우리 화면에 뜨면 여기서 걸린다 — 범위를 좁히지 말 것.
// 구분자 오타(`36.300`)가 원문에 그대로 있어 비교 전에 정규화한다.
// 판정 근거·수집 경로: docs/PRICE_CROSSCHECK_2026-10-08.md
const DAMOA = {
  kt: "5,500 10,670 16,500 22,000 23,100 24,750 27,750 34,100 34,500 34,750 37,500 38,500 39,600 40,000 45,100 49,000 49,500 50,600 53,000 55,000 56,000 56,100 58,850 60,000 60,500",
  sk: "4,400 6,600 8,800 9,900 16,500 19,800 23,100 23,250 24,450 24,750 25,650 25,750 27,750 28,600 28,950 29,250 30,150 30,250 31,900 33,750 34,100 36.300 39,000 39,600 42,900 45,000 46,200 48,400 50,600 51,700 53,900 55,000 56,100 57,650 60,500 60,750 61,950 62,250 62,260 62,700 63,150 63,250 66,750 68,200 89,000",
  lg: "5,500 9,900 13,200 19,800 22,000 23,100 29,600 30,850 31,900 31,950 33,000 33,050 34,100 35,250 38,500 39,600 41,350 41,800 42,450 42,900 43,550 43,750 45,100 45,750 46,200 47,000 48,400 49,500 49,750 52,800 53,750 53,900 57,200 58,300 61,000 61,600 63,750 69,350 85,000",
  skylife:
    "6,050 9,900 11,000 24,200 25,300 30,800 31,900 33,000 34,100 35,200 36,300 37,400 38,500 40,700 41,800 42,900 44,000 46,200 47,300 47,400",
};

async function g1() {
  let mismatch = 0;
  let shown = 0;
  for (const [c, raw] of Object.entries(DAMOA)) {
    const pub = new Set(raw.split(/\s+/).map((v) => v.replace(".", ",")));
    const { text } = await http(`/${c}`);
    // 네 자리(9,900원)와 여섯 자리(100,000원)도 본다.
    // 예전 정규식 `\d{2},\d{3}` 은 다섯 자리만 봤고, 그래서 시드 description 에 있는
    // `9,900원`·`6,050원` 이 화면에 나와도 "불일치 0개"가 찍혔다.
    // G1 은 표시광고 리스크를 막는 유일한 자동 장치라 범위를 좁히면 안 된다.
    const ours = [
      ...new Set(strip(text).match(/(?<![\d,])\d{1,3}(?:,\d{3})+(?=원)/g) ?? []),
    ];
    shown += ours.length;
    mismatch += ours.filter((v) => !pub.has(v)).length;
  }
  check("G1", "표시 금액이 전부 다모아 게시값에 존재", mismatch === 0,
    `표시 ${shown}개 · 불일치 ${mismatch}개`);

  const seed = readdirSync(join(ROOT, "BE/supabase/seed")).find((f) =>
    f.startsWith("plans_damoa_"));
  const rows = seed
    ? (read(`BE/supabase/seed/${seed}`).match(/^ {2}\('/gm) ?? []).length
    : 0;
  check("G1", "다모아 기준 시드 파일", rows === 72, `${seed ?? "없음"} · ${rows}행`);

  // 화면 검사(위)는 dev 서버에 Supabase 키가 없으면 plans 가 렌더되지 않아 시드 값을
  // 전혀 보지 못한다. 그래서 시드 **파일**의 금액도 같은 집합에 대조한다 — DB 가
  // 연결되는 순간 화면에 뜨게 될 값들이다. monthly_fee / list_fee / description 금액 전부.
  let seedBad = [];
  let seedSeen = 0;
  if (seed) {
    const pubOf = Object.fromEntries(
      Object.entries(DAMOA).map(([c, raw]) => [
        c.toUpperCase(),
        new Set(raw.split(/\s+/).map((v) => v.replace(".", ","))),
      ]),
    );
    const won = (n) => Number(n).toLocaleString("en-US");
    for (const line of read(`BE/supabase/seed/${seed}`).split("\n")) {
      const row = /^ {2}\('(\w+)'/.exec(line);
      if (!row) continue;
      const pub = pubOf[row[1]];
      const fee = /(\d{4,6}|NULL),\s*(\d{4,6}|NULL),\s*36,/.exec(line);
      const vals = [
        ...(fee ? [fee[1], fee[2]].filter((v) => v !== "NULL").map(won) : []),
        ...(line.match(/월 [\d,]+원/g) ?? []).map((m) => m.slice(2, -1)),
      ];
      seedSeen += vals.length;
      for (const v of vals) if (!pub.has(v)) seedBad.push(`${row[1]} ${v}`);
    }
  }
  // 같은 구성(통신사 + 속도 + TV 등급)이 두 값으로 적혀 있으면 하나는 틀린 것이다.
  // 추천 카드용 행과 요금표용 행이 같은 상품을 가리키는데 금액이 다른 경우가 그렇다.
  // **외부 레퍼런스 없이 시드 자체만으로 성립하는 검사**라, 다모아가 바뀌어도 유효하다.
  // 구 시드(현재 라이브 DB)에 돌리면 교차검증이 찾아낸 B·C 두 건을 그대로 잡아낸다.
  const SPEED = ["1G", "500MB", "500M", "200M", "100M"];
  const conflicts = [];
  if (seed) {
    const combo = new Map();
    for (const line of read(`BE/supabase/seed/${seed}`).split("\n")) {
      const m =
        /^ {2}\('(\w+)',\s*'BUNDLE',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),/.exec(line);
      if (!m) continue;
      const [, carrier, name, rawSpeed, tv, fee] = m;
      const sp = SPEED.find((k) => rawSpeed.startsWith(k));
      if (!sp) continue;
      const key = `${carrier} ${sp === "500MB" ? "500M" : sp} ${tv}`;
      const list = combo.get(key) ?? [];
      list.push({ fee: Number(fee), name });
      combo.set(key, list);
    }
    for (const [key, list] of combo) {
      const prices = new Set(list.map((v) => v.fee));
      if (prices.size > 1) {
        conflicts.push(
          `${key} ${list.map((v) => `${v.fee.toLocaleString()}(${v.name})`).join(" vs ")}`,
        );
      }
    }
  }
  check("G1", "같은 구성이 한 값으로만 적힘", conflicts.length === 0,
    conflicts.length ? conflicts.slice(0, 3).join(" / ") : "추천 행과 요금표 행이 일치");

  check("G1", "시드 금액이 전부 다모아 게시값에 존재", seed && seedBad.length === 0,
    `검사 ${seedSeen}개 · 불일치 ${seedBad.length}개${seedBad.length ? ` (${seedBad.slice(0, 5).join(", ")})` : ""}`);

  const old = read("BE/supabase/seed/plans_2026-09-28.sql");
  check("G1", "구 시드의 레퍼런스 카피 제거", !/'[^']*DPS[^']*'/.test(old),
    "폐기 배너 + description NULL 처리");
}

// ── G2 레퍼런스 수준 UI ────────────────────────────────────────────────
async function g2() {
  const { text } = await http("/");
  // 2026-10-14 축소 — 레퍼런스(인터넷다모아) 메인은 섹션 5개다.
  // 히어로·통신사·상담방식·절차 + (후기·현황은 데이터가 있을 때만) + 푸터 밴드
  const sections = (text.match(/<section/g) ?? []).length;
  check("G2", "메인 섹션 수 ≤ 8 (레퍼런스 5)", sections >= 4 && sections <= 8, `${sections}개`);

  const cues = (text.match(/href="#consult"/g) ?? []).length;
  check("G2", "본문 전환 수단 (헤더·푸터 포함)", cues >= 2, `${cues}개`);

  let notices = 0;
  for (const c of ["kt", "sk", "lg", "skylife"]) {
    const r = await http(`/${c}`);
    if (r.status !== 200) {
      check("G2", `/${c} 응답`, false, `HTTP ${r.status}`);
      return;
    }
    notices += (r.text.match(/<details/g) ?? []).length;
  }
  check("G2", "상세페이지 아코디언(4사 합계)", notices >= 30, `${notices}개`);
  check("G2", "미등록 slug 404", (await http("/nope")).status === 404, "");

  const css = read("FE/app/globals.css");
  check("G2", "전환 기본 이징 통일", css.includes("--default-transition-timing-function"),
    "cubic-bezier(0.22,1,0.36,1)");
}

// ── G3 어드민 엑셀 내보내기 ────────────────────────────────────────────
async function g3() {
  for (const [p, want] of [["/admin", 307], ["/admin/leads", 307], ["/admin/login", 200]]) {
    const r = await http(p);
    check("G3", `${p} 가드`, r.status === want, `HTTP ${r.status}`);
  }
  check("G3", "export GET 차단(CSRF)", (await http("/api/admin/export")).status === 405, "405");
  check("G3", "export POST 교차출처 차단",
    (await http("/api/admin/export", { method: "POST", headers: { Origin: "https://evil.example" } })).status === 403, "403");
  check("G3", "export POST 동일출처 인증요구",
    (await http("/api/admin/export", { method: "POST", headers: { Origin: BASE } })).status === 401, "401");
  check("G3", "TOTP 등록 페이지", has("FE/app/(admin)/admin/enroll-2fa/page.tsx"), "aal1 로 진입 가능");
  check("G3", "xlsx 생성기", has("FE/lib/admin/excel.ts"), "exceljs");
  const migs = readdirSync(join(ROOT, "BE/supabase/migrations")).sort();
  // 라벨을 "첫"이라고 적었지만 보는 것은 세 번째 파일이다. 단언은 맞고 말이 틀렸다.
  check("G3", "보안 차단이 004 보다 먼저", migs[2]?.startsWith("003_lock_down"), migs.join(" "));
}

// ── G4 오프화이트 + 블랙, 초록은 헤더만 ─────────────────────────────
function g4() {
  const css = read("FE/app/globals.css");
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const scope = css.match(/\.brand-scope\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const tok = (src, n) => (src.match(new RegExp(`--${n}:\\s*([^;]+);`)) ?? [])[1]?.trim();
  check("G4", "본문 배경 오프화이트", tok(root, "background") === "#fafaf8", tok(root, "background"));
  check("G4", "본문 요소색 블랙 계열", tok(root, "brand") === "#141414", tok(root, "brand"));
  check("G4", "헤더만 브랜드 그린", tok(scope, "brand") === "#07b040", tok(scope, "brand"));
  const header = read("FE/components/sections/Header.tsx");
  check("G4", "헤더에 brand-scope 적용", (header.match(/brand-scope/g) ?? []).length >= 2, "바 + 모바일 드로어");
  const src = ["FE/components", "FE/app"].flatMap((d) =>
    readdirSync(join(ROOT, d), { recursive: true })
      .filter((f) => /\.(tsx|ts|css)$/.test(f))
      .map((f) => read(`${d}/${f}`)),
  ).join("\n");
  const carrier = (src.match(/carrier-(kt|sk|lg|skylife)|colorVar|inkVar|CARRIER_COLOR/g) ?? []).length;
  check("G4", "통신사색 참조 없음", carrier === 0, `${carrier}곳`);
  check("G4", "포커스 링 border-radius 제거",
    !/:focus-visible\s*\{[^}]*border-radius/.test(css), "요소 곡률을 따름");
}

// ── G5 홍보 이미지 삽입 구조 ───────────────────────────────────────────
async function g5() {
  const cfg = read("FE/lib/site-config.ts");
  // `PromoSlotName` 의 유니온 멤버를 센다.
  // 예전 판은 `slots + 1` 로 숫자를 틀리게 찍고, `|| used >= 5` 때문에
  // **정의와 삽입이 어긋나도 항상 통과**했다. 과대 표기를 막으려고 만든
  // 스크립트 안에서 과대 표기가 한 번 더 일어나고 있었다.
  const slotBlock = cfg.match(/export type PromoSlotName =[\s\S]*?;/)?.[0] ?? "";
  const slots = (slotBlock.match(/"[A-Za-z]+"/g) ?? []).length;
  /*
   * 삽입 지점은 **메인과 통신사 상세페이지 둘 다** 센다.
   * 한동안 메인만 읽어서, 상세페이지 슬롯 3개를 추가한 순간
   * "정의 8 · 삽입 5" 로 실패했다 — 검사가 틀렸고 코드는 맞았다.
   * 요구사항의 "상세페이지 홍보 이미지" 자리가 상세페이지에 있는 건
   * 당연한데, 검사는 메인만 세상의 전부로 알고 있었다.
   */
  const slotPages = [
    "FE/app/(site)/page.tsx",
    "FE/app/(site)/[carrier]/page.tsx",
  ];
  const used = slotPages.reduce(
    (n, f) => n + (read(f).match(/<PromoSlot slot=/g) ?? []).length,
    0,
  );
  check("G5", "슬롯 정의 = 삽입 지점", slots > 0 && slots === used, `정의 ${slots} · 삽입 ${used}`);
  check("G5", "빈 슬롯은 섹션 미렌더", read("FE/components/sections/PromoSlot.tsx").includes("return null"), "");

  // alt 가 비어 있으면 그 이미지는 보조기기에서 통째로 사라진다. 화면에 뜨기 전에 잡는다.
  // (`PromoSlot` 도 런타임에 막지만, 막혀서 안 보이는 것보다 여기서 걸리는 편이 낫다)
  const emptyAlt = [...cfg.matchAll(/id:\s*"([^"]+)"[\s\S]{0,420}?alt:\s*"(\s*)"/g)].map((m) => m[1]);
  check("G5", "모든 홍보 이미지에 alt", emptyAlt.length === 0,
    emptyAlt.length ? `빈 alt: ${emptyAlt.join(", ")}` : "빈 alt 없음");
  check("G5", "데스크톱/모바일 소스 분리", cfg.includes("mobileWidth"), "");
  check("G5", "운영자 가이드", has("docs/PROMO_IMAGE_GUIDE.md"), "");
  // 슬롯은 운영자 이미지가 들어올 자리다. 2026-10-14 에 자체 제작 이미지를 내렸으므로
  // 지금은 비어 있는 것이 정상이다 (실제 렌더 수는 세지 않는다).
}

// ── 라이브 DB 상태 ─────────────────────────────────────────────────────
// 코드가 준비됐다는 것과 **라이브에 반영됐다**는 것은 다르다.
// 이 구간을 분리해 둬야 "파일만 고쳐놓고 완료"라고 적는 착각을 막는다.
// 공개 anon 키로 읽기만 한다 — 쓰기나 파기 함수 호출은 절대 하지 않는다.
async function live() {
  const env = (() => {
    try {
      const t = readFileSync(join(FE, ".env.local"), "utf8");
      const g = (k) => (t.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
      return { url: g("NEXT_PUBLIC_SUPABASE_URL"), key: g("NEXT_PUBLIC_SUPABASE_ANON_KEY") };
    } catch {
      return {};
    }
  })();
  if (!env.url || !env.key) {
    check("LIVE", "Supabase 연결 정보", false, ".env.local 미설정 — 라이브 검증 생략");
    return;
  }

  const rest = async (path) => {
    try {
      const r = await fetch(`${env.url}/rest/v1/${path}`, {
        headers: { apikey: env.key, Prefer: "count=exact", Range: "0-0" },
      });
      return { status: r.status, range: r.headers.get("content-range") };
    } catch (e) {
      return { status: 0, err: String(e) };
    }
  };

  const plans = await rest("plans?select=id");
  const total = plans.range?.split("/")[1];
  check("LIVE", "plans 행 수 (목표 72)", total === "72",
    `${total ?? "조회실패"}행 — 72가 아니면 시드 미적용`);

  const withDesc = await rest("plans?select=id&description=not.is.null");
  const dcount = withDesc.range?.split("/")[1];
  check("LIVE", "레퍼런스 카피 제거 (목표 9)", dcount === "9",
    `description 있는 행 ${dcount ?? "?"}개 — 12면 구 시드 그대로`);

  /*
   * 파기 함수가 익명에게 **닫혀 있는지**.
   *
   * ⚠ 처음에는 `OPTIONS` 로만 확인하고 "호출하지 않으니 안전하다" 고 적어
   *   뒤었다. 그게 **거짓 실패**를 만들었다 — `OPTIONS` 는 PostgREST 의
   *   프리플라이트라 **함수 실행 권한을 보지 않고** 늘 200 을 준다.
   *   003 을 실제로 적용한 뒤에도 이 검사만 계속 실패했고, 하마터면
   *   "003 이 안 먹었다" 고 판단할 뻔했다.
   *
   * 권한은 실제 호출로만 확인된다. 그래서 `POST` 한다 — 권한이 없으면
   * 함수 본문이 **실행되기 전에** 거부되므로(`permission denied for function`)
   * 데이터를 건드리지 않는다. 권한이 열려 있다면 그건 그 자체가 결함이고,
   * 이 검사가 잡아내야 하는 바로 그 상태다.
   */
  let rpc = "확인불가";
  let rpcMsg = "";
  try {
    const r = await fetch(`${env.url}/rest/v1/rpc/purge_expired_leads`, {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    rpc = String(r.status);
    rpcMsg = await r.text().then(
      (t) => {
        try {
          return String(JSON.parse(t).message ?? "").slice(0, 60);
        } catch {
          return t.slice(0, 60);
        }
      },
      () => "",
    );
  } catch { /* 네트워크 오류는 확인불가로 둔다 */ }
  // 401/403 = 권한 거부, 404 = 함수가 anon 스키마에 아예 안 보임. 전부 "닫힘".
  const rpcClosed = ["401", "403", "404"].includes(rpc);
  check("LIVE", "파기 함수 익명 호출 차단 (003 적용 여부)", rpcClosed,
    rpcClosed
      ? `POST ${rpc} — ${rpcMsg || "거부됨"}`
      : `POST ${rpc} — 200/2xx 면 익명이 파기 함수를 실행할 수 있다 (003 미적용)`);

  const feed = await rest("live_feed?select=masked_name");
  const fcount = feed.range?.split("/")[1];
  check("LIVE", "live_feed 5건 게이트", fcount === "0" || Number(fcount) >= 5,
    `${fcount ?? "?"}건 노출 — 1~4건이면 게이트 미적용`);
}

await g1(); await g2(); await g3(); g4(); await g5();
await live();

const pad = (s, n) => String(s).padEnd(n);
let codeFail = 0;
let liveFail = 0;
let cur = "";
for (const r of results) {
  if (r.goal !== cur) { cur = r.goal; console.log(`\n[${cur}]`); }
  if (!r.pass) {
    if (r.goal === "LIVE") liveFail++;
    else codeFail++;
  }
  console.log(`  ${r.pass ? "통과" : "실패"}  ${pad(r.label, 34)} ${r.detail}`);
}
const codeTotal = results.filter((r) => r.goal !== "LIVE").length;
const liveTotal = results.length - codeTotal;
console.log(`\n코드 ${codeTotal}개 중 실패 ${codeFail}개 · 라이브 ${liveTotal}개 중 실패 ${liveFail}개`);
if (unreachable) {
  console.log(
    `⚠ dev 서버(${BASE})에 ${unreachable}회 못 닿았다 — 페이지를 받아 보는 검사는 ` +
      `**판정 불가**이며 위 집계에서 실패로 들어가 있다. \`npm run dev\` 후 다시 돌릴 것.`,
  );
}
if (liveFail) console.log("라이브 실패는 BE/APPLY.md 절차를 실행하면 해소된다 (DB 자격증명 필요).");
process.exit(codeFail ? 1 : 0);
