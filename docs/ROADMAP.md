# KAIST 실리콘밸리 동문회 이벤트 관리 MVP - 개발 로드맵

카카오톡 + 구글 스프레드시트에 흩어진 이벤트 관리와 회비 추적을 단일 모바일 웹 앱으로 통합하는 프로젝트.

## 개요

약 300명의 KAIST 실리콘밸리 동문을 위한 이벤트 관리 플랫폼으로, 다음 핵심 기능을 제공합니다:

- **이벤트 CRUD 및 발행**: 회비 설정, 정원 제한이 포함된 이벤트 생성/수정/발행
- **RSVP 관리**: 성인/아동 동반자 수 및 마감일 기반 참석 여부 추적
- **회비 추적**: "납부했어요" 셀프 신고 + 주최자 확인/반려 워크플로우
- **회원 관리**: 관리자 승인 기반 가입 및 이벤트별 주최자 권한 위임
- **이벤트 공유 링크**: 카카오톡에 공유 가능한 이벤트 URL

## 개발 워크플로우

1. **작업 계획**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - 새로운 작업을 포함하도록 `ROADMAP.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - `/tasks` 디렉토리에 새 작업 파일 생성
   - 명명 형식: `XXX-description.md` (예: `001-setup.md`)
   - 고수준 명세서, 관련 파일, 수락 기준, 구현 단계 포함
   - **API/비즈니스 로직 작업 시 "## 테스트 체크리스트" 섹션 필수 포함 (Playwright MCP 테스트 시나리오 작성)**
   - 예시를 위해 `/tasks` 디렉토리의 마지막 완료된 작업 참조. 예를 들어, 현재 작업이 `012`라면 `011`과 `010`을 예시로 참조
   - 이러한 예시들은 완료된 작업이므로 내용이 완료된 작업의 최종 상태를 반영함 (체크된 박스와 변경 사항 요약). 새 작업의 경우, 문서에는 빈 박스와 변경 사항 요약이 없어야 함. 초기 상태의 샘플로 `000-sample.md` 참조

3. **작업 구현**
   - 작업 파일의 명세서를 따름
   - 기능과 기능성 구현
   - **API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행 필수**
   - 각 단계 후 작업 파일 내 단계 진행 상황 업데이트
   - 구현 완료 후 Playwright MCP를 사용한 E2E 테스트 실행
   - 테스트 통과 확인 후 다음 단계로 진행
   - 각 단계 완료 후 중단하고 추가 지시를 기다림

4. **로드맵 업데이트**
   - 로드맵에서 완료된 작업을 ✅로 표시

## 개발 단계

### Phase 1: 애플리케이션 골격 구축 ✅

UI나 기능 구현에 앞서 전체 라우트 구조, 공유 레이아웃, TypeScript 타입, 데이터베이스 스키마 설계를 먼저 완성합니다.

- **Task 001: 라우트 구조 및 레이아웃 설정** ✅ - 완료
  - ✅ `app/` 하위에 모든 페이지 라우트 파일을 플레이스홀더 콘텐츠로 생성
    - ✅ `/` (인증된 사용자는 대시보드로 리다이렉트)
    - ✅ `/auth/login` (이미 존재 — 검토 후 조정)
    - ✅ `/onboarding` (첫 로그인 사용자용 회원가입 위저드)
    - ✅ `/pending` (승인 대기 페이지)
    - ✅ `/dashboard` (홈 — 예정 이벤트 요약)
    - ✅ `/events` (이벤트 목록 페이지)
    - ✅ `/events/new` (이벤트 생성 페이지)
    - ✅ `/events/[id]` (이벤트 상세 페이지)
    - ✅ `/events/[id]/edit` (이벤트 수정 페이지)
    - ✅ `/events/[id]/manage` (참석자 및 회비 관리 페이지)
    - ✅ `/profile` (내 프로필 페이지)
    - ✅ `/admin/members` (회원 관리 페이지 — 관리자 전용)
  - ✅ 모바일 하단 탭 바가 포함된 공유 레이아웃 구현 (홈, 이벤트, 프로필, 회원관리)
  - ✅ 역할 기반 탭 표시 설정 (회원관리 탭은 관리자에게만 표시)
  - ✅ `proxy.ts` 업데이트: 역할 기반 라우트 보호 (pending 사용자는 `/pending`으로 리다이렉트)

- **Task 002: TypeScript 타입 정의 및 검증 스키마** ✅ - 완료
  - ✅ `lib/types/`에 TypeScript 인터페이스 및 enum 정의
    - ✅ `profile.ts`: Profile, ProfileRole (pending/member/admin)
    - ✅ `event.ts`: Event, EventStatus (draft/published/cancelled/completed), EventOrganizer
    - ✅ `rsvp.ts`: Rsvp, RsvpStatus (going/maybe/not_going)
    - ✅ `payment.ts`: Payment, PaymentStatus (pending/confirmed/rejected), PaymentMethod (venmo/zelle/paypal/other)
  - ✅ `lib/validations/`에 Zod 검증 스키마 정의
    - ✅ `onboarding.ts`: Step 1 (필수 정보), Step 2 (KAIST 학력), Step 3 (직장 + 납부 수단)
    - ✅ `event.ts`: 이벤트 생성/수정 폼 검증
    - ✅ `rsvp.ts`: RSVP 제출 검증
    - ✅ `profile.ts`: 프로필 수정 검증
  - 참고: DB 마이그레이션 SQL 설계는 Phase 2 UI/UX 완성 후 Phase 3 (Task 010)에서 진행

### Phase 2: UI/UX 구현 (더미 데이터 활용) ✅

모든 페이지 UI를 하드코딩된 더미 데이터로 구현합니다. 이 단계에서는 API 호출이나 데이터베이스 연동을 하지 않습니다.

> **📌 개발용 쇼케이스 페이지**: Phase 2 진행 중 컴포넌트를 시각적으로 확인하기 위해 `app/dev/page.tsx`가 임시로 존재합니다. 인증 없이 `http://localhost:3000/dev` 에서 접근 가능합니다. **Phase 3 시작 전 반드시 삭제해야 합니다** (아래 Task DEV 참고).

