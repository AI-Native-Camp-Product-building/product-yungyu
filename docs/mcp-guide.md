# Harness Coach — Claude Code MCP 연결 가이드

Harness Coach를 Claude Code에 MCP로 연결하면, 대화 중에 바로 하네스를 진단하고 개선 방법을 받을 수 있습니다.

---

## 준비물

- [Harness Coach](https://harness-manager.vercel.app) 계정 (GitHub으로 로그인)
- Claude Code 설치됨 ([설치 방법](https://claude.ai/download))

---

## Step 1. API 키 발급

1. [harness-manager.vercel.app](https://harness-manager.vercel.app) 에 로그인합니다.
2. 우측 상단 프로필 → **Settings** 또는 대시보드 → **API Keys** 로 이동합니다.
3. **새 API 키 생성** 버튼 클릭 → 이름 입력 (예: `Claude Code`) → 생성
4. 발급된 키를 **즉시 복사**합니다.

> ⚠️ API 키는 생성 직후에만 전체 값이 표시됩니다. 창을 닫으면 다시 볼 수 없으니 반드시 복사해두세요.

---

## Step 2. Claude Code에 MCP 등록

터미널을 열고 아래 명령어를 실행합니다. `여기에_API_키_붙여넣기` 부분을 Step 1에서 복사한 키로 교체하세요.

```bash
claude mcp add \
  --transport http \
  --scope user \
  harness-coach \
  https://harness-manager.vercel.app/api/mcp \
  --header "Authorization: Bearer 여기에_API_키_붙여넣기"
```

성공하면 이런 메시지가 나타납니다:
```
Added HTTP MCP server harness-coach with URL: https://harness-manager.vercel.app/api/mcp
```

---

## Step 3. 연결 확인

```bash
claude mcp list
```

아래처럼 `✓ Connected`가 보이면 완료입니다:

```
harness-coach: https://harness-manager.vercel.app/api/mcp (HTTP) - ✓ Connected
```

---

## Step 4. Claude Code 재시작

Claude Code를 완전히 종료한 뒤 다시 엽니다.
새 대화에서 `/mcp` 를 입력하면 `harness-coach`가 목록에 보입니다.

---

## 사용 방법

연결이 완료되면 Claude Code 대화창에서 바로 사용할 수 있습니다.

**하네스 진단 요청:**
```
내 하네스 진단해줘. GitHub 레포: https://github.com/내아이디/내레포
```

**개선 방법 확인:**
```
내 하네스 개선 방법 알려줘
```

**특정 항목 바로 적용:**
```
0번 개선 항목 적용해줘
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `Unauthorized` 오류 | API 키가 잘못됨 | Step 1 다시 진행해 새 키 발급 |
| MCP 목록에 안 보임 | Claude Code 재시작 안 함 | Claude Code 완전 종료 후 재시작 |
| `Not Connected` 상태 | 서버 오류 | 잠시 후 다시 시도 |
| 키를 분실한 경우 | - | Settings에서 기존 키 삭제 후 새 키 발급 |

---

## MCP 제거 방법

더 이상 사용하지 않으려면:

```bash
claude mcp remove harness-coach
```
