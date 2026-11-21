---
created: 2026-10-25
last_updated: 2026-10-25
tags:
  - assistant-emily
  - tutorial
  - quickstart
type: user-manual
order: 1
---

# [제1편] 3분 빠른 시작 & 플러그인 설치 가이드

> **Assistant Emily** 를 처음 설치하셨나요? 3분 만에 플러그인을 활성화하고, 무료 AI 모델을 연결하여 첫 번째 번역 작업을 성공적으로 마칠 수 있는 단계별 튜토리얼입니다.

---

## 📌 전체 흐름 요약

```mermaid
flowchart LR
    Step1["1단계: 플러그인 설치"]
    Step2["2단계: AI 모델 1분 연결"]
    Step3["3단계: 단축키 번역 실습"]
    Step4["4단계: 사이드바 제어 확인"]

    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
```

---

## 1단계: 플러그인 설치 및 활성화

Assistant Emily는 **[옵시디언 공식 커뮤니티 플러그인 디렉터리](https://community.obsidian.md/plugins/assistant-emily)** 에 정식 등록되어 있습니다. 옵시디언 내부에서 1클릭으로 간편하게 설치하실 수 있습니다.

1. 옵시디언 좌측 하단의 톱니바퀴 아이콘(**설정** )을 클릭합니다.
2. 좌측 메뉴에서 **커뮤니티 플러그인(Community Plugins)** 탭을 선택합니다.
3. [탐색(Browse)] 버튼을 누르고 검색창에 `Assistant Emily` 를 검색합니다.
4. 검색 결과에서 **Assistant Emily** 를 선택한 뒤 **[설치(Install)]** ➔ **[활성화(Enable)]** 를 차례로 클릭합니다.

---

## 2단계: FreeLLMAPI 1분 연결

Assistant Emily는 **FreeLLMAPI** 전용으로 설계되었습니다. 별도의 고성능 GPU나 복잡한 설정 없이 단 하나의 무료 키로 즉시 연결할 수 있습니다.

1. 옵시디언 설정 창 좌측 하단의 **Assistant Emily** 설정 탭을 클릭합니다.
2. 첫 번째 서브탭인 **AI 프로바이더(AI Providers)** 로 이동합니다.
3. 다음과 같이 설정값을 입력합니다:
   * **API Base URL**: `https://api.freellmapi.com/v1` (로컬 자체 호스팅 시: `http://localhost:3000/v1`)
   * **API Key**: 발급받은 FreeLLMAPI 인증 키(`flm_...`) 입력
   * **Model Name**: 원하는 무료 모델 입력 (`dots-3-note-preview:free`, `gemini-2.5-flash`, `deepseek-chat` 등)
4. 하단의 **[연결 테스트]** 버튼을 클릭합니다. 초록색 체크 뱃지(`✓ 연결 성공`)가 표시되면 정상 연결된 것입니다.

> [!TIP]
> 기기별 맞춤 설정 및 세부 프로필 관리 방법은 [제2편: FreeLLMAPI 연동 및 기기별 프로필 설정 매뉴얼](02-ai-providers-setup.md) 에 상세히 설명되어 있습니다.

---

## 3단계: 빠른 선택 영역 번역 & 단축키 실습하기

이제 에디터에서 바로 텍스트를 선택하여 번역을 실행해보겠습니다.

1. 임의의 마크다운 노트를 열고, 번역하고 싶은 외국어 문단이나 문장을 마우스로 드래그하여 **선택(Highlight)** 합니다.
   ```markdown
   Artificial Intelligence is transforming personal knowledge management.
   Knowledge graphs and linked notes help researchers build compound ideas over time.
   ```
2. 키보드에서 **`Ctrl + Shift + C`** (Mac: **`Cmd + Shift + C`** )를 누릅니다.
   *(마우스 우클릭 후 컨텍스트 메뉴에서 `Assistant Emily: 선택 영역 번역 후 바로 아래에 덧붙이기` 선택, 또는 `설정 > 단축키`에서 원하는 단축키 지정)*
3. **즉각적인 피드백**: 선택한 텍스트 바로 아래에 실시간 상태 안내 블록이 생성됩니다:
   ```markdown
   > ⏳ **[Assistant Emily] 한국어 번역 진행 중...** 
   ```
4. **번역 완료**: 수초 후 상태 안내 블록이 깔끔한 번역문으로 자동 치환됩니다:
   ```markdown
   Artificial Intelligence is transforming personal knowledge management.
   Knowledge graphs and linked notes help researchers build compound ideas over time.

   인공지능은 개인 지식 관리를 변화시키고 있습니다.
   지식 그래프와 연결된 노트는 연구자들이 시간이 지남에 따라 복합적인 아이디어를 구축할 수 있도록 돕습니다.
   ```

---

## 4단계: 우측 사이드바 뷰 열기 및 실시간 제어

Assistant Emily는 단순 단축키 도구를 넘어 직관적인 **Antigravity 스타일 무경계 스트림(Borderless Stream) 사이드바** 를 제공합니다.

1. 옵시디언 좌측 리본 바에서 스파클스(반짝이) 아이콘(✨, **Assistant Emily** )을 클릭하여 우측 사이드바를 엽니다.
2. **미니멀 대상 문서 인디케이터**: 작업 버튼 바로 아래에 현재 편집 중인 파일명과 실시간 드래그 글자수가 인라인으로 표시됩니다 (`• AI_Research.md (선택 영역 (120자))`). 작업이 실행되면 파이프라인 대상 문서가 자동으로 고정(`(작업 대상 고정)`)되어 안심하고 다른 문서를 탐색할 수 있습니다.
3. **태스크 큐(Task Queue) & 사고 스트림(Thought Stream)**:
   * 단축키를 연속으로 눌러도 작업이 유실되지 않고 순차 큐(`● RUNNING`, `◌ QUEUED`)로 안전하게 적재됩니다. 대기 중인 항목은 `✕` 버튼으로 즉시 취소할 수 있습니다.
   * AI 추론 과정은 1.5px 수직 가이드라인 기반의 경량 사고 스트림으로 실시간 표시되며, 완료 즉시 `Thought for 1.8s ›` 형태로 1줄 자동 축약(클릭하여 세부 토글 가능)됩니다.
   * 실행 중인 작업은 언제든 **`[Cancel]`** 또는 **`❌ 작업 취소`** 버튼으로 즉각 중단할 수 있습니다.
4. **4단계 액션 중심 결과 뷰**:
   * 번역이나 교열이 완료되면 사이드바를 불필요하게 스크롤할 필요 없이 간결한 4단계 결과 뷰가 생성됩니다:
     1. **통합 구분선 헤더**: `──────── 작업 세션 #1 · ● 번역 완료 (시간) ∨ ────────`
     2. **대상 파일 바로가기 링크**: `• 파일명.md` 클릭 시 해당 노트 탭으로 즉시 포커스 이동
     3. **적용 옵션 요약**: 번역 범위, 보존 방식 등 선택했던 파라미터 간결 확인
     4. **원클릭 액션 버튼**: `[대조 검토 ↗]`(좌우 분할 비교 모달 열기), `[복사 ⎘]`(클립보드 복사), `[파일 열기: ... ↗]`(생성된 번역 파일 즉시 열기)
   * 바로 아래에는 `──────── 다음 작업 지시 (Next Task) ────────` 구분선과 함께 입력 폼이 깔끔하게 분리되어 연속 작업을 이어갈 수 있습니다.

---

## 🚀 다음 단계

축하합니다! Assistant Emily의 핵심 기능을 성공적으로 체험하셨습니다. 이제 다음 매뉴얼을 통해 더 깊이 있는 활용법을 익혀보세요:

* ➡️ **[제2편: AI 프로바이더 연결 및 기기별 프로필 설정 매뉴얼](02-ai-providers-setup.md)**
* ➡️ **[제3편: 스마트 마크다운 번역 & 단축키 실전 활용 매뉴얼](03-translation-and-hotkeys.md)**
* ➡️ **[제4편: 전문 AI 마크다운 교열 및 실시간 대조 검토 모달 활용 매뉴얼](04-proofreading-and-diff-review.md)**