> **📌 임시 공개 라우트**: Phase 2 UI 시각 확인을 위해 `/onboarding`과 `/pending`이 `proxy.ts`에서 임시로 인증 없이 접근 가능하도록 설정되어 있습니다 (`isPhase2PreviewRoute`). **Phase 3 시작 전 반드시 제거해야 합니다** (아래 Task DEV 참고).

- **Task DEV: /dev 쇼케이스 페이지 제거** ✅ - 완료
  - ✅ `app/dev/` 디렉토리 전체 삭제
  - ✅ `lib/supabase/proxy.ts`에서 `isDevRoute` 변수 및 관련 주석 제거 (isPublicRoute에서도 제거)
  - ✅ `lib/supabase/proxy.ts`에서 `isPhase2PreviewRoute` 변수 및 관련 주석 제거 (isPublicRoute에서도 제거)
  - ✅ **`lib/dummy-data/profiles.ts` 117번 줄 복원**: `CURRENT_USER = DUMMY_ADMIN` → `CURRENT_USER = DUMMY_MEMBERS[0]`

- **Task 003: 공통 컴포넌트 라이브러리** ✅ - 완료
  - ✅ shadcn/ui 기반 재사용 가능한 UI 컴포넌트 구현
    - ✅ `EventCard`: 제목, 날짜, 장소, RSVP 상태 배지, 정원 표시
    - ✅ `RsvpStatusBadge`: going/maybe/not_going/미응답 상태 배지
    - ✅ `PaymentStatusBadge`: 미납부/확인 대기/납부 완료/반려 상태 배지
    - ✅ `EventStatusBadge`: draft/published/cancelled/completed 상태 배지
    - ✅ `MobileTabBar`: 역할 기반 탭 렌더링이 포함된 하단 네비게이션
    - ✅ `PageHeader`: 뒤로가기 네비게이션이 포함된 일관된 페이지 헤더
    - ✅ `EmptyState`: 빈 목록용 플레이스홀더
    - ✅ `UserAvatar`: 표시 이름이 포함된 프로필 아바타
  - ✅ `lib/dummy-data/`에 더미 데이터 유틸리티 생성
    - ✅ 샘플 프로필 (관리자, 회원, 대기 중 사용자)
    - ✅ 샘플 이벤트 (예정, 지난, 초안, 취소됨)
    - ✅ 샘플 RSVP 및 납부 데이터

