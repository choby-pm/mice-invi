# VIP 초청자 관리 솔루션 (가칭)

MICE 행사에 초청되는 해외 VIP와 동반자·수행원을 관리하는 SaaS입니다. PCO(행사 운영사)가 여러 행사에 반복 사용하며, 주최측·진행 업체·초청자 측 대리인이 각자의 접점으로 참여합니다.

> **핵심 가치**: 잦은 변경이 2차·3차·4차로 번지는 연쇄를 시스템이 추적하고, "업체에 알렸다"가 아니라 "업체가 반영했다"까지 확인한다.

## 문서 지도

> **Claude Code로 이 폴더를 열었다면** `CLAUDE.md` → `docs/08_claude_code_handoff.md` 순서로 읽으세요.

| 순서 | 문서 | 내용 | 상태 |
|---|---|---|---|
| 00 | [문제 정의](docs/00_problem_definition.md) | 사용자, 병목, 대상, 수동/자동 경계, KPI | ✅ v1.0 |
| 01 | [업무·데이터 분석서](docs/01_business_data_analysis.md) | 업무 흐름, 데이터 엔티티, 상태 S01~S14, 영향 규칙 IR-01~16 | ✅ v0.4 |
| 02 | [UX/IA 설계서](docs/02_ux_ia_design.md) | 접점별 정보 구조, 화면 목표, 상태별 화면, 반응형·다국어 | ✅ v0.3 |
| 03 | [시스템 구조·기능 명세서](docs/03_system_spec.md) | 구조, API, 배치, 인터페이스, 안정성 대비 | ✅ v0.2 |
| 04 | [MVP 범위·로드맵](docs/04_mvp_roadmap.md) | MVP 범위, 트랙 A·B, 릴리스 R0~R6 | ✅ v1.0 |
| 05 | [프레임 목업](design/mockups/frame_mockup_v0.6.html) | MVP 전체 55개 화면 + 대화상자 40개 | ✅ v0.6 |
| 06 | [UI 의사결정](docs/06_ui_decisions.md) · [테마 랩](design/mockups/ui_theme_lab_v0.2.html) | UI 규칙 13가지 | ✅ v1.0 |
| 07 | [테마](docs/07_theme.md) · [토큰](design/tokens/globals.css) | T1 프로토콜 네이비 | ✅ v1.0 |
| 08 | [Claude Code 인수인계서](docs/08_claude_code_handoff.md) | 읽을 순서, 확정·열린 결정, 작업 방식, R0 순서 | ✅ v1.0 |
| - | [결정 로그](docs/decisions/DECISION_LOG.md) | 전 단계 결정 통합 | 계속 갱신 |
| - | [검수 로그](docs/reviews/REVIEW_LOG.md) | 검수·피드백·반영 기록 | 계속 갱신 |

## 번호 체계 (문서 간 공통)

| 접두어 | 의미 | 정의 위치 |
|---|---|---|
| `P01~` | 업무 프로세스 | 01 |
| `BR-` | 업무 규칙 | 01 |
| `S01~` | 상태 정의 | 01 3부 |
| `IR-` | 영향 규칙 | 01 P11 |
| `PCO-E01`, `PX-03` 등 | 화면 ID | 02 |
| `API-`, `B01~`, `W01~`, `IF-` | API, 배치, 비동기 작업, 인터페이스 | 03 |
| `R0~R6` | 개발 릴리스 | 04 |
| `D-{단계}-{번호}` | 결정 | 결정 로그 |

## 작업 방식

모든 산출물은 **검수 요청 → 피드백 → 수정**을 반복하며 확정합니다. 자세한 규칙은 [검수 로그](docs/reviews/REVIEW_LOG.md)를 참고하세요.

## 현재 단계

**설계·디자인 완료 → 트랙 B 개발 시작 (Claude Code, R0 개발 준비)**
