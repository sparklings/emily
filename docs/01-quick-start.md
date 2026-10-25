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

### 방법 A: 옵시디언 커뮤니티 플러그인 디렉터리 (권장)
1. 옵시디언 좌측 하단의 톱니바퀴 아이콘(**설정** )을 클릭합니다.
2. 좌측 메뉴에서 ** 커뮤니티 플러그인(Community Plugins)** 탭을 선택합니다.
3. [탐색(Browse)] 버튼을 누르고 검색창에 `Assistant Emily` 를 입력합니다.
4. 검색 결과에서 **Assistant Emily** 카드를 클릭한 뒤 **[설치(Install)]** 버튼을 누릅니다.
5. 설치가 완료되면 **[활성화(Enable)]** 버튼을 클릭하여 플러그인을 켭니다.

### 방법 B: 수동 설치 (GitHub Release)
1. [GitHub Releases](https://github.com/sparklings/emily/releases) 페이지에서 최신 버전의 `assistant-emily.zip` 파일을 다운로드합니다.
2. 옵시디언 보관함(Vault) 내부의 플러그인 경로인 `.obsidian/plugins/assistant-emily` 폴더를 생성하고 압축을 풉니다.
   * 필수 파일: `main.js`, `manifest.json`, `styles.css`
3. 옵시디언의 `설정 > 커뮤니티 플러그인` 에서 [설치된 플러그인 새로고침]을 누른 후 **Assistant Emily** 를 활성화합니다.

---

## 2단계: FreeLLMAPI 1분 연결 (핵심 추천)

Assistant Emily는 **FreeLLMAPI** 를 핵심 1순위 AI 프록시로 설계되었으며, 오프라인 로컬 환경을 위한 Ollama 및 표준 OpenAI 호환 엔드포인트도 유연하게 연결할 수 있습니다.

1. 옵시디언 설정 창 좌측 하단의 **Assistant Emily** 설정 탭을 클릭합니다.
2. 첫 번째 서브탭인 **AI 프로바이더(AI Providers)** 로 이동합니다.
3. 가장 권장되는 방식을 선택합니다:

| 연결 방식 | 설정 방법 | 추천 사용자 |
| :--- | :--- | :--- |
| **A. FreeLLMAPI (1순위 핵심 추천 / 통합 무료)** | • Base URL: https://api.freellmapi.com/v1<br/>• API Key: FreeLLMAPI 토큰 입력<br/>• Model: dots-3-note-preview:free 또는 gemini-2.5-flash | 고성능 GPU 없이 무료로 수십 개 고품질 LLM을 즉시 사용하고자 하는 모든 사용자 (최우선 권장) |
| **B. Ollama (오프라인 로컬 무료 대안)** | • Base URL: http://localhost:11434/v1<br/>• API Key: 공란<br/>• Model: qwen2.5:14b 또는 llama3.1:8b | 인터넷 연결 없는 오프라인 환경이나 개인 GPU 환경을 원하는 사용자 |
| **C. 기타 OpenAI 호환 엔드포인트 (부가 지원)** | • Base URL: 해당 엔드포인트 URL<br/>• API Key: 발급받은 인증 키<br/>• Model: 지정 모델명 | 기존에 사용 중인 사내 또는 외부 OpenAI 호환 엔드포인트를 연결하려는 사용자 |

4. 하단의 **[연결 테스트]** 버튼을 클릭합니다. 초록색 체크 뱃지(`✓ 연결 성공`)가 표시되면 정상 연결된 것입니다.

> [!TIP]
> 기기별 맞춤 설정 및 세부 프로바이더 연결 방법은 [제2편: AI 프로바이더 연결 및 기기별 프로필 설정 매뉴얼](02-ai-providers-setup.md) 에 상세히 설명되어 있습니다.

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

Assistant Emily는 단순 단축키 도구를 넘어 강력한 전용 제어 사이드바를 제공합니다.

1. 옵시디언 좌측 리본 바에서 반짝이는 별 아이콘(**Assistant Emily** )을 클릭하여 우측 사이드바를 엽니다.
2. 단축키나 에디터 우클릭 메뉴로 번역을 실행하면, 우측 사이드바에 ** 실시간 파이프라인 박스** 가 자동으로 펼쳐집니다:
   * **1단계: 선택 영역 파싱** (글자 수 표시)
   * **2단계: LLM 번역 중** (실시간 경과 타이머 `0.0s` 작동)
   * **3단계: 문서 동기화 대기**
3. ** 작업 취소 기능**: 번역 도중 다른 작업을 해야 하거나 요청을 중단하고 싶을 때, 사이드바 상단의 **`❌ 작업 취소`** 버튼을 누르면 백그라운드 호출이 즉시 중단되며, 에디터 본문의 상태 안내 블록도 원문 그대로 깨끗하게 자동 롤백됩니다.
4. ** 대조 검토 모달**: 번역이 완료되면 사이드바 하단 히스토리에 세션 카드가 자동 등록되며, **`[번역 결과 대조 검토]`** 버튼을 눌러 원문과 번역문을 나란히 비교하고 직접 교정할 수 있습니다.

---

## 🚀 다음 단계

축하합니다! Assistant Emily의 핵심 기능을 성공적으로 체험하셨습니다. 이제 다음 매뉴얼을 통해 더 깊이 있는 활용법을 익혀보세요:

* ➡️ **[제2편: AI 프로바이더 연결 및 기기별 프로필 설정 매뉴얼](02-ai-providers-setup.md)**
* ➡️ **[제3편: 스마트 마크다운 번역 & 단축키 실전 활용 매뉴얼](03-translation-and-hotkeys.md)**
* ➡️ **[제4편: 전문 AI 마크다운 교열 및 실시간 대조 검토 모달 활용 매뉴얼](04-proofreading-and-diff-review.md)**