- **Task 004: 인증 플로우 UI (로그인, 온보딩, 승인 대기)** ✅ - 완료
  - ✅ 기존 로그인 페이지를 동문회 앱 브랜딩으로 리팩터링
    - ✅ KAIST 실리콘밸리 동문회 브랜딩 및 환영 메시지
    - ✅ Google OAuth 로그인 버튼 (이미 동작 중)
  - ✅ 온보딩 위저드 UI 구현 (3단계 폼)
    - ✅ Step 1: 실명, 표시 이름, 연락처 (필수 필드)
    - ✅ Step 2: KAIST 학력 정보 (학사/석사/박사 졸업 연도 및 전공, 석·박사 통합과정 토글)
    - ✅ Step 3: 회사명, 직책, 납부 수단 (Venmo/Zelle 핸들)
    - ✅ 진행률 표시, 이전/다음 버튼, 제출 버튼
    - ✅ React Hook Form + Zod 단계별 검증
  - ✅ 승인 대기 페이지 UI 구현
    - ✅ "관리자 승인을 기다리고 있습니다" 안내 메시지
    - ✅ 관리자 연락 방법 안내
    - ✅ 로그아웃 버튼

- **Task 005: 대시보드 및 이벤트 목록 UI** ✅ - 완료
  - ✅ 대시보드 페이지 UI 구현
    - ✅ 예정 이벤트 목록 (3~5개 카드, 날짜순 정렬)
    - ✅ RSVP 상태 배지가 포함된 이벤트 카드
    - ✅ 미납부 이벤트 알림 배너 ("납부 대기 이벤트 N개")
    - ✅ 이벤트 목록으로 이동하는 "전체 보기" 링크
  - ✅ 이벤트 목록 페이지 UI 구현
    - ✅ 예정/지난 이벤트 토글 필터
    - ✅ 제목, 날짜, 장소, 정원, RSVP 상태가 포함된 이벤트 카드
    - ✅ 이벤트 상태 배지 (published/cancelled/completed)
    - ✅ "이벤트 만들기" 플로팅 액션 버튼 (관리자/주최자만 표시)

- **Task 006: 이벤트 상세 페이지 UI** ✅ - 완료
  - ✅ 모든 섹션이 포함된 이벤트 상세 페이지 구현
    - ✅ 이벤트 정보 섹션: 제목, 날짜/시간(PT), 종료 시간, 장소, 설명 (마크다운 렌더링)
    - ✅ RSVP 섹션: going/maybe/not_going 버튼, 성인/아동 동반자 수 입력, 마감일 표시
    - ✅ 회비 섹션: 내역 표시 ("본인: $30 + 성인 동반 1명 $30 + 아동 2명 무료 = $60"), 납부 안내, 결제 방법 안내
    - ✅ "납부했어요" 버튼 + 납부 방법 선택 (Venmo/Zelle/PayPal/기타)
    - ✅ 납부 상태 배지 (미납부/확인 대기/납부 완료/반려)
    - ✅ "이벤트 링크 복사" 공유 버튼
    - ✅ 주최자/관리자 액션: "이벤트 수정" 버튼, "참석자 & 회비 관리" 버튼
  - ✅ 사용자 역할 및 이벤트 상태에 따른 조건부 렌더링 처리
    - ✅ 마감일 이후 RSVP 잠금
    - ✅ RSVP 상태가 going일 때만 "납부했어요" 버튼 활성화
    - ✅ 역할에 따른 관리자/주최자 버튼 표시

- **Task 007: 이벤트 생성/수정 페이지 UI** ✅ - 완료
  - ✅ React Hook Form + Zod 기반 이벤트 폼 UI 구현
    - ✅ 제목, 설명 (마크다운 미리보기가 포함된 텍스트 영역)
    - ✅ 시작 날짜/시간, 종료 날짜/시간 (선택), RSVP 마감일 (선택)
    - ✅ 장소 입력
    - ✅ 회비 설정: 회원 1인 요금, 성인 동반자 요금, 아동 동반자 요금
    - ✅ 납부 안내 텍스트 입력
    - ✅ 최대 정원 입력 (선택, 미입력 시 무제한)
    - ✅ 주최자 관리: 회원 검색 후 추가/제거 (관리자만 가능)
    - ✅ 이벤트 상태 액션: "초안 저장" / "게시하기" / "이벤트 취소" / "완료 처리"
  - ✅ 생성 모드와 수정 모드 구분 (공유 폼 컴포넌트)

