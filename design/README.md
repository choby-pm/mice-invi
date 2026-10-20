# design/

현재 서비스는 [가독성 개선](../docs/reviews/dashboard-readability-2026-10-20.md)을 반영했습니다. 글꼴은 Pretendard Variable이며 실제 적용 코드는 `src/app/layout.tsx`·`src/app/globals.css`입니다. HTML 목업은 기획 당시 화면 구조를 참고하는 자료로, 현재 배포와 글꼴·배치가 다를 수 있습니다. 과거 목업을 최신 구현 상태로 간주하지 마세요.

| 파일 | 내용 |
|---|---|
| `mockups/frame_mockup_v0.6.html` | **최신 프레임 목업** — MVP 55개 화면 (구현 기준) |
| `mockups/ui_theme_lab_v0.2.html` | UI 의사결정·테마 비교 랩 (T1 확정) |
| `mockups/archive/` | 이전 버전 목업 (참고용, 구현 기준 아님) |
| `tokens/globals.css` | T1 테마 토큰 — Next.js `app/globals.css`로 사용 |
| `tokens/tokens.json` | 같은 토큰의 참조용 JSON |
