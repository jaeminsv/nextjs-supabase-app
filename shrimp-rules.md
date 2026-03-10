# 개발 가이드라인

## 프로젝트 개요

- **목적**: KAIST 실리콘밸리 동문회 이벤트 관리 MVP 웹앱
- **기술 스택**: Next.js 16 App Router + Supabase + TypeScript + Tailwind CSS + shadcn/ui
- **핵심 기능**: 이벤트 CRUD, RSVP 관리, 회비 추적, 회원 관리 (admin 승인)
- **대상 사용자**: KAIST SV 동문 약 300명, 모바일 우선 접근

## 프로젝트 아키텍처

### 디렉토리 구조

```
app/                    # Next.js App Router 페이지
  auth/                 # 인증 관련 라우트 (login, sign-up, callback 등)
  protected/            # 인증 필요 영역
components/             # 공용 컴포넌트
  ui/                   # shadcn/ui 컴포넌트 (직접 수정 금지)
  icons/                # 커스텀 아이콘
lib/                    # 유틸리티 및 라이브러리
  supabase/             # Supabase 클라이언트 (3-레이어)
docs/                   # 기획 문서
  guides/               # 개발 가이드
  superpowers/specs/    # 설계 명세서
proxy.ts                # Next.js 16 Proxy (middleware 대체)
```

### 경로 별칭 규칙

| 별칭                          | 실제 경로         | 용도                |
| ----------------------------- | ----------------- | ------------------- |
| `@/components`                | `./components`    | 공용 컴포넌트       |
| `@/components/ui` 또는 `@/ui` | `./components/ui` | shadcn/ui 컴포넌트  |
| `@/lib`                       | `./lib`           | 유틸리티/라이브러리 |
| `@/hooks`                     | `./hooks`         | 커스텀 훅           |

- **반드시** `@/` 경로 별칭을 사용할 것. 상대 경로(`../../`) 사용 금지

### Supabase 3-레이어 클라이언트

| 파일                     | 용도                               | 사용 컨텍스트                                            |
| ------------------------ | ---------------------------------- | -------------------------------------------------------- |
| `lib/supabase/client.ts` | 브라우저용 (`createBrowserClient`) | `'use client'` 컴포넌트에서만 사용                       |
| `lib/supabase/server.ts` | Server Component/Server Action용   | **매 요청마다 새 인스턴스 생성** — 글로벌 변수 저장 금지 |
| `lib/supabase/proxy.ts`  | 세션 갱신용 (`getClaims()`)        | `proxy.ts`에서만 호출                                    |

- **금지**: 서버 클라이언트를 글로벌 변수에 캐싱하는 것
- **금지**: `'use client'` 컴포넌트에서 `lib/supabase/server.ts` import
- **금지**: Server Component에서 `lib/supabase/client.ts` import
- **필수**: `lib/supabase/database.types.ts`의 `Database` 타입을 모든 Supabase 클라이언트에 제네릭으로 전달

### Next.js 16 Proxy (middleware 대체)

- `proxy.ts`(프로젝트 루트)가 `middleware.ts`를 **완전히 대체**함
- `proxy()` 함수를 export하고, 내부에서 `lib/supabase/proxy.ts`의 `updateSession()` 호출
- `middleware.ts` 파일을 **절대 생성하지 말 것**
- `supabase.auth.getClaims()` 호출을 **절대 제거하지 말 것** — 사용자 세션 무작위 로그아웃 발생

## 코드 컨벤션

### 언어 규칙

| 항목          | 언어             |
| ------------- | ---------------- |
| 응답/대화     | 한국어           |
| 코드 주석     | 영어             |
| 커밋 메시지   | 영어             |
| 문서 파일     | 영어             |
| 변수명/함수명 | 영어 (camelCase) |

### 포맷팅

- **들여쓰기**: 스페이스 2칸
- **네이밍**: camelCase (변수, 함수), PascalCase (컴포넌트, 타입)
- **주석**: 영어로 작성, 초보자도 이해할 수 있도록 상세하게
- **Prettier**: `.prettierrc.json` 설정 준수, `prettier-plugin-tailwindcss`로 Tailwind 클래스 자동 정렬

### 코드 품질 검증

- 코드 변경 후 커밋 전에 반드시 `npm run check-all` 실행
- `check-all` = `lint` + `typecheck` + `format:check`
- Husky + lint-staged가 커밋 시 자동으로 staged 파일 검증