- **Task 008: 참석자 및 회비 관리 페이지 UI** ✅ - 완료
  - ✅ 참석자 관리 페이지 구현
    - ✅ 요약 통계 배너: "25/30명 납부 완료 · $750 / $900 수금"
    - ✅ 참석자 테이블/목록: 이름, RSVP 상태, 동반자 수, 납부 금액, 납부 방법, 납부 상태
    - ✅ 납부 상태별 필터 탭: 전체 / 확인 대기 / 납부 완료 / 미납부
    - ✅ 확인 대기 행에 "확인" / "반려" 액션 버튼
    - ✅ 주최자 목록 표시 및 추가/제거 기능 (관리자만 가능)
  - ✅ 모바일 최적화된 참석자 목록 카드 레이아웃

- **Task 009: 회원 관리 및 프로필 페이지 UI** ✅ - 완료
  - ✅ 회원 관리 페이지 구현 (관리자 전용)
    - ✅ 탭 네비게이션: 승인 대기 / 전체 회원
    - ✅ 승인 대기 탭: 신청자 정보 (이름, 연락처, KAIST 학력, 직장) + "승인" / "반려" 버튼
    - ✅ 전체 회원 탭: 이름, 역할 배지 (member/admin), 가입일 + "관리자 승격" 버튼
  - ✅ 프로필 페이지 UI 구현
    - ✅ 개인 정보 섹션: 실명, 표시 이름, 연락처
    - ✅ KAIST 학력 섹션: 학사/석사/박사 졸업 연도 및 전공, 석·박사 통합과정 토글 (토글 시 석사 필드 숨김)
    - ✅ 직장 정보 섹션: 회사명, 직책
    - ✅ 납부 수단 섹션: Venmo/Zelle 핸들
    - ✅ 수정 모드 토글 및 "저장" 버튼
    - ✅ React Hook Form + Zod 검증

### Phase 3: 핵심 기능 구현 ✅

데이터베이스 마이그레이션 적용, API 레이어 구축, 비즈니스 로직 구현, 더미 데이터를 실제 Supabase 쿼리로 교체합니다.

- **Task 010: 데이터베이스 마이그레이션 및 Supabase 설정** ✅ - 완료
  - ✅ Supabase 데이터베이스 마이그레이션 적용
    - ✅ Enum 타입 생성 (user_role, event_status, rsvp_status, payment_status, payment_method)
    - ✅ profiles 테이블 생성 + auth.users 삽입 시 자동 생성 트리거
    - ✅ events 테이블 생성 (적절한 기본값 및 제약 조건 포함)
    - ✅ event_organizers 테이블 생성 (복합 기본 키)
    - ✅ rsvps 테이블 생성 (event_id + user_id 고유 제약 조건)
    - ✅ payments 테이블 생성
    - ✅ 쿼리 성능을 위한 필요 인덱스 생성
  - ✅ 모든 테이블에 대한 Row Level Security (RLS) 정책 구현
    - ✅ profiles: 본인 읽기, member/admin 전체 읽기, 본인 삽입, 본인 수정, 관리자 역할 변경
    - ✅ events: 게시됨 전체 읽기, 초안은 생성자/주최자/관리자만, 생성자/주최자/관리자 수정
    - ✅ event_organizers: 관리자만 삽입/삭제, 주최자/생성자/관리자 읽기
    - ✅ rsvps: 본인 CRUD (마감일 제한), 주최자/관리자 이벤트별 전체 읽기
    - ✅ payments: 본인 삽입 (going RSVP 필요), 주최자/관리자 상태 변경, 주최자/관리자 이벤트별 전체 읽기
  - ✅ Supabase 스키마에서 TypeScript 타입 자동 생성
  - ✅ Playwright MCP 테스트: 테이블 생성 및 RLS 정책 검증 (CLI 기반 대체)

