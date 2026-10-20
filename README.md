# MICE INVI · VIP 초청자 관리

PCO(행사 운영사)의 전달·독촉 업무를 줄이고, 업체가 고객 요청을 바로 처리하며, VIP 측이 최신 예약을 확인하는 MICE 초청자 관리 서비스입니다. 행사 → 대표단 → 참가자 구조로 관리하며, **요청과 확정 결과를 분리하고 변경 후 실제 반영 여부를 추적**합니다.

**[서비스·역할별 데모](https://miceinvi.vercel.app/login)** · [현재 구현 상태](docs/current-status.md) · [기획 산출물 지도](docs/README.md) · [보안 안내](SECURITY.md)

## 주요 기능

| 사용자 | 제공 기능 |
|---|---|
| PCO 관리자·담당자 | 행사·대표단·참가자·업체 관리, 운영 현황, 서비스 배정, 변경 이슈·조정, 동의·열람 기록 |
| 현장 직원 | 허용된 행사 명단·서비스 조회 |
| 업체 | 배정 서비스의 고객 요청·상세 조회, 예약·확정·취소, 변경 확인, 처리 내역 |
| VIP 측 대리인 | 자기 대표단 참석 회신·참가자 정보·동의·서비스 요청·예약 확인·일정 회신 |
| 플랫폼 운영자 | 데모 조직 현황·DB 연결 확인용 임시 화면 |

항공·숙박·수송·공항 의전·식음 업무를 지원합니다. 항공 업체는 배정된 대표단의 동의가 유효한 여권 정보를 명시적으로 열람할 수 있으며 기록이 남습니다. 프리텐다드와 공통 상태 표시를 사용합니다.

현재는 **공유 데모**입니다. 행사 3개·대표단 6개·참가자 18명·서비스 31건을 기준으로 구성했으며 체험자의 변경은 공유됩니다. 데모 대리인은 베트남 대표단 하나, 데모 업체는 항공 업체 하나에만 연결됩니다. **실제 고객 개인정보나 여권을 데모에 입력하지 마세요.**

## 로컬 실행

Node.js 24 환경에서 검증했습니다. npm을 사용합니다.

```sh
npm ci
cp .env.local.example .env.local
# .env.local에 해당 환경의 값을 입력
npm run dev
```

Windows PowerShell에서는 복사에 `Copy-Item .env.local.example .env.local`, npm 실행 제한 시 `npm.cmd`를 사용하세요. 기존 `.env.local`을 덮어쓰지 마세요.

| 환경변수 | 용도 | 노출 범위 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 주소 | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 클라이언트 키 | 공개 가능, DB 권한 정책 필요 |
| `SUPABASE_SECRET_KEY` | 서버 관리 작업·테스트 준비 | **서버 전용 비밀키** |
| `NEXT_PUBLIC_SITE_URL` | 초청 링크 기준 주소 | 공개 가능 |
| `DEMO_MODE` | `true`: 공유 데모, `false`: 일반 로그인 | 미설정 시 데모 활성 |

DB 스키마는 `supabase/migrations/0001`~`0039` 기준입니다. 새 DB에 번호순으로 적용하고, 기존 DB는 적용 이력을 확인해 누락분만 적용하세요. 앱 시작·Vercel 배포가 DB 마이그레이션을 자동 실행하지는 않습니다.

## 검증·데모 데이터

```sh
npm run lint
npm test
npm run test:demo
npm run build
node scripts/check-demo-state.mjs
```

`npm test`의 DB 연동 테스트는 관리자 키로 독립 테스트 조직·계정을 생성·정리하므로 **분리된 검증 DB 사용을 권장**합니다. `test:demo`는 DB 없이 fixture 구성을 검사하고, `check-demo-state`는 데모 현황을 읽습니다. 최신 기능 검증 기록: 자동 테스트 168개·배포 빌드 통과(2026-10-20).

기존 데모 확인에는 재생성이 필요하지 않습니다. 신규 환경에만 [데모 데이터 안내](docs/demo-data.md)에 따라 `seed:demo` 미리보기 후 `--apply`를 사용하세요.

## 구조·배포

```text
src/app/             PCO·업체·대리인·운영사 화면
src/components/      공통 UI와 역할별 업무 화면
src/server/          인증·업무 행동·서버 처리
supabase/migrations/ DB 구조·권한·업무 함수
tests/               권한·변경 전파·민감정보 검증
scripts/             데모·개발·운영 확인 도구
docs/                기획·현재 상태·결정·검증 기록
design/              토큰과 기획 당시 HTML 목업
```

`main` 푸시 시 Vercel이 자동 배포합니다. 환경변수는 배포 환경의 비밀 설정으로 관리하며 저장소에 넣지 않습니다. 실제 운영 전 남은 항목은 [현재 상태·후속 과제](docs/current-status.md)를 확인하세요.
