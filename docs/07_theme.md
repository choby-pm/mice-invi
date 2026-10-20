# 07. 테마 v1.0 — T1 프로토콜 네이비 (확정)

> D-UI-12. 코드용 토큰: `design/tokens/globals.css` (shadcn + Tailwind v4 형식), `design/tokens/tokens.json` (참조용)
> 시각 확인: `design/mockups/ui_theme_lab_v0.2.html` (T1 선택 상태)

## 1. 인상과 원칙

정부·외교 행사의 VIP를 다루는 도구로서 **신뢰감과 차분함**을 우선했습니다. 색은 짙은 남색 하나를 주색으로 쓰고, 나머지 색은 **상태를 알리는 데만** 씁니다. 화면에서 가장 눈에 띄는 것은 항상 "긴급" 상태여야 합니다.

| 원칙 | 내용 |
|---|---|
| 색은 토큰으로만 | 컴포넌트에 `#1c3558` 같은 값을 직접 쓰지 않고 `bg-primary`, `text-status-urgent-fg`처럼 토큰 이름으로만 |
| 주색은 행동에만 | 남색(primary)은 주요 버튼·선택된 메뉴·진행 막대에만. 장식에 쓰지 않음 |
| 상태 색은 상태에만 | 빨강·주황·파랑·초록·회색은 상태 배지·긴급 선·검증 메시지에만 |
| 색 + 글자 | 상태는 항상 색과 글자를 함께 (UX 원칙 U4) |

## 2. 색 토큰 (라이트)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `primary` | `hsl(215 55% 24%)` | 주요 버튼, 선택 상태, 진행 막대 |
| `foreground` | `hsl(222 47% 11%)` | 본문 글자 |
| `muted-foreground` | `hsl(215 16% 42%)` | 보조 글자 |
| `border` / `input` | `hsl(214 25% 88%)` / `hsl(214 25% 85%)` | 구분선, 입력칸 테두리 |
| `secondary` / `muted` / `accent` | 옅은 남회색 계열 | 보조 버튼, 배경, 호버 |
| `destructive` | `hsl(0 72% 50%)` | 삭제·철회·강제 종결 버튼 |
| `vip` | `hsl(38 70% 42%)` | VIP 표시 (금색) |

다크 값은 `globals.css`의 `.dark`에 정의. MVP에서는 켜지 않습니다 (UD-12).

## 3. 상태 색 (UD-05)

| 상태 | 토큰 접두어 | 옅은 배지 (bg / fg) | 진한 표시 (선·점) |
|---|---|---|---|
| 긴급 | `status-urgent` | 연한 빨강 / 짙은 빨강 | 빨강 — 긴급 행 왼쪽 선 (UD-06) |
| 조치 필요 | `status-action` | 연한 주황 / 짙은 주황 | 주황 |
| 처리중 | `status-progress` | 연한 파랑 / 짙은 파랑 | 파랑 |
| 완료 | `status-done` | 연한 초록 / 짙은 초록 | 초록 |
| 대기 | `status-wait` | 연한 회색 / 회색 | 회색 |
| 무효 | `status-wait` + 취소선 | 연한 회색 / 회색 + `line-through` | - |

### StatusBadge 컴포넌트 규격 (구현 지침)

```tsx
// components/status-badge.tsx — shadcn Badge 기반
type Status = "urgent" | "action" | "progress" | "done" | "wait" | "void";
// urgent   : bg-status-urgent-bg   text-status-urgent-fg
// urgent + strong(카운트 등): bg-status-urgent text-white
// action   : bg-status-action-bg   text-status-action-fg
// progress : bg-status-progress-bg text-status-progress-fg
// done     : bg-status-done-bg     text-status-done-fg
// wait     : bg-status-wait-bg     text-status-wait-fg
// void     : wait 스타일 + line-through
```

분석서의 상태(S01~S14) → 6종 매핑표는 StatusBadge 옆에 상수로 둡니다 (예: `S04.CONFIRMED → done`, `S06.ACTION_REQUIRED → action`, 기한 초과 → `urgent`).

## 4. 글꼴과 크기 (UD-10)

| 항목 | 값 |
|---|---|
| 글꼴 | **Pretendard Variable 1.3.9**, `next/font/local` 자체 제공. OFL 라이선스 동봉 |
| 운영 도구 본문 | 15px, 기본 행간 1.6 (PCO 콘솔, 업체 포털) |
| 대리인 포털 본문·입력칸 | **16px** (아이폰 자동 확대 방지) |
| 크기 단계 | 12 · 13 · 14 · 15 · 16 · 18 · 20 · 24 · 30 |
| 굵기 | 400 본문 · 500 라벨·메뉴 · 600 제목·배지 · 700 큰 숫자 |

## 5. 모양

| 항목 | 값 |
|---|---|
| 모서리 기본 (`--radius`) | 6px. 카드 8px, 작은 요소 4px |
| 그림자 | shadcn 기본 `shadow-sm` (카드) · `shadow-lg` (대화상자·Sheet) |
| 아이콘 | lucide (shadcn 기본), 글자와 함께. 아이콘만 있는 버튼은 툴팁 필수 (UD-14) |