- **Task 011: 인증 플로우 및 역할 기반 라우팅** ✅ - 완료
  - ✅ Google OAuth 이후 첫 로그인 감지 구현
    - ✅ OAuth 콜백 후 profiles 테이블에 프로필 존재 여부 확인
    - ✅ 프로필 미존재 시 `/onboarding`으로 리다이렉트
    - ✅ 역할이 pending이면 `/pending`으로 리다이렉트
    - ✅ 역할이 member 또는 admin이면 `/dashboard`로 리다이렉트
  - ✅ 온보딩 위저드를 Supabase에 연결
    - ✅ 폼 제출 시 role=pending으로 새 프로필 삽입
    - ✅ 성공 시 승인 대기 페이지로 이동
  - ✅ proxy.ts를 포괄적인 역할 기반 라우트 보호로 업데이트
    - ✅ pending 사용자: `/pending`과 `/auth/*`만 허용, 나머지는 `/pending`으로 리다이렉트
    - ✅ 미인증 사용자: `/auth/*`만 허용, `/auth/login`으로 리다이렉트
    - ✅ 인증된 member/admin: `/onboarding`과 `/pending` 차단, `/dashboard`로 리다이렉트
  - ✅ Playwright MCP 테스트: 로그인 플로우, 첫 로그인 감지, 역할 기반 리다이렉트 검증

- **Task 012: 이벤트 CRUD API 및 데이터 연동** ✅ - 완료
  - ✅ 이벤트 작업을 위한 Server Actions 구현
    - ✅ `createEvent`: 초안 이벤트 생성, 생성자를 주최자로 추가
    - ✅ `updateEvent`: 이벤트 상세 수정 (생성자/주최자/관리자만)
    - ✅ `publishEvent`: 상태 변경 draft → published
    - ✅ `cancelEvent`: 상태를 cancelled로 변경
    - ✅ `completeEvent`: 상태를 completed로 변경
  - ✅ Supabase 쿼리를 통한 이벤트 데이터 조회 구현
    - ✅ `getUpcomingEvents`: start_at > 현재 시간인 게시된 이벤트, 날짜순 정렬
    - ✅ `getPastEvents`: 완료/취소된 이벤트 또는 start_at < 현재 시간
    - ✅ `getEventById`: 주최자 정보가 포함된 단일 이벤트
    - ✅ `getMyRsvpForEvent`: 특정 이벤트에 대한 현재 사용자의 RSVP
  - ✅ 대시보드, 이벤트 목록, 이벤트 상세 페이지의 더미 데이터를 실제 데이터로 교체
  - ✅ 이벤트 생성/수정 폼을 Server Actions에 연결
  - ✅ Playwright MCP 테스트: 이벤트 CRUD 작업, 상태 전이, 권한 검사

- **Task 013: RSVP 시스템 구현** ✅ - 완료
  - ✅ RSVP 작업을 위한 Server Actions 구현
    - ✅ `submitRsvp`: RSVP 생성 또는 업데이트 (going/maybe/not_going + 동반자 수)
    - ✅ `getRsvpsByEvent`: 이벤트의 전체 RSVP (주최자/관리자)
    - ✅ `getMyRsvp`: 이벤트에 대한 현재 사용자의 RSVP
  - ✅ RSVP 비즈니스 로직 구현
    - ✅ 마감일 제한: rsvp_deadline 또는 event start_at 이후 변경 차단
    - ✅ 정원 체크: 총 인원(본인 + 동반자) 대비 max_capacity 검증
    - ✅ RSVP 동반자 수 기반 회비 금액 자동 계산
  - ✅ 이벤트 상세 페이지의 더미 RSVP 데이터를 실제 쿼리로 교체
  - ✅ 대시보드의 이벤트 카드에 실제 RSVP 상태 배지 표시
  - ✅ Playwright MCP 테스트: RSVP 제출, 마감일 제한, 정원 제한, 동반자 수 변경

- **Task 014: 회비 납부 시스템 구현** ✅ - 완료
  - ✅ 납부 작업을 위한 Server Actions 구현
    - ✅ `reportPayment`: 납부 기록 생성 (status=pending, RSVP status=going 필요)
    - ✅ `confirmPayment`: 주최자/관리자 납부 확인
    - ✅ `rejectPayment`: 주최자/관리자 납부 반려
    - ✅ `getPaymentsByEvent`: 이벤트의 전체 납부 기록 (주최자/관리자)
    - ✅ `getMyPayment`: 이벤트에 대한 현재 사용자의 활성 납부 기록
  - ✅ 납부 비즈니스 로직 구현
    - ✅ 금액 자동 계산: fee_amount + (성인 동반자 수 × adult_guest_fee) + (아동 동반자 수 × child_guest_fee)
    - ✅ 단일 활성 납부 규칙 적용: (event_id, user_id) 당 pending/confirmed 상태의 납부는 1건만 허용
    - ✅ 반려 후 재신고 허용
  - ✅ 이벤트 상세 및 참석자 관리 페이지의 더미 납부 데이터를 실제 데이터로 교체
  - ✅ 참석자 관리 페이지의 확인/반려 버튼 연결
  - ✅ Playwright MCP 테스트: 납부 신고, 확인/반려 플로우, 반려 후 재신고, 권한 검사

