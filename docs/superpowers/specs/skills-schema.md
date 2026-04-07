# Skills 파일 스키마 명세

## 개요

Skills는 Claude Code의 `/skill-name` 슬래시 커맨드로 호출되는 마크다운 파일입니다.
`skills/` 또는 `.claude/skills/` 디렉토리에 위치합니다.

## 파일 형식

```
skills/
├── commit.md
├── review.md
└── session-wrap.md
```

## 필수 구조

```markdown
---
name: <slug> (파일명과 일치, kebab-case)
description: <한 줄 설명 — 슬래시 커맨드 목록에 표시됨>
---

<스킬 본문 — Claude에게 전달되는 지시사항>
```

## 필드 명세

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 커맨드 이름. `/name`으로 호출됨 |
| `description` | string | ✅ | 커맨드 목록에 표시되는 한 줄 설명 |
| 본문 | markdown | ✅ | Claude에게 전달되는 지시사항 |

## 채점 기준 (Harness Coach)

| 상태 | enforcement 점수 영향 |
|------|----------------------|
| skills/ 없음 | 0점 |
| 1–2개 skills | +10점 |
| 3개 이상 skills | +20점 |
| description 필드 완비 | +추가 평가 |
