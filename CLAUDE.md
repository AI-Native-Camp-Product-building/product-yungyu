# Harness Coach

AI가 Claude Code 하네스를 진단하고 개선안을 제안하는 웹앱 SaaS.

## 프로젝트 개요

**포지셔닝:** "Grammarly for Harness" — 사용자의 CLAUDE.md, Skills, Hooks, MCP를 분석해 약점을 진단하고 1클릭으로 개선 적용.

**타겟:** Claude Code를 쓰는 개인 개발자 → 팀으로 확장.

**스펙:** `docs/superpowers/specs/2026-04-06-harness-coach-design.md`
**구현 계획:** `docs/superpowers/plans/2026-04-06-harness-coach.md`

## 핵심 사용자 흐름

```
Connect → Diagnose → Recommend → Edit → Deploy + Monitor
```

1. GitHub 레포 연결 또는 파일 업로드
2. AI(claude-haiku-4.5)가 3축 점수화: 컨텍스트 / 자동강제 / 가비지컬렉션
3. 우선순위별 개선안 제안 (1클릭 적용)
4. CLAUDE.md / Skills 시각적 편집
5. 수정 파일 zip 다운로드

## 기술 스택

| 레이어 | 선택 |
|--------|------|
| 프레임워크 | Next.js 16 (App Router, Server Actions) |
| UI | shadcn/ui + Geist, **다크모드 기본** |
| AI | claude-haiku-4.5 via **Vercel AI Gateway (OIDC)** |
| AI SDK | AI SDK v6 (generateText) + AI Elements |
| DB | Drizzle ORM + Neon Postgres |
| 파일 | Vercel Blob |
| 인증 | Clerk (GitHub 소셜 로그인) |
| 테스트 | Vitest |
| 배포 | Vercel |

## 절대 하면 안 되는 것

- `ANTHROPIC_API_KEY` 직접 사용 금지 — 반드시 Vercel AI Gateway (OIDC) 사용
- AI 텍스트를 `{text}` 또는 `<p>{content}</p>`로 렌더링 금지 — AI Elements 사용
- 분석 버튼 없이 자동 AI 호출 금지 — 비용 통제를 위해 수동 트리거만
- 파일 hash가 동일하면 재분석 금지 — 반드시 캐시 확인 후 실행

## AI 비용 통제 원칙

- 모델: `anthropic/claude-haiku-4.5` (Sonnet/Opus 사용 금지, 명시적 승인 없이는)
- 캐시 키: 프로젝트의 모든 하네스 파일 hash를 합친 `filesHash`
- 트리거: 사용자가 "분석" 버튼 클릭 시에만 실행
- 목표: 분석 1회 비용 $0.01 미만

## 파일 구조 (예정)

```
harness-manager/
├── app/
│   ├── (auth)/          # Clerk sign-in/sign-up
│   └── (app)/
│       ├── dashboard/   # 프로젝트 목록
│       └── projects/[id]/
│           ├── page.tsx        # 대시보드 (점수 + 추천)
│           └── editor/page.tsx # CLAUDE.md + Skills 편집기
├── components/
│   ├── harness-score-card.tsx
│   ├── recommendation-card.tsx
│   ├── claude-md-editor.tsx
│   └── skills-manager.tsx
├── lib/
│   ├── db/schema.ts     # Drizzle 스키마
│   ├── harness/parser.ts  # 파일 파싱 + hash (순수 함수, 테스트 필수)
│   └── ai/analyzer.ts   # AI 분석 프롬프트 + 파싱 (순수 함수, 테스트 필수)
├── actions/
│   ├── projects.ts
│   ├── harness.ts
│   └── analysis.ts      # 캐시 확인 → AI 실행 → 저장
└── middleware.ts         # Clerk auth guard
```

## MVP 범위 (Phase 1)

- [x] 설계 완료
- [ ] GitHub 레포 연결 / 파일 업로드
- [ ] 하네스 파싱 (CLAUDE.md, skills/, hooks/, settings.json)
- [ ] AI 진단 + 3축 점수화
- [ ] AI 추천 + 1클릭 적용
- [ ] CLAUDE.md / Skills 편집기
- [ ] zip 다운로드
- [ ] Clerk 인증

## Phase 2 (나중에)

- Notion / Slack 연동 (업무 스타일 분석)
- GitHub PR 자동 생성
- 팀 협업
- Hooks / MCP 편집기
- 가비지컬렉션 에이전트

## 테스트 규칙

- **커버리지 80% 이상 필수** — `lib/harness/parser.ts`, `lib/ai/analyzer.ts` 는 순수 함수이므로 반드시 테스트
- `npm run test:coverage` 로 확인, 미달 시 CI 실패
- 새 순수 함수 추가 시 동일 파일에 `.test.ts` 작성 필수

## 핵심 함수 스펙

### `lib/harness/parser.ts`

```typescript
// 파일 맵에서 하네스 구조 파싱
parseHarnessFromMap(files: Map<string, string>): HarnessData

// 하네스 구조를 평탄한 파일 배열로 변환
getAllFiles(harness: HarnessData): Array<{ path: string; content: string; hash: string }>

// 단일 파일 내용 해시 (SHA-256, hex)
hashContent(content: string): string

// 여러 파일의 해시를 합산한 캐시 키 생성
hashFiles(files: Array<{ hash: string }>): string
// → 실패 없음. 빈 배열이면 빈 문자열 반환
```

### `lib/ai/analyzer.ts`

```typescript
// AI 분석용 프롬프트 생성 (순수 함수, 부작용 없음)
buildAnalysisPrompt(fileContents: string): string

// AI 응답 JSON 파싱. 마크다운 코드블록 자동 제거
// → JSON 파싱 실패 시 SyntaxError throw
parseAnalysisResponse(raw: string): AnalysisResult

// AI Gateway 호출 → 분석 실행
// → Gateway 오류 시 GatewayInternalServerError throw
analyzeHarness(fileContents: string): Promise<AnalysisResult>
```

### `actions/analysis.ts` — 캐시 키 전략

```typescript
// filesHash = SHA-256(각 파일 hash를 정렬 후 연결)
// 동일 hash 존재 시 → DB 캐시 반환 (AI 미호출)
// 새 hash → AI 분석 → DB 저장
getOrRunAnalysis(projectId: string): Promise<HarnessAnalysis | null>
```

## 로컬 개발 시작

```bash
# 1. Vercel 프로젝트 연결 + AI Gateway 활성화
vercel link
vercel env pull .env.local

# 2. Neon DB 마이그레이션
npx drizzle-kit migrate

# 3. 개발 서버
npm run dev
```
