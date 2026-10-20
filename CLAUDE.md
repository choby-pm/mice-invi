# CLAUDE.md — 이 저장소에서 작업하는 AI(Claude Code)를 위한 안내

## 프로젝트 요약

MICE 행사 해외 VIP 초청자 관리 SaaS. PCO(테넌트) → 행사 → 대표단 → 참가자 구조. 핵심은 **변경 이슈의 N차 연쇄 관리**와 **요청 데이터/확정 데이터 분리**다. 문서가 먼저 확정되었고, 구현은 문서를 따른다.

## 현재 상태

[현재 구현 상태](docs/current-status.md)와 [문서 지도](docs/README.md)를 먼저 확인하세요. 최초 R0 인수인계는 설계 당시 기록이며 현재 진척이 아닙니다. 최근 사용자가 정한 작업 범위·진행 방식은 과거 검수 절차보다 우선합니다.

## 반드시 먼저 읽을 것

0. `docs/08_claude_code_handoff.md` — 인수인계서 (읽을 순서, 열린 결정, 목업→코드 규칙, R0 순서)
1. `README.md` — 문서 지도와 번호 체계
2. `docs/decisions/DECISION_LOG.md` — 확정된 결정. **여기 있는 결정과 충돌하는 구현을 하지 말 것.** 충돌이 필요해 보이면 구현 전에 의뢰인에게 질문
3. 작업 대상에 해당하는 문서 절 (01 업무·데이터, 02 UX/IA, 03 시스템)

## 의뢰인과의 작업 방식 (중요)

- 의뢰인은 **비개발자**다. 설명은 쉬운 한국어로, 기술 용어는 처음 쓸 때 풀어서 설명한다.
- 모든 산출물은 **검수 요청 → 피드백 → 수정** 반복으로 확정한다. 한 번에 끝까지 만들지 말고, 검수 가능한 단위로 나눠 제출한다.
- 검수 요청 시 항상 **검수 체크리스트**(번호 + 제 기본안)를 함께 제시한다.
- 스스로 확신하기 어려운 결정은 추측하지 말고 기본안을 제시한 뒤 질문한다.
- 피드백을 반영하면 문서 버전을 올리고, `docs/reviews/REVIEW_LOG.md`에 기록하며, 결정은 `DECISION_LOG.md`에 추가한다.
- 릴리스마다 순서: **구축 → 검수 및 안정화 → 배포(CI/CD) → 추가 구축**. 구축 단계는 의뢰인이 매 파일 단위로 확인하지 않아도 되며, 한 덩어리(예: R0 화면 뼈대)가 로컬에서 눌러볼 수 있는 상태가 되면 그때 검수 요청한다.
- 실제 로그인(D-SY-10, Supabase Auth)이 붙기 전까지는 `mock_role` 쿠키 기반 임시 로그인(`/login`)으로 화면을 확인한다 — 보안 기능이 아니라 화면 접근 흉내이므로, 운영 환경에는 배포하지 않는다.

## 변하지 않는 원칙 (요약)

| 영역 | 원칙 | 출처 |
|---|---|---|
| UX | 할 일이 먼저 보인다, 변경은 항상 "이전 → 이후", 상태는 색 + 글자, 민감정보는 열어보는 행동으로 | 02 §1.1 |
| 반응형 | 전 접점 반응형 필수. 대리인 포털과 현장 앱은 모바일 우선 | D-UX-02, 02 §1.12 |
| 다국어 | 초청자 측(대리인 포털·행사 페이지·메일·일정표) MVP 한·영·일. 나머지는 문구 분리로 확장 대비. RTL 대비 | D-UX-07·09, 02 §1.13 |
| 날짜 | 모든 언어에서 월을 글자로 (`14 Oct 2026`, `2026년 10월 14일`, `2026年10月14日`). 시각에는 시간대 표기 | 02 §1.13 |
| 상태 변경 | 상태 값 직접 수정 금지, 행동 API로만. 서버가 전이 규칙 검사 | 03 §2.1 |
| 권한 | 역할 → 범위 → 상태 → 필드 4단계. 권한 밖 데이터는 404 (존재 비노출) | 03 §1.6, §2.1 |
| 민감정보 | 별도 저장, 행사별 키 암호화, 열람마다 기록, 메일에 절대 포함 금지 | 03 §1.7 |
| 멱등성 | 생성·행동 API는 중복 방지 키, 배치·큐 작업은 두 번 돌아도 안전 | 03 §5.5 |

## 프론트엔드 기술 (확정)

- **Tailwind CSS + shadcn/ui** (D-UI-01). 부품은 shadcn 컴포넌트를 우선 사용하고, 스타일은 테마 토큰(CSS 변수)으로만 지정한다. 하드코딩 색상 금지.
- 테마: **T1 프로토콜 네이비** (D-UI-12). 토큰은 `design/tokens/globals.css`를 그대로 사용. 상태는 `StatusBadge` 6종(urgent·action·progress·done·wait·void)과 `status-*` 토큰으로만 표현 (docs/07 §3).
- UI 규칙 13가지: `docs/06_ui_decisions.md` (D-UI-11).
- 참조 목업: `design/mockups/frame_mockup_v0.6.html` (최신 버전 우선)

## 폴더 구조

```
docs/            확정 문서 (00~04), decisions/, reviews/
design/mockups/  프레임 목업 HTML
design/tokens/   디자인 토큰 (globals.css = shadcn + Tailwind v4 형식, src/app/globals.css로 복사해 사용)
src/app/         Next.js 화면. 경로 폴더로 계정 유형 구분: console(PCO), vendor(업체), portal(대리인), admin(운영사), login
src/server/      모듈형 서버 로직 (03 §1.4 모듈 ↔ server/modules/* 대응, R0-3 검수 기록 참고)
src/components/  ui(shadcn 부품), shared(StatusBadge 등 프로젝트 공통 부품)
src/proxy.ts     역할별 화면 접근 통제 (R0은 mock_role 쿠키 임시 인증, R1에서 Supabase Auth로 교체)
```

D-SY-09(OD-2)에 따라 3개 앱 대신 **단일 Next.js 앱**으로 구현한다. `host`(주최측 포털)는 MVP 제외 항목(D-RM-04, D-UX-01)이라 R0에서 만들지 않는다 — 필요해지면 의뢰인 결정 후 추가.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
