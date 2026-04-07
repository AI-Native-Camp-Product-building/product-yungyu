---
name: commit
description: 변경 사항을 검토하고 컨벤셔널 커밋 메시지로 커밋합니다
---

1. `git diff --staged`로 변경 사항 확인
2. 변경 내용을 분석해서 적절한 커밋 타입 선택: feat / fix / chore / docs / refactor / test
3. 커밋 메시지 형식: `<type>: <요약> (한국어 허용)`
4. `git commit -m "..."` 실행
5. 커밋 완료 후 변경된 파일 목록 요약
