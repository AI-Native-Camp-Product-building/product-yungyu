# Harness Coach

> AI가 당신의 Claude Code 하네스를 진단하고, 점수로 보여주고, 개선까지 도와주는 도구

🔗 **[harness-manager.vercel.app](https://harness-manager.vercel.app)**

---

## 누구의 어떤 문제를 푸는가

**Claude Code를 쓰는 개발자**는 CLAUDE.md, Skills, Hooks, settings.json 같은 하네스 파일을 만들어 AI에게 맥락을 제공합니다.

그런데 대부분은 이런 상태입니다:

- CLAUDE.md가 있긴 한데, AI가 실제로 잘 읽고 있는지 모른다
- Skills는 몇 개 만들었지만 체계가 없다
- Hooks 설정은 엄두도 못 냈다
- "하네스가 충분한지"를 판단하는 기준 자체가 없다

**하네스가 약하면 Claude가 매번 같은 실수를 반복하고, 프로젝트마다 맥락을 다시 설명해야 합니다.**

Harness Coach는 이 문제를 풉니다. GitHub 레포를 연결하면 AI가 하네스 파일 전체를 분석해 **무엇이 약한지, 무엇부터 고쳐야 하는지**를 점수와 추천으로 보여줍니다.

---

## 핵심 동작

```
Connect → Diagnose → Recommend → Edit
```

**1. GitHub 레포 연결**
GitHub으로 로그인하고 분석할 레포를 선택합니다. 모든 브랜치를 자동으로 스캔해 하네스 파일을 수집합니다.

**2. AI 3축 진단**
Claude Haiku가 하네스 파일 전체를 읽고 3가지 축으로 점수를 매깁니다.

| 축 | 의미 |
|----|------|
| 컨텍스트 | CLAUDE.md와 Skills가 프로젝트를 얼마나 잘 설명하는가 |
| 자동강제 | Hooks, CI, pre-commit으로 규칙이 자동 강제되는가 |
| 가비지컬렉션 | 오래된 데이터와 임시 파일이 자동으로 정리되는가 |

**3. 우선순위 추천**
긴급 / 높음 / 보통으로 분류된 개선 추천과 함께 **Claude Code에 바로 붙여넣을 수 있는 명령 스크립트**를 생성합니다.

**4. 편집기**
CLAUDE.md와 Skills를 웹에서 직접 편집하고 저장할 수 있습니다.

---

## 완성되면 누구에게 보여줄 것인가

**1차 타겟: Claude Code를 이미 쓰는 개발자**
하네스를 만들어봤지만 "잘 되고 있는지" 확신이 없는 사람들. 점수를 보는 순간 자신의 하네스가 얼마나 허술한지 알게 됩니다.

**2차 타겟: 개발팀 리드**
팀원들의 하네스 품질을 표준화하고 싶은 리더. 팀 전체 하네스를 같은 기준으로 진단하고 관리할 수 있습니다.

---

## MCP 서버 연동

Harness Coach는 **MCP(Model Context Protocol) 서버**를 내장하고 있어, Claude Code에서 직접 하네스 진단과 개선 추천을 받을 수 있습니다.

### 제공 도구

| 도구 | 설명 |
|------|------|
| `diagnose_harness` | GitHub 레포의 하네스 파일을 3축(컨텍스트 / 자동강제 / 가비지컬렉션)으로 진단하고 점수를 반환 |
| `improve_harness` | 우선순위별 개선 추천 목록과 항목별 실행 프롬프트를 반환 |

### 연결 방법

1. [harness-manager.vercel.app](https://harness-manager.vercel.app) 대시보드에서 **API Key 발급**
2. `~/.claude/.mcp.json`에 아래 내용 추가:

```json
{
  "mcpServers": {
    "harness-coach": {
      "type": "http",
      "url": "https://harness-manager.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

3. Claude Code 재시작 후 `/mcp` 명령으로 연결 확인

> 상세 가이드: [`docs/mcp-guide.md`](docs/mcp-guide.md)

---

## 하네스 자동 최적화 루프

MCP 도구를 활용하면 Claude Code를 오케스트레이터로 삼아 **하네스를 목표 점수까지 자동으로 개선하는 루프**를 돌릴 수 있습니다.

### 사용법

Claude Code에 이렇게 말하면 됩니다:

```
최적화 루프 실행해줘
```

Claude가 목표 점수와 최대 반복 횟수를 물어본 뒤 루프를 시작합니다. 나머지는 자동입니다.

### 동작 방식

```
진단 → 점수 확인 → (임계값 미달) → 개선 적용 → 파일 쓰기 → 재진단 → ...
```

로컬 파일을 직접 읽어 MCP 서버에 전달하므로 **GitHub fetch 없이 즉시 분석**됩니다. 점수가 목표에 도달하거나 최대 반복 횟수에 이르면 루프가 종료되고 변경 내역을 요약해줍니다.

### MCP 도구 인터페이스 (루프 모드)

| 도구 | 루프 모드 입력 | 반환 |
|------|--------------|------|
| `diagnose_harness` | `files: [{path, content}]` | 3축 점수 + 추천 목록 |
| `improve_harness` | `files` + `recommendations` | 개선된 파일 전체 내용 |

> 구현 스펙: [`docs/superpowers/specs/2026-04-09-harness-optimization-loop-design.md`](docs/superpowers/specs/2026-04-09-harness-optimization-loop-design.md)

---

## 좋은 하네스란 무엇인가 — 3축 정의

Harness Coach는 하네스 품질을 세 가지 축으로 정의합니다. 세 축이 모두 균형 있게 갖춰져야 AI가 제대로 작동합니다.

### Layer 1 — 컨텍스트 (Context)

> *"AI에게 프로젝트를 얼마나 잘 설명하고 있는가"*

AI는 맥락이 없으면 일반적인 답변만 합니다. 컨텍스트 레이어는 AI가 **이 프로젝트만의 규칙과 배경**을 이해하도록 합니다.

| 구성 요소 | 역할 |
|----------|------|
| `CLAUDE.md` | 프로젝트 목적, 기술 스택, 코딩 규칙, 금지 패턴 |
| `skills/` | 반복 작업별 전문 지식 (커밋 방법, 리뷰 기준 등) |
| 아키텍처 다이어그램 | 컴포넌트 구조와 데이터 흐름 |

**약한 신호:** AI가 같은 실수를 반복하거나, 프로젝트 규칙을 무시한 코드를 생성할 때.

### Layer 2 — 자동강제 (Enforcement)

> *"품질 기준이 얼마나 자동으로 강제되는가"*

규칙을 문서화해도 AI가 따르지 않으면 의미가 없습니다. 자동강제 레이어는 **훅과 CI로 규칙 위반을 자동 차단**합니다.

| 구성 요소 | 역할 |
|----------|------|
| `.claude/settings.json` hooks | AI 행동 전후로 자동 실행되는 검사 |
| `.husky/` pre-commit | 커밋 전 lint·타입 검사 |
| `.github/workflows/` CI | PR마다 테스트·커버리지 강제 |
| `lint-staged` | 변경 파일에만 빠른 검사 적용 |

**약한 신호:** 규칙이 CLAUDE.md에는 있지만 hook이나 CI로 강제되지 않을 때.

### Layer 3 — 가비지컬렉션 (GC)

> *"오래된 컨텍스트와 임시 파일이 자동으로 정리되는가"*

AI 세션이 쌓이면 오래된 정보가 노이즈가 됩니다. GC 레이어는 **컨텍스트를 주기적으로 정리**해 AI가 항상 최신 상태에서 작동하도록 합니다.

| 구성 요소 | 역할 |
|----------|------|
| Cron 잡 | 만료된 세션 데이터 자동 삭제 |
| `cleanup-sessions` 워크플로우 | 오래된 임시 파일 정리 |
| Post-session hook | 세션 종료 시 불필요한 컨텍스트 제거 |

**약한 신호:** 시간이 지날수록 AI 응답 품질이 낮아지거나, 이전 세션 데이터가 간섭할 때.

### 종합 점수 해석

| 점수 | 등급 | 의미 |
|------|------|------|
| 80–100 | A | 세 축이 균형 있게 갖춰진 이상적인 하네스 |
| 60–79 | B | 기본은 있으나 자동화 또는 정리 부분이 부족 |
| 40–59 | C | CLAUDE.md 정도만 있는 초기 상태 |
| 0–39 | D | 하네스가 거의 없어 AI가 맥락 없이 동작 |