## 기능 구현 표준

### 사용자 역할 시스템

| 역할        | 레벨         | 권한                                                 |
| ----------- | ------------ | ---------------------------------------------------- |
| `pending`   | 프로필       | 승인 대기 화면만 접근 가능                           |
| `member`    | 프로필       | 이벤트 조회, RSVP, 납부 신고, 프로필 편집            |
| `admin`     | 프로필       | 전체 접근 + 회원 승인 + 이벤트 생성 + organizer 위임 |
| `organizer` | **이벤트별** | 할당된 이벤트 관리 (편집, RSVP 조회, 납부 확인)      |

- **중요**: `organizer`는 프로필 레벨 역할이 **아님**. `event_organizers` 조인 테이블로 이벤트별 결정
- RLS 정책에서 organizer 권한 확인 시 반드시 `event_organizers` 테이블 JOIN 필요

### 데이터 모델 (5개 테이블)

| 테이블             | 설명               | 핵심 규칙                                                        |
| ------------------ | ------------------ | ---------------------------------------------------------------- |
| `profiles`         | auth.users 확장    | 삭제 불가, `role` enum: pending/member/admin                     |
| `events`           | 이벤트 정보        | 삭제 불가 — `cancelled` 상태 사용                                |
| `event_organizers` | 이벤트별 organizer | 복합 PK (event_id, user_id)                                      |
| `rsvps`            | 참가 응답          | unique (event_id, user_id), 게스트 수 = 본인 외 추가 인원        |
| `payments`         | 납부 기록          | rejected 후 재제출 가능, pending/confirmed는 이벤트+유저당 1건만 |

### 이벤트 상태 전이

```
draft → published → cancelled
                  → completed
cancelled → published (재오픈)
```

- **하드 삭제 절대 금지** — `cancelled` 상태로 변경

### 게스트 수 의미론

- `adult_guest_count`, `child_guest_count` = 본인 제외 추가 인원
- **총 인원 계산**: `1(본인) + adult_guest_count + child_guest_count`
- **회비 계산**: `fee_amount + adult_guest_count × adult_guest_fee + child_guest_count × child_guest_fee`

### RSVP 정책

- 마감(`rsvp_deadline` 또는 `start_at`) 전까지만 변경 가능
- 마감 후 RSVP 잠김

### 납부 정책

- `rejected` 상태의 납부 기록은 새 레코드로 재제출
- 이벤트+유저당 `pending` 또는 `confirmed` 상태는 1건만 허용 (앱 로직으로 제어)

## 프레임워크/라이브러리 사용 표준

### shadcn/ui

- **스타일**: `new-york`
- **RSC 지원**: 활성화 (`"rsc": true`)
- **아이콘**: `lucide-react` 전용
- `components/ui/` 디렉토리의 파일을 직접 수정하지 말 것 — `shadcn` CLI로 관리
- 새 컴포넌트 추가 시: `npx shadcn@latest add <component-name>`

### Tailwind CSS

- CSS 변수 기반 테마 사용 (`cssVariables: true`)
- 다크모드: `next-themes`, `attribute="class"`
- Tailwind 클래스 정렬은 Prettier 플러그인이 자동 처리

### 폼 처리 (구현 예정)

- React Hook Form + Zod validation 사용
- `docs/guides/forms-react-hook-form.md` 참조

### 상태 관리 (구현 예정)

- Zustand 사용

## 워크플로우 표준

### 개발 단계 (Structure-First Approach)

```
Phase 1: 앱 스켈레톤 → Phase 2: 더미 데이터 UI → Phase 3: 실제 API 연동 → Phase 4: 배포
```

- Phase 2까지는 DB 연동 없이 더미 데이터로 UI/UX 검증
- DB 마이그레이션은 Phase 3에서 진행

### 개발 명령어

