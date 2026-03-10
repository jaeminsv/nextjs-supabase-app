# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 명령어

```bash
npm run dev          # 개발 서버 실행 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run lint         # ESLint 실행 (eslint .) — next lint가 아님 (Next.js 16에서 제거됨)
npm run lint:fix     # ESLint 자동 수정
npm run typecheck    # TypeScript 타입 체크 (tsc --noEmit)
npm run format       # Prettier 포맷팅 적용
npm run format:check # Prettier 포맷팅 검사 (CI용)
npm run check-all    # lint + typecheck + format:check 통합 검사
```

## 아키텍처

Next.js 16 App Router + Supabase 기반 풀스택 앱. React 19, TypeScript, Tailwind CSS, shadcn/ui 사용.

### Supabase 인증 흐름 (3-레이어 구조)

Supabase 클라이언트는 용도에 따라 3가지로 분리되어 있으며, 각각 올바른 컨텍스트에서만 사용해야 한다:

- **`lib/supabase/client.ts`** — 브라우저용 (`createBrowserClient`). `'use client'` 컴포넌트에서 사용
- **`lib/supabase/server.ts`** — Server Component/Server Action용 (`createServerClient` + cookies). **매번 새 인스턴스를 생성해야 함** (글로벌 변수에 저장 금지)
- **`lib/supabase/proxy.ts`** — `proxy.ts`에서 세션 갱신용. `supabase.auth.getClaims()`를 호출하여 세션을 유지하며, 미인증 사용자를 `/auth/login`으로 리다이렉트

### Proxy (구 Middleware)

`proxy.ts` (프로젝트 루트)가 `middleware.ts`를 대체한다 (Next.js 16 변경). `proxy()` 함수를 export하며, `lib/supabase/proxy.ts`의 `updateSession()`을 호출한다.

### 라우트 구조

- `/` — 홈페이지
- `/auth/*` — 인증 관련 (login, sign-up, forgot-password, update-password, confirm, error)
- `/protected` — 인증 필요 영역 (proxy에서 리다이렉트 처리)

### 환경변수

`.env.local`에 설정:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 경로 별칭

`@/components`, `@/lib`, `@/components/ui` (`@/ui`), `@/hooks`

## 코드 컨벤션

- **shadcn/ui**: new-york 스타일, RSC 지원 활성화, 아이콘은 lucide-react
- **스타일링**: Tailwind CSS + CSS 변수 기반 테마 (다크모드: next-themes, `attribute="class"`)
- **들여쓰기**: 스페이스 2칸
- **네이밍**: camelCase
- **주석**: 영어로 작성, 초보자도 이해할 수 있도록 자세히
- **커밋/문서**: 영어로 작성
- **응답 언어**: 한국어

## 코드 품질 도구

- **ESLint**: `eslint.config.mjs` (flat config). `next/core-web-vitals` + `next/typescript` + `eslint-config-prettier`
- **Prettier**: `.prettierrc.json`. `prettier-plugin-tailwindcss`로 Tailwind 클래스 자동 정렬
- **Husky + lint-staged**: 커밋 시 자동으로 staged 파일에 ESLint + Prettier 실행
- **커밋 전 자동 검증**: `ts,tsx,js` → ESLint fix + Prettier, `json,md,css` → Prettier only
- 코드 변경 후 커밋 전에 `npm run check-all`로 전체 검사 권장

## 참고 문서

`docs/guides/` 디렉토리에 개발 가이드가 있음:

- `nextjs-16.md` — Next.js 16 개발 지침 및 Breaking Changes
- `project-structure.md` — 폴더 구조 및 네이밍 컨벤션
- `styling-guide.md` — Tailwind + shadcn/ui 가이드
- `component-patterns.md` — 컴포넌트 패턴
- `forms-react-hook-form.md` — React Hook Form 사용 가이드
