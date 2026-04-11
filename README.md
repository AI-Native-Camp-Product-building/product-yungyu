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

### 동작 방식

```
진단 → 점수 확인 → (임계값 미달) → 개선 적용 → 파일 쓰기 → 재진단 → ...
```

Claude Code가 로컬 하네스 파일을 직접 읽어 MCP 서버에 전달하므로 **GitHub fetch 없이 즉시 분석**됩니다. 점수가 목표에 도달하거나 최대 반복 횟수에 이르면 루프가 종료됩니다.

### Claude Code에 붙여넣을 프롬프트

```
현재 디렉토리의 하네스 파일(CLAUDE.md, skills/, hooks/, .claude/settings.json)을 읽어서
diagnose_harness(files)로 진단하고, 종합 점수가 80점 미만이면
improve_harness(files, recommendations)로 개선된 파일 내용을 받아 로컬에 저장해줘.
점수가 80점 이상이 될 때까지 최대 5번 반복하고,
각 라운드마다 점수 변화를 출력해줘.
```

### MCP 도구 인터페이스 (루프 모드)

| 도구 | 루프 모드 입력 | 반환 |
|------|--------------|------|
| `diagnose_harness` | `files: [{path, content}]` | 3축 점수 + 추천 목록 + `loop_data` JSON |
| `improve_harness` | `files` + `recommendations` | 개선된 파일 내용 + `loop_data.improved_files` |

- `files`를 직접 전달하면 GitHub fetch와 DB 캐시를 건너뜁니다.
- `improve_harness`는 수정된 파일의 **완성된 내용 전체**를 반환하므로, Claude Code가 그대로 로컬에 덮어쓸 수 있습니다.

> 구현 스펙: [`docs/superpowers/specs/2026-04-09-harness-optimization-loop-design.md`](docs/superpowers/specs/2026-04-09-harness-optimization-loop-design.md)
