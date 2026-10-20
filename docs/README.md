# 문서 지도

**[현재 상태](current-status.md) → [보안 안내](../SECURITY.md) → 관련 기획서 → 최신 검증 기록** 순서로 읽으세요. 기획서의 ‘확정’은 설계 합의를 뜻하며 개발 완료를 뜻하지 않습니다. 이후 변경은 결정 로그와 검증 기록으로 확인합니다.

## 기획 산출물

| 문서 | 용도 |
|---|---|
| [00 문제 정의](00_problem_definition.md) | 사용자·병목·범위·성과 지표 |
| [01 업무·데이터 분석](01_business_data_analysis.md) | 업무 흐름, 엔티티, 상태, 영향 규칙 |
| [02 UX·정보 구조](02_ux_ia_design.md) | 역할별 화면·이동·권한·반응형·언어 |
| [03 시스템 명세](03_system_spec.md) | 구조·행동 API·연계·안정성의 설계 목표 |
| [04 MVP 로드맵](04_mvp_roadmap.md) | 최초 범위·릴리스 계획. 진척은 현재 상태 참고 |
| [06 UI 결정](06_ui_decisions.md) | 공통 원칙과 최초 테마 비교 |
| [07 테마](07_theme.md) | 현재 글꼴·크기·상태 색·토큰 |
| [08 최초 개발 인수인계](08_claude_code_handoff.md) | 초기 설계 배경. R0 시작·열린 결정은 당시 기록 |
| [디자인 자료](../design/README.md) | 목업·토큰·과거 자료 구분 |

## 운영·개발·검증

| 문서 | 용도 |
|---|---|
| [현재 상태·후속 과제](current-status.md) | 구현 범위·한계·우선순위·다음 작업 |
| [데모 데이터](demo-data.md) | 계정·시나리오·신규 환경 생성 |
| [보안 안내](../SECURITY.md) | 키 구분·Git 관리·사고 대응·데모 제한 |
| [비밀정보 점검](reviews/security-hygiene-2026-10-20.md) | 점검 범위·결과·운영 보완 사항 |
| [결정 로그](decisions/DECISION_LOG.md) | 확정된 선택과 변경 |
| [검증 로그](reviews/REVIEW_LOG.md) | 기능별 수정·검증 근거 |

최근 기록: [역할별 검증](reviews/demo-role-check-2026-10-19.md), [미완성 화면](reviews/unfinished-pages-2026-10-20.md), [고객·업체 연동](reviews/customer-vendor-sync-2026-10-20.md), [운영 흐름·권한](reviews/operational-flow-2026-10-20.md), [항공 여권](reviews/flight-passport-2026-10-20.md), [대시보드](reviews/dashboard-readability-2026-10-20.md).

## 유지 규칙

- 기능 완료 시 현재 상태와 검증 기록을 갱신합니다. 과거 테스트 수는 당시 증거로 남깁니다.
- 기획 목표를 구현 완료로 표시하지 않습니다. 남은 일은 현재 상태에 모읍니다.
- 실제 키·비밀번호·인증 토큰·고객 여권·DB 덤프·비공개 로그를 붙이지 않습니다.
- 기존 번호 체계: `P` 업무, `BR` 규칙, `S` 상태, `IR` 영향 규칙, `API/B/W/IF` 시스템, `R` 릴리스, `D` 결정.
