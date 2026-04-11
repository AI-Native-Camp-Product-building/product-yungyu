# Harness Ideal — 좋은 하네스의 기준

> 이 문서는 `diagnose_harness`의 채점 기준입니다.
> 매주 수요일 자동으로 업데이트됩니다 (HN + 유저 피드백 기반).

---

## Layer 1 — 컨텍스트 (Context)

**핵심 질문:** AI에게 프로젝트를 얼마나 잘 설명하고 있는가

### 필수 요소

| 요소 | 기준 |
|------|------|
| `CLAUDE.md` | 프로젝트 목적, 기술 스택, 코딩 규칙, 금지 패턴 포함 |
| `skills/` | 반복 작업별 전문 스킬 파일 (커밋, 리뷰, 배포 등) |
| 아키텍처 설명 | 컴포넌트 구조와 데이터 흐름 기술 |

### 점수 기준

- **80–100**: CLAUDE.md에 목적·스택·규칙·금지패턴 모두 있고, 3개 이상의 도메인별 skill 파일 존재
- **60–79**: CLAUDE.md는 있으나 skill 파일이 부족하거나 내용이 얕음
- **40–59**: CLAUDE.md만 존재, skill 없음
- **0–39**: CLAUDE.md 없거나 내용이 거의 없음

---

## Layer 2 — 자동강제 (Enforcement)

**핵심 질문:** 품질 기준이 얼마나 자동으로 강제되는가

### 필수 요소

| 요소 | 기준 |
|------|------|
| `.claude/settings.json` hooks | AI 행동 전후 자동 검사 (PreToolUse, PostToolUse) |
| pre-commit hook | 커밋 전 lint·타입 검사 자동 실행 |
| CI workflow | PR마다 테스트·커버리지 자동 강제 |

### 점수 기준

- **80–100**: hooks + pre-commit + CI 세 가지 모두 구성
- **60–79**: CI는 있으나 hooks 또는 pre-commit 미흡
- **40–59**: CI만 있음
- **0–39**: 자동화 없음

---

## Layer 3 — 가비지컬렉션 (GC)

**핵심 질문:** 오래된 컨텍스트와 임시 파일이 자동으로 정리되는가

### 필수 요소

| 요소 | 기준 |
|------|------|
| cleanup workflow | 오래된 임시 파일·세션 데이터 자동 삭제 |
| post-session hook | 세션 종료 시 불필요한 컨텍스트 제거 |
| cron job | 주기적 정리 스케줄 설정 |

### 점수 기준

- **80–100**: cleanup workflow + post-session hook + cron 모두 설정
- **60–79**: cleanup workflow는 있으나 hook 미흡
- **40–59**: 스케줄만 있음
- **0–39**: 자동 정리 없음

---

## Evolution Layer — 자동 업데이트 기록

> 아래 항목은 자동 수집·검토 후 추가됩니다.
> 형식: `[버전] YYYY-MM-DD | 출처 | 반영 이유`

<!-- EVOLUTION_LOG_START -->
- [v20260411.1] 2026-04-11 | Hacker News | context | Claude Code의 복잡한 엔지니어링 작업 실패 사례 분석
  → Layer 1에 '프로젝트 복잡도 평가' 기준 추가: CLAUDE.md에서 프로젝트 스코프(LOC, 모듈 수, 의존성 깊이)를 명시하고, 복잡한 작업은 '작업 분해 가이드(task-decomposition.md)' 필수 포함
- [v20260411.2] 2026-04-11 | Hacker News | context | 보안 이슈: Vercel 플러그인의 프롬프트 텔레메트리 수집 문제
  → Layer 1 필수 요소에 '보안 정책(SECURITY.md)' 추가: 타사 플러그인/통합 도구 사용 시 데이터 수집 범위와 제외 설정을 명시하도록 강제
- [v20260411.3] 2026-04-11 | Hacker News | context | 로컬 LLM(Gemma 4) + Claude Code 통합 패턴
  → Layer 1에 '.claude/integrations.md' 옵션 추가: 외부 LLM 모델, 로컬 에이전트, MCP 서버 연동 시 설정 예시와 성능 기준 문서화
- [v20260411.4] 2026-04-11 | 유저 피드백 | enforcement | MCP 정의 및 테스트 확인 요청
  → Layer 2에 '.claude/settings.json hooks' 기준 상세화: MCP 서버 검증(PreToolUse에서 mcp_call 전 권한·스키마 검사) 항목 추가

<!-- EVOLUTION_LOG_END -->