- **Task 015: 회원 관리 및 프로필 API** ✅ - 완료
  - ✅ 회원 관리를 위한 Server Actions 구현 (관리자 전용)
    - ✅ `approveMember`: 역할 변경 pending → member
    - ✅ `rejectMember`: 프로필 삭제 (또는 rejected로 표시)
    - ✅ `promoteToAdmin`: 역할 변경 member → admin
    - ✅ `getAllMembers`: 필터링이 포함된 전체 회원 목록
    - ✅ `getPendingMembers`: 승인 대기 회원 목록
  - ✅ 주최자 관리를 위한 Server Actions 구현
    - ✅ `addOrganizer`: 회원을 이벤트 주최자로 추가 (관리자만 가능)
    - ✅ `removeOrganizer`: 이벤트 주최자 제거 (관리자만 가능)
    - ✅ `getEventOrganizers`: 이벤트의 주최자 목록
  - ✅ 프로필 업데이트 Server Action 구현
    - ✅ `updateProfile`: 본인 프로필 정보 수정
  - ✅ 회원 관리, 프로필, 주최자 관리 UI의 더미 데이터를 실제 데이터로 교체
  - ✅ Playwright MCP 테스트: 회원 승인/반려 플로우, 관리자 승격, 주최자 위임, 프로필 수정

- **Task 016: E2E 통합 테스트**
  - Playwright MCP 전체 사용자 플로우 테스트
    - 신규 사용자 가입 플로우: Google OAuth → 온보딩 위저드 → 승인 대기 → 관리자 승인 → 대시보드 접근
    - 이벤트 수명 주기: 초안 생성 → 게시 → 링크 공유 → RSVP → 납부 → 확인 → 완료
    - 회비 추적 플로우: 회원 납부 신고 → 주최자 확인/반려 → 재신고
    - 회원 관리: 관리자가 대기 중인 회원 승인, 관리자로 승격
    - 역할 기반 접근: pending/member/admin/주최자 역할에 대한 라우트 보호 검증
  - 에러 처리 및 엣지 케이스 테스트
    - 마감 후 RSVP 시도
    - going RSVP 없이 납부 시도
    - 정원 초과
    - 비인가 접근 시도
    - 동시 관리자 작업

### Phase 4: 마무리 및 배포

고급 UX 개선, 성능 최적화, 프로덕션 배포를 진행합니다.

- **Task 017: 이벤트 공유 및 모바일 UX 최적화**
  - Clipboard API를 활용한 이벤트 URL 복사 기능 구현
  - 이벤트 페이지에 Open Graph 메타 태그 추가 (카카오톡 링크 미리보기)
  - 모바일 터치 인터랙션 및 제스처 최적화
  - 이벤트 목록 및 대시보드에 Pull-to-refresh 추가
  - 로딩 스켈레톤 및 Optimistic UI 업데이트 구현
  - 사용자 액션에 대한 토스트 알림 추가 (RSVP 저장, 납부 신고 등)

- **Task 018: 성능 최적화 및 캐싱**
  - React Server Component 데이터 페칭 패턴 구현
  - Supabase 쿼리 최적화 (선택적 컬럼, 페이지네이션)
  - Next.js 캐싱 전략 구성 (재검증, 적절한 곳에 정적 생성)
  - 번들 사이즈 최적화 (동적 임포트, 코드 스플리팅)
  - Error boundary 및 폴백 UI 추가
  - 모든 비동기 작업에 대한 적절한 로딩 상태 구현

- **Task 019: 프로덕션 배포 및 모니터링**
  - Vercel 배포 설정 구성
  - 프로덕션 Supabase 인스턴스용 환경 변수 설정
  - 적절한 RLS 정책이 적용된 Supabase 프로덕션 프로젝트 구성
  - 에러 모니터링 및 로깅 시스템 구축
  - 성능 테스트 및 Lighthouse 감사
  - 초기 관리자 사용자 설정을 위한 시드 데이터 스크립트 생성
  - 배포 문서 작성