| 명령어              | 용도                                        |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | 개발 서버 (http://localhost:3000)           |
| `npm run build`     | 프로덕션 빌드                               |
| `npm run lint`      | ESLint 실행 (`eslint .` — `next lint` 아님) |
| `npm run lint:fix`  | ESLint 자동 수정                            |
| `npm run typecheck` | TypeScript 타입 체크                        |
| `npm run format`    | Prettier 포맷팅 적용                        |
| `npm run check-all` | lint + typecheck + format:check 통합 검사   |

- **주의**: `next lint`가 아닌 `eslint .`을 사용 (Next.js 16에서 `next lint` 제거됨)

### 커밋 규칙

- 이모지 + 컨벤셔널 커밋 형식: `<이모지> <타입>: <설명>`
- 커밋 전 `npm run check-all` 통과 필수
- Husky pre-commit hook이 자동으로 lint + format 실행

## 핵심 파일 상호작용 표준

### 인증 흐름 수정 시

| 변경 대상                | 함께 확인/수정할 파일                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 로그인/회원가입 로직     | `app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx`, `components/login-form.tsx`, `components/sign-up-form.tsx` |
| 세션/쿠키 처리           | `lib/supabase/proxy.ts`, `proxy.ts` (두 파일 동시 확인)                                                            |
| Supabase 클라이언트 변경 | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts` (3개 동시 확인)                        |
| DB 스키마 변경           | `lib/supabase/database.types.ts` 재생성 필수                                                                       |

### 새 페이지 추가 시

1. `app/` 아래 라우트 디렉토리 생성
2. 인증 필요 페이지는 `app/protected/` 하위에 배치
3. 공통 레이아웃이 필요하면 `layout.tsx` 추가
4. `proxy.ts`의 matcher 패턴에 새 경로가 포함되는지 확인

### shadcn/ui 컴포넌트 추가 시

1. `npx shadcn@latest add <name>` 으로 설치
2. `components/ui/` 에 자동 생성됨
3. 해당 컴포넌트의 Radix UI 의존성이 `package.json`에 추가되었는지 확인

## AI 의사결정 표준

### Supabase 클라이언트 선택

```
브라우저에서 실행? → client.ts
Server Component / Server Action? → server.ts
Proxy(세션 갱신)? → proxy.ts
```

### 역할 권한 확인 순서

```
1. admin인가? → 전체 접근
2. event_organizers 테이블에 해당 이벤트+유저가 있는가? → 해당 이벤트 관리 권한
3. member인가? → 일반 회원 접근
4. pending인가? → 승인 대기 화면만
```

### 페이지 배치 판단

```
인증 불필요 (로그인/회원가입)? → app/auth/
인증 필요? → app/protected/
```

### 데이터 삭제 판단

```
이벤트 삭제 요청? → cancelled 상태로 변경 (하드 삭제 금지)
프로필 삭제 요청? → 삭제 금지
RSVP 삭제 요청? → DELETE 허용 (본인만)
납부 기록 삭제 요청? → 삭제 금지 (rejected 후 새 레코드 생성)
```

## 금지 사항

- **`middleware.ts` 파일 생성 금지** — Next.js 16에서는 `proxy.ts` 사용
- **`next lint` 명령어 사용 금지** — `eslint .` 사용
- **`components/ui/` 파일 직접 수정 금지** — shadcn CLI로 관리
- **Supabase 서버 클라이언트를 글로벌 변수에 저장 금지**
- **이벤트/프로필/납부 기록 하드 삭제 금지**
- **`supabase.auth.getClaims()` 호출 제거 금지**
- **상대 경로(`../../`) import 금지** — `@/` 별칭 사용
- **`.env.local` 파일 커밋 금지**
- **일반 개발 지식(React 기초, TypeScript 기본 등) 문서에 포함 금지**

## 참고 문서

| 문서              | 위치                                                               | 내용                                      |
| ----------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| 설계 명세서       | `docs/superpowers/specs/2026-03-10-event-management-mvp-design.md` | 데이터 모델, RLS, 화면 설계, 유저 플로우  |
| PRD               | `docs/PRD.md`                                                      | 기능 목록 (F001-F015), 페이지별 상세 기능 |
| 로드맵            | `docs/ROADMAP.md`                                                  | 4단계 19개 태스크, 구현 순서              |
| 린 캔버스         | `docs/LEANCANVAS.md`                                               | 비즈니스 모델 개요                        |
| Next.js 16 가이드 | `docs/guides/nextjs-16.md`                                         | Breaking Changes 및 마이그레이션          |
| 프로젝트 구조     | `docs/guides/project-structure.md`                                 | 폴더/네이밍 컨벤션                        |
| 스타일링 가이드   | `docs/guides/styling-guide.md`                                     | Tailwind + shadcn/ui 사용법               |
| 컴포넌트 패턴     | `docs/guides/component-patterns.md`                                | 컴포넌트 설계 패턴                        |
| 폼 가이드         | `docs/guides/forms-react-hook-form.md`                             | React Hook Form 사용법                    |
