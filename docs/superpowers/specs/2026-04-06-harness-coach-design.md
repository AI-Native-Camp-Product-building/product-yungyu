# Harness Coach — Product Design Spec
**Date:** 2026-04-06
**Status:** Approved

---

## 1. 개요

**Harness Coach**는 Claude Code 사용자가 자신의 AI 하네스(CLAUDE.md, Skills, Hooks, MCP)를 진단하고 개선할 수 있도록 돕는 웹앱 SaaS다.

핵심 포지셔닝: **"Grammarly for Harness"** — AI가 현재 하네스의 약점을 진단하고, 구체적인 개선안을 제안하며, 1클릭으로 적용할 수 있게 한다.

---

## 2. 타겟 사용자

- **1차:** Claude Code를 쓰는 개인 개발자
- **2차:** 공통 하네스를 함께 관리하는 개발팀 (개인에서 팀으로 확장)

---

## 3. 핵심 사용자 흐름

```
Connect → Diagnose → Recommend → Edit → Deploy + Monitor
```

1. **Connect** — GitHub 레포 연결 또는 파일 직접 업로드. CLAUDE.md, skills/, hooks/, .claude/settings.json 자동 감지.
2. **Diagnose** — AI(claude-haiku-4-5)가 3축으로 하네스 점수화.
   - 컨텍스트 파일 커버리지
   - 자동강제 시스템 강도
   - 가비지컬렉션 존재 여부
3. **Recommend** — 약점별 구체적 개선안 생성. 우선순위(긴급/높음/보통)로 정렬. 1클릭 적용 가능.
4. **Edit** — CLAUDE.md, Skills 시각적 편집기. 추천을 적용하거나 직접 커스터마이징.
5. **Deploy** — 수정된 파일 zip 다운로드 (MVP). 이후 GitHub PR 자동 생성.
6. **Monitor** — 하네스 강도 변화 추이 대시보드. 버전 히스토리.

**플라이휠:** 사용할수록 AI가 패턴 학습 → 더 정밀한 추천 → 하네스가 강해짐 → 실수 감소

---

## 4. 핵심 화면

### 4.1 대시보드
- 하네스 강도 종합 점수 (0-100)
- 3축 개별 점수: 컨텍스트 / 자동강제 / 가비지컬렉션
- AI 추천 카드 목록 (우선순위순)
- 구성요소 패널: CLAUDE.md / Skills / Hooks / MCP 현황

### 4.2 편집기
- CLAUDE.md 편집기 (요청 시 AI 피드백 — 자동 분석 없음, 비용 통제)
- Skills 관리 (목록 / 추가 / 편집 / 삭제)
- Hooks 현황 보기 (MVP에서는 편집 제외)
- MCP 연결 현황 보기 (MVP에서는 편집 제외)

### 4.3 AI 분석 뷰
- 분석 실행 트리거 (버튼 클릭 시에만 — 자동 실행 없음)
- 추천 결과 스트리밍 출력
- 각 추천에 "적용" / "무시" 액션

---

## 5. 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| 프레임워크 | Next.js 16 (App Router) | Vercel 최적화, 서버 액션 |
| UI | shadcn/ui + Geist, 다크모드 기본 | 개발자 타겟, 빠른 구현 |
| AI 모델 | claude-haiku-4-5 via Vercel AI Gateway | 비용 효율, 분석에 충분한 성능 |
| AI SDK | AI SDK v6 (streamText) + AI Elements | 스트리밍 추천 결과 렌더링 |
| DB | Neon Postgres | 유저 / 하네스 / 히스토리 / 분석 캐시 |
| 파일 스토리지 | Vercel Blob | 업로드된 하네스 파일 |
| 인증 | Clerk (GitHub 소셜 로그인) | 팀 기능 포함, Vercel Marketplace |
| 배포 | Vercel | 인프라 |

### AI 비용 통제 원칙
- **캐시 의무화:** 파일 hash가 동일하면 재분석 안 함. 결과를 Neon에 저장.
- **수동 트리거:** 저장 시 자동 분석 없음. 사용자가 "분석" 버튼 클릭 시에만 실행.
- **모델:** MVP는 claude-haiku-4-5. 심층 분석 기능 추가 시 Sonnet 부분 적용 검토.

---

## 6. 데이터 모델 (핵심)

```
User
├── id, email, clerk_id
└── Projects[]
    ├── id, name, github_repo_url
    ├── HarnessFiles[] (CLAUDE.md, skills, hooks, settings)
    │   ├── file_path, content, file_hash
    │   └── last_synced_at
    ├── HarnessAnalysis[] (분석 결과 캐시)
    │   ├── file_hash (캐시 키)
    │   ├── scores: { context, enforcement, gc }
    │   ├── recommendations[]
    │   └── created_at
    └── HarnessVersion[] (편집 히스토리)
```

---

## 7. MVP 범위

### Phase 1에 포함
- [x] GitHub 레포 연결 / 파일 업로드
- [x] 하네스 파일 자동 파싱 (CLAUDE.md, skills/, hooks/, settings.json)
- [x] AI 진단 및 3축 점수화 (Haiku)
- [x] AI 추천 생성 및 1클릭 적용
- [x] CLAUDE.md / Skills 시각적 편집기
- [x] 수정 파일 zip 다운로드
- [x] Clerk 인증 (GitHub 소셜 로그인)
- [x] 분석 결과 캐싱 (파일 hash 기반)

### Phase 2 이후
- [ ] Notion / Slack 연동 (업무 스타일 분석)
- [ ] GitHub PR 자동 생성
- [ ] 팀 협업 (하네스 공유, 공통 rules)
- [ ] Hooks / MCP 시각적 편집기
- [ ] 가비지컬렉션 에이전트 설정
- [ ] 하네스 마켓플레이스 (커뮤니티 공유)

---

## 8. 성공 기준 (MVP)

- 사용자가 기존 Claude Code 프로젝트를 연결하고 **5분 안에 첫 진단 결과**를 받는다.
- AI 추천 중 **70% 이상이 "유용하다"** 평가를 받는다.
- 분석 1회 비용이 **$0.01 미만**으로 유지된다 (캐싱 포함).
