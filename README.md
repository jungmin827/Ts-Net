# TS-net

국내 통신(인터넷·IPTV) 가입 인바운드 DB수집 랜딩 사이트.
전체 컨텍스트는 `CLAUDE.md`, 기능 명세는 `docs/SPEC.md`.

## 구조

| 폴더 | 내용 |
|---|---|
| `FE/` | Next.js 15 (App Router, TS, Tailwind v4) — 랜딩 + 어드민 + API Route Handler |
| `BE/` | Supabase — DB 스키마·마이그레이션·설정 (설정 절차: `BE/README.md`) |
| `docs/` | `SPEC.md` 기능 명세 — 작업 전 필독 |

## 개발 시작

```sh
cd FE
cp .env.example .env.local   # 값 채우기 (BE/README.md 8번 참고)
npm install
npm run dev
```
