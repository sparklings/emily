# 어시스턴트 에밀리


<p align="center">
  옵시디언 마크다운 지능형 무손실 교열 · 맥락 인식 전문 번역 AI 페어 어시스턴트 플러그인
</p>

<p align="center">
  <a href="https://sparklings.github.io/emily/"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-brightgreen.svg?style=flat-square" alt="Documentation"></a>
  <a href="https://github.com/sparklings/emily/releases"><img src="https://img.shields.io/badge/version-1.0.20-blue.svg?style=flat-square" alt="Version"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-v1.7.2+-purple.svg?style=flat-square" alt="Obsidian"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="#-시스템-아키텍처-및-구조-system-architecture"><img src="https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg?style=flat-square" alt="TypeScript"></a>
  <a href="#-보안-프라이버시-및-규정-준수-고지-security-privacy--disclosures"><img src="https://img.shields.io/badge/Privacy-100%25%20Local%2FDirect-success.svg?style=flat-square" alt="Privacy"></a>
  <a href="#-개요-overview"><img src="https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg?style=flat-square" alt="Desktop Only"></a>
</p>

<p align="center">
  <a href="#assistant-emily"><b>🇺🇸 English</b></a> | <a href="#어시스턴트-에밀리"><b>🇰🇷 한국어</b></a> | <a href="https://sparklings.github.io/emily/"><b>🌐 Website</b></a>
</p>

---

## 📖 목차

1. [개요 (Overview)](#-개요-overview)
2. [공식 웹사이트 및 문서 (Official Documentation)](#-공식-웹사이트-및-문서-official-documentation)
3. [상세 기능 (Detailed Features)](#-상세-기능-detailed-features)
   - [1. 무손실 지능형 마크다운 교열 (Lossless Proofreading)](#1-무손실-지능형-마크다운-교열-lossless-proofreading)
   - [2. 맥락 인식 전문 번역 (Context-Aware Translation)](#2-맥락-인식-전문-번역-context-aware-translation)
   - [3. 마크다운 타이포그래피 및 서식 정규화 (Typography Normalizer)](#3-마크다운-타이포그래피-및-서식-정규화-typography-normalizer)
   - [4. 사용자 맞춤 자유 지시 (Custom Natural Instructions)](#4-사용자-맞춤-자유-지시-custom-natural-instructions)
   - [5. 대화형 Diff 검토 (Interactive Diff Review)](#5-대화형-diff-검토-interactive-diff-review)
   - [6. 기기 프로필 기반 스마트 엔드포인트 관리 (Device Profile-Based Provider Management)](#6-기기-프로필-기반-스마트-엔드포인트-관리-device-profile-based-provider-management)
   - [7. 실시간 작업 제어 및 스마트 데스크톱 UX (Real-Time Control & Smart UX)](#7-실시간-작업-제어-및-스마트-데스크톱-ux-real-time-control--smart-ux)
4. [설치 및 환경 설정 (Installation & Setup)](#-설치-및-환경-설정-installation--setup)
   - [플러그인 설치 방법](#플러그인-설치-방법)
   - [AI 서비스 엔드포인트 및 기기 프로필 설정 가이드](#ai-서비스-엔드포인트-및-기기-프로필-설정-가이드)
5. [보안, 프라이버시 및 규정 준수 고지 (Security, Privacy & Disclosures)](#-보안-프라이버시-및-규정-준수-고지-security-privacy--disclosures)
   - [외부 네트워크 통신 고지 (Network Usage)](#외부-네트워크-통신-고지-network-usage)
   - [볼트 파일 접근 및 권한 (Vault File Access)](#볼트-파일-접근-및-권한-vault-file-access)
   - [계정 및 요금 정책 (Account & Monetization)](#계정-및-요금-정책-account--monetization)
   - [원격 분석 및 광고 배제 (Telemetry & Advertisements)](#원격-분석-및-광고-배제-telemetry--advertisements)
6. [오픈소스 프로젝트 크레딧 및 감사의 글 (Acknowledgements & Open Source Credits)](#-오픈소스-프로젝트-크레딧-및-감사의-글-acknowledgements--open-source-credits)
7. [개발 및 배포 브랜치 전략 (Branching & Release Workflow)](#-개발-및-배포-브랜치-전략-branching--release-workflow)
8. [라이선스 (License)](#-라이선스-license)

---

## 🌟 개요 

**Assistant Emily** 는 옵시디언(Obsidian) 환경에서 학술 연구, 기술 문서 작성, 지식 정리 및 번역 작업을 수행하는 사용자를 위해 설계된 **데스크톱 전용 지능형 AI 페어 어시스턴트 플러그인** 입니다.

일반적인 AI 도구들은 마크다운 문서를 다룰 때 YAML 프론트매터, 옵시디언 내부 링크(`[[노트명]]`), 태그(`#tag`), 수식(`$...$`), 콜아웃 블록(`> [!note]`) 등을 훼손하거나 변형시키는 문제를 안고 있습니다. Assistant Emily는 이러한 문제를 극복하기 위해 **독자적인 문법 마스킹 파이프라인(Syntax Masking Pipeline)** 을 기반으로 설계되었습니다.

### 핵심 가치
* **100% 무손실 보존(Lossless Preservation)** : 원본 문서의 고유한 메타데이터와 옵시디언 고유 문법을 보호합니다.
* **학술 및 전문 문서에 최적화** : 대용량 문서에 대한 지능형 스마트 청킹(Smart Chunking), 1:1 문단 대조 번역(Bilingual Alignment), 코드 블록 내부 주석 선택 번역을 지원합니다.
* **로컬 AI 및 프라이버시 존중** : OpenAI 공식 API뿐만 아니라 `FreeLLMAPI`, 로컬 Ollama, LM Studio, vLLM, OpenRouter 등 OpenAI 호환 엔드포인트를 폭넓게 지원합니다.

---

## 🌐 공식 웹사이트 및 문서 (Official Documentation)

Assistant Emily의 상세 기능 소개, 대화형 시연 목업, 최신 설치 안내는 **[Assistant Emily 공식 웹사이트](https://sparklings.github.io/emily/)**에서 확인하실 수 있습니다.

---

## 🚀 상세 기능

### 1. 무손실 지능형 마크다운 교열 (Lossless Proofreading)
* **문맥 기반 오탈자 및 문법 교정** : 단순 규칙 기반 검사를 넘어, LLM의 문맥 이해력을 활용하여 맞춤법, 띄어쓰기, 어색한 조사, 주술 호응 관계를 지능적으로 바로잡습니다.
* **클린 3대 독립 교열 도구** : 사이드바에서 `맞춤법 검사`, `문법 검사`, `타임스탬프 삭제`를 세그먼트 그리드 버튼으로 원하는 조합만 자유롭게 다중 선택하여 실행할 수 있습니다.
* **선택 영역 기반 지능형 교열 분기 (Selection-Scoped Proofreading)** : 번역 모드가 OFF인 상태에서 문서의 특정 단락을 마우스로 드래그 선택하면, 전체 문서 대신 **선택된 영역만 정밀 교열**을 수행합니다 (미선택 시 전체 문서 자동 Fallback). 에디터의 선택 상태를 실시간 감지하여 사이드바 대상 문서 바에 `선택 영역 (N자)` 보라색 액센트 배지를 표시하며, 교열 승인 시 선택 범위만 원자적으로 안전하게 치환(`replaceRange`)하여 선택 외 본문 오염을 100% 원천 방지합니다.
* **다국어 교열 정책 준수 & 가짜 더미 제안 원천 차단** : UI 설정 언어(한국어 vs English)에 맞추어 교열 결과 설명문(`explanation`)의 언어를 엄격히 일치시키며, 불필요한 합성 더미 카드를 완전히 배제하여 실제 감지된 정제 교열 항목만 투명하게 제공합니다.
* **문법 마스킹 보호** : 옵시디언 위키링크(`[[Note]]`, `[[Note|Alias]]`), 태그(`#tag`), 콜아웃 헤더(`> [!tip]`), 인라인/블록 LaTeX 수식(`$...$`, `$$...$$`), 인라인 코드 및 코드 블록 전체를 UUID 토큰으로 안전하게 보호한 뒤 교열을 수행하여 원본 서식이 절대 깨지지 않습니다.
* **인터랙티브 Diff 모달**
  * 발견된 모든 교정 항목을 카테고리(`[맞춤법 검사]`, `[문법 검사]`, `[타임스탬프 삭제]`)별로 목록화하여 표시합니다.
  * 항목별로 개별 적용 여부를 체크박스로 자유롭게 켜고 끌 수 있습니다.
  * 항목을 클릭하면 에디터의 해당 위치로 즉시 스크롤되어 전후 맥락을 직관적으로 확인할 수 있습니다.

### 2. 맥락 인식 전문 번역 및 문체 정합 (Context-Aware Translation & Tone Rewriting)
* **3가지 직관적 작업 범위(Scope) 지원**
  * **선택 영역 번역(Selection Only)** : 블록 지정된 텍스트 영역만 빠르게 번역 및 다듬기.
  * **전체 문서 번역(Full Document)** : 문서 전체의 H1~H6 헤더 계층 구조를 100% 보존하며 번역.
  * **단락별 1:1 대조(Paragraph Bilingual)** : 원문 문단 바로 아래에 번역 문단을 1:1로 배치하여 논문이나 외신 번역 검토 시 최적의 가독성을 제공합니다.
* **일원화된 문체(Tone) 및 스타일(Style) 정합 엔진**
  * 다국어 번역뿐만 아니라 **동일 언어 편집(한국어 ➔ 한국어 다듬기)** 시에도 지정된 문체로 문서 전체의 종결어미와 어조를 일관되게 정합화합니다.
  * **문체(Tone)**: `학술체(Academic - ~이다/한다)`, `경어체(Polite - ~합니다/하십시오)`, `친근체(Friendly - ~해요/있어요)`
  * **스타일(Style)**: `직역 중심(Literal)`, `균형 잡힌 정제(Balanced)`, `자연스러운 의역(Free Natural)`
  * **예외 구역 완벽 보존 가드레일**: 인용문(`> ...`, `"..."`), 코드 블록(\`\`\`...\`\`\`), 인라인 코드(\`...\`), 수식(`$...$`), YAML 프론트매터 및 헤딩 제목(#)은 화자의 원래 발언이나 코드 형태를 유지해야 하므로 문체 교정 대상에서 엄격히 제외되어 원형 그대로 안전하게 보존됩니다.
* **코드 블록 주석 전용 번역 스위치**
  * 프로그래밍 코드 블록(`python`, `typescript`, `cpp` 등) 내부의 코드 로직, 변수명, 함수명은 100% 보존하면서 오직 주석(`//`, `#`, `/* ... */`)만 자연스럽게 번역할 수 있습니다.
* **안전 스마트 청킹 및 무결성 보존 (Smart Chunking - 2,500자 최적화)**
  * LLM의 단일 응답 토큰 한계(4,096 토큰)를 초과하는 대용량 문서는 H1~H3 헤더 및 문단 경계를 분석하여 무결성을 유지하며 2,500자 단위로 안전하게 분할 번역한 뒤 하나로 완벽하게 재조립합니다. (출력 절단 및 누락 0% 보장)
  * 빈 줄이나 공백만 남은 불완전 청크 생성을 원천 차단하고 루프 안전 가드를 적용하여 안정적인 1:1 대조 정합성을 제공합니다.
  * 한국어 번역 시 한글 누락이나 모델 추론 독백으로 인한 비정상 절단을 감지하는 안전 가드를 탑재하여 볼트 파일 오염을 방지합니다.

### 3. 마크다운 타이포그래피 및 선택적 서식 제거 (Typography & Format Stripper)
* **선택적 마크다운 서식 제거 (Selective Markdown Format Stripping)**
  * 복사해 온 웹 아티클이나 번역 문서에서 **볼드체(`**`), 기울이기(`*`), 취소선(`~~`), 형광펜 하이라이트(`==`)** 4종 서식을 체크박스로 선택하여 본문에서 즉시 제거할 수 있습니다.
  * 4개 항목 중 전체 또는 일부를 자유롭게 선택 적용할 수 있으며, 설정 화면(`Settings > Assistant Emily`)에서 기본 활성값을 지정할 수 있습니다.
  * 사이드바 번역 메뉴 바로 상단에 깔끔한 독립 패널로 배치되어 작업 동선이 직관적입니다.
  * 소스코드 블록(\`\`\`...\`\`\`), 인라인 코드(\`...\`), LaTeX 수식(`$...$`), YAML 프론트매터, 글머리 기호 목록(`-`, `*`) 등 핵심 마크다운 구조는 100% 무손실 보존됩니다.
* **동아시아 언어 볼드 공백 자동 보정(East Asian Bold Spacing Normalizer)**
  * 한국어, 일본어, 중국어 환경에서 마크다운 볼드 구문 뒤에 조사가 바로 붙을 경우(`**중요한**것은`), 옵시디언 에디터의 렌더링 규칙에 따라 볼드 서식이 풀리거나 깨지는 현상을 방지하기 위해 표준적인 공백 규칙을 자동으로 정규화합니다.
* **유튜브/강의 스크립트 타임스탬프 클리너**
  * 영상 자막이나 강의 녹취록에서 빈번하게 발생하는 타임스탬프(`12:34`, `01:23:45`)를 즉시 제거하고, 줄 단위로 잘려진 파편화된 문장들을 하나의 완성도 높은 문단으로 매끄럽게 재구성합니다.

### 4. 사용자 맞춤 자유 지시 (Custom Natural Instructions)
* 사용자가 원하는 임의의 자연어 지시(예: *"핵심 개념을 옵시디언 콜아웃 블록으로 감싸줘"*, *"글 전체의 결론을 3줄 요약 불릿으로 하단에 추가해줘"*)를 입력창에 적어 손쉽게 적용할 수 있습니다.
* **단축키 안내 플레이스홀더 및 간결한 UI**: 텍스트 입력 영역에 `Ctrl + Enter (또는 Cmd + Enter) 키를 눌러 바로 시작할 수 있습니다.` 플레이스홀더를 제공하며, 버튼 레이블은 `작업 시작하기`로 깔끔하게 통일하였습니다.
* 상단 옵션(교열, 번역, 문체)과 유기적으로 결합하여 동시 실행이 가능합니다.

### 5. 대화형 Diff 검토 (Interactive Diff Review)
* **정밀 시퀀스 정렬 엔진 (Needleman-Wunsch Sequence Alignment)**: 원문과 번역문 간 단락 수 불일치 또는 일부 생략이 발생하더라도 상단 번역 블록이 아래로 왜곡·밀리는 현상을 원천 방지하고 1:1 완벽 정합을 유지합니다.
* **구조 앵커 매칭**: 프론트매터 1:1 고정, 헤딩 레벨(`##`, `###`) 엄격 일치, 공통 고유명사/코드/URL 토큰 유사도 기반 정확한 블록 대조.
* **깔끔한 텍스트 UI**: 대조 검토 모달창 내 모든 이모지/아이콘을 전면 제거하여 가독성과 전문성을 극대화한 순수 텍스트 레이블 UI.
* 사이드바 하단의 세션 이력 카드에서 과거 실행 결과를 언제든지 다시 열람할 수 있습니다.
* 과거 세션 결과를 다시 열 때는 **추가 LLM API 호출이나 토큰 소모가 전혀 발생하지 않으며(Zero-Token)**, 좌우 분할 스크롤(Synchronized Split View) 화면에서 원본과 수정본을 안전하게 비교 검토한 뒤 원하는 방식으로 문서에 적용할 수 있습니다.
* **데스크톱 편의성**: `Ctrl+Enter` / `Cmd+Enter` 글로벌 단축키 실행, 한글 IME 조합 중복 방지, 실수로 인한 모달 닫힘 방지(Shake 효과)가 적용되어 있습니다.

### 6. 직관적인 설정 환경 및 AI 프로바이더 관리 (Settings & Provider Management)
* **4대 서브탭 구조 (`AI 프로바이더`, `번역 설정`, `교열 & 서식`, `일반 & UI`)**
  * 단일 스크롤 방식의 복잡한 설정을 4개 목적별 독립 서브탭으로 분리하여 필요한 설정을 즉시 탐색하고 변경할 수 있습니다.
* **원클릭 프로바이더 프리셋 자동완성 (Provider Presets)**
  * 신규 프로바이더 등록 시 **Ollama, LM Studio, OpenAI, Google Gemini, OpenRouter, DeepSeek, Groq** 프리셋을 선택하면 Base URL, 표시 이름, 추천 모델 목록이 자동으로 완성됩니다.
* **프로바이더 상태 뱃지 및 실시간 헬스체크 (Status Badges & Health Check)**
  * 각 프로바이더 아코디언 카드 헤더에 `⚪ 미확인`, `🟢 정상 (OOms)`, `🔴 연결 실패` 뱃지와 등록된 모델 개수가 표시됩니다.
  * 아코디언 내부의 **[연결 테스트]** 버튼 클릭 시 해당 카드의 상태 뱃지가 실시간으로 즉시 갱신됩니다.
* **옵시디언 1.13+ 선언형 설정 검색 지원 (`getSettingDefinitions`)**
  * 옵시디언 1.13 이상 버전의 전역 설정 검색창에서 탭 이동 없이 `AI Provider`, `OpenAI`, `Ollama`, `번역`, `교열`, `맞춤법`, `볼드 제거` 등 20개 이상의 키워드 및 다국어 별칭으로 원하는 설정을 바로 검색할 수 있습니다.
* **전역 AI 프로바이더 풀 & 기기별 독립 바인딩 (Multi-Device Binding)**
  * 여러 AI 엔드포인트를 전역 프로바이더 풀(`providers`)에 등록하고 관리할 수 있습니다.
  * **`[📍 이 기기에 적용]`** 버튼을 통해 현재 기기 식별자(`hostname`)에 특정 프로바이더를 독립 바인딩하여, OneDrive나 옵시디언 동기화 환경에서도 기기 간 설정 덮어쓰기 없이 독립적으로 동작합니다.
* **포트 및 후보 키 자동 진단(Auto-Probe)과 자가 치유(Self-Healing)**
  * 로컬 엔드포인트 연결 오류(Connection Refused) 또는 인증 실패(401) 감지 시, 등록된 후보 키와 포트를 자동으로 진단(Auto-Probe)하여 유효한 연결을 찾아내고 현재 기기 설정을 자가 치유(Self-Healing)합니다.
* **LLM 생각 과정(Reasoning/CoT) 및 초안 독백 누출 차단**
  * DeepSeek R1 등 추론형 LLM의 `<think>...</think>` 태그 블록을 제거하고, 영문 독백 및 초안 루프를 필터링합니다. OpenRouter 호출 시 reasoning 파라미터를 억제합니다.

### 7. 실시간 작업 제어 및 스마트 데스크톱 UX (Real-Time Control & Smart UX)
* **반응형 너비 감지 적응형 버튼 (Responsive Adaptive Segmented Buttons)**
  * 옵시디언 사이드바의 너비가 좁아질 때(<320px) 텍스트를 숨기고 아이콘 모드로 자동 전환되며, 중간 너비(<380px)에서는 핵심 라벨만 간결하게 표시하여 좁은 패널에서도 조작성을 유지합니다.
* **사이드바 원클릭 새로고침 (Work State Refresh & UI Cleansing)**
  * 사이드바 헤더 상단의 **새로고침(`refresh-cw`) 버튼**으로 진행 중인 비동기 요청을 중단하고 UI 상태와 코어 서비스를 초기화할 수 있습니다.
* **실시간 즉시 작업 취소 (Immediate Task Cancel with AbortController)**
  * 작업 진행 중 **`[❌ 작업 취소]`** 버튼을 누르면 HTTP 통신을 즉시 중단하고 미완성 임시 파일을 휴지통으로 정리합니다.
* **방해 없는 클린 대상 문서 표시줄**
  * 활성 노트의 전체 제목을 표시하며, 문단 선택 시 `선택 영역 (N자)` 배지를 연동 표시합니다.
* **세션 히스토리 카드 타이포그래피 계층 정합성**
  * 세션 히스토리 카드와 빈 상태 알림 문구의 폰트 크기를 통일하여 정합성을 유지합니다.
* **실시간 타임라인 및 청크 진행 상태 안내**
  * 분할 번역 진행 중 `[1/4]`, `[2/4]` 형태로 순차 진행 상황을 표시하며, 완료 카드에 처리 시간과 속도를 기록합니다.

---

## ⚙️ 설치 및 환경 설정 

### 플러그인 설치 방법

#### 1. 옵시디언 커뮤니티 플러그인을 통한 설치 (공식 출시 · 권장)
1. 옵시디언 실행 후 좌측 하단 **설정(Settings ⚙️) > 커뮤니티 플러그인(Community plugins)** 으로 이동합니다.
2. '제한 모드(Restricted mode)'가 켜져 있다면 해제(Turn off)합니다.
3. 커뮤니티 플러그인 목록의 **탐색(Browse)** 버튼을 클릭합니다.
4. 검색창에 **`Assistant Emily`** 를 검색합니다.
5. 검색 결과에서 **Assistant Emily** 를 선택하고 **[설치(Install)]** 를 누른 후 **[활성화(Enable)]** 버튼을 클릭합니다.
6. 사이드바 리본의 ✨ 아이콘 또는 명령어 팔레트(`Ctrl+P` / `Cmd+P`)에서 **Assistant Emily: Open Sidebar** 를 실행하여 즉시 사용할 수 있습니다.

#### 2. 깃허브 릴리즈 수동 설치 (오프라인/직접 설치)
1. [GitHub Releases](https://github.com/sparklings/emily/releases)에서 최신 버전의 **`main.js`**, **`manifest.json`**, **`styles.css`** 3개 파일을 다운로드합니다.
2. 옵시디언 보관함(Vault) 폴더로 이동하여 아래 경로를 생성하고 파일을 배치합니다:
   ```
   <내 옵시디언 보관함>/
   └── .obsidian/
       └── plugins/
           └── assistant-emily/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```
3. 옵시디언의 **설정(Settings) > 커뮤니티 플러그인(Community plugins)** 에서 설치된 플러그인 목록을 새로고침하고, **Assistant Emily** 토글을 켭니다.

---

### 환경 설정 가이드 (4대 서브탭 안내)

옵시디언 **설정 > Assistant Emily** 탭에서 4개 서브탭을 통해 플러그인을 설정할 수 있습니다:

#### 1. [🤖 AI 프로바이더]
* **프로바이더 등록**: **`[+ Add provider]`** 버튼을 누르고 프리셋(OpenAI, Ollama, LM Studio 등)을 선택하여 엔드포인트 URL, API 키, 모델 목록을 추가합니다.
* **기기 바인딩**: 등록된 카드에서 **`[📍 이 기기에 적용]`** 버튼을 눌러 현재 PC에서 사용할 프로바이더를 선택합니다.
* **상태 확인**: 아코디언을 펼쳐 **[연결 테스트]**를 실행하면 실시간 응답 속도와 상태 뱃지(`🟢 정상` / `🔴 연결 실패`)가 갱신됩니다.

#### 2. [🌐 번역 설정]
* 번역 기능 기본 활성화 여부, 기본 출발어/도착어를 지정합니다.
* 기본 번역 범위(선택 영역, 전체 문서, 단락별 1:1 대조) 및 원문 보존 방식(새 파일 생성, 덧붙이기, 덮어쓰기)을 설정합니다.
* 기본 문체(학술체, 경어체, 친근체) 및 스타일(균형, 직역, 의역), 소스코드 주석 번역 여부를 구성합니다.

#### 3. [✏️ 교열 & 서식]
* 사이드바 실행 시 기본 활성화할 교열 항목(맞춤법 검사, 문법 검사, 타임스탬프 삭제)을 지정합니다.
* 마크다운 서식 제거 기본값(볼드, 기울임, 취소선, 하이라이트)을 선택합니다.

#### 4. [⚙️ 일반 & UI]
* 플러그인 표시 언어(자동 감지, 한국어, English)를 변경합니다.
* 한글 볼드 뒤 조사 공백 자동 보정 여부 및 플로팅 상/하단 스크롤 버튼 표시 여부를 설정합니다.

---

## 🔒 보안, 프라이버시 및 규정 준수 고지

옵시디언 커뮤니티 플러그인 공식 등록 가이드라인(Community Plugin Review Guidelines) 및 사용자 정보 보호 원칙에 따른 고지 사항입니다.

### 외부 네트워크 통신 고지
* **통신 목적**: Assistant Emily는 사용자가 명시적으로 요청한 교열, 번역, 맞춤 지시 작업을 수행하기 위해서만 외부 네트워크 통신을 진행합니다.
* **통신 대상 엔드포인트**: 오직 사용자가 플러그인 환경설정(`API Base URL`)에서 직접 지정한 엔드포인트(예: OpenAI 공식 API, `FreeLLMAPI`, 사용자 정의 프록시, 또는 `http://localhost:11434` 로컬 Ollama/LM Studio 서버)와만 통신합니다.
* **전송 데이터 범위**: 교열 및 번역 작업 실행 시 사용자가 활성화한 현재 노트의 본문(또는 선택 영역) 텍스트 및 프롬프트 명령문만 전송됩니다. 사용자의 다른 Vault 파일, 시스템 환경 정보, 브라우징 기록 등은 일체 수집하거나 전송하지 않습니다.
* **제3자 중계 서버 부재**: 플러그인은 옵시디언 표준 `requestUrl` API를 통해 지정된 엔드포인트와 직접 통신하며, 개발자 개인 서버나 비공개 중계 서버, 원격 분석 서버 등으로 데이터를 우회 전송하지 않습니다.

### 볼트 파일 접근 및 권한 
* **접근 범위 제한**: 플러그인은 사용자가 현재 에디터에서 열어두고 작업을 요청한 활성 볼트(Vault) 내의 마크다운 파일(`TFile`)에 대해서만 읽기 및 쓰기 작업을 수행합니다.
* **볼트 외부 파일시스템 접근 배제**: 사용자의 Vault 외부에 위치한 운영체제 파일 시스템이나 개인 디렉터리에 일체 접근하거나 탐색하지 않습니다.
* **문서 원형 보존 및 사용자 승인**: 모든 문서 수정은 대화형 Diff 검토 창을 거쳐 사용자가 명시적으로 승인(Apply)한 경우에만 옵시디언 표준 Vault API(`vault.modify`)를 통해 안전하게 반영됩니다.

### 계정 및 요금 정책
* 본 플러그인은 100% 무료 오픈소스(MIT) 소프트웨어이며, 플러그인 자체 사용을 위한 별도의 회원가입이나 전용 계정 로그인을 일체 요구하지 않습니다.
* AI 서비스 이용에 소요되는 토큰 비용은 사용자가 선택한 서비스 제공자(OpenAI, OpenRouter 등)의 정책에 따르며, 본 플러그인과는 무관합니다. 

### 원격 분석 및 광고 배제
* Google Analytics, Mixpanel, Sentry 등 어떠한 사용자 행동 추적 코드나 원격 분석 텔레메트리 모듈도 포함되어 있지 않습니다.
* 플러그인 UI 및 사이드바 내부에 스폰서 링크, 배너 광고, 후원 유도 팝업 등을 일체 표시하지 않습니다.

---

## 💖 오픈소스 프로젝트 크레딧 및 감사의 글

Assistant Emily는 전 세계 오픈소스 커뮤니티의 뛰어난 소프트웨어와 개발자분들의 헌신적인 기여가 있었기에 탄생할 수 있었습니다. 본 프로젝트에 직·간접적으로 힘이 되어준 소중한 프로젝트들에 진심으로 감사의 마음을 전합니다.

### 1. Obsidian
독보적인 지식 관리 및 제2의 뇌(Second Brain) 생태계를 구축해 온 **Obsidian 개발팀** 에 무한한 감사를 표합니다.
* **GitHub Repository**: [obsidianmd/obsidian-api](https://github.com/obsidianmd/obsidian-api) (공식 사이트: [obsidian.md](https://obsidian.md))
* 웹 표준 기술과 강력한 플러그인 아키텍처(`WorkspaceLeaf`, `MarkdownView`, `requestUrl`, 세밀한 디자인 토큰 변수 등) 덕분에 데스크톱 환경에서 완벽히 통합되는 네이티브 수준의 AI 페어 어시스턴트를 구축할 수 있었습니다.

### 2. FreeLLMAPI & 오픈 모델 생태계
누구나 자유롭고 부담 없이 인공지능의 혜택을 누릴 수 있도록 길을 열어준 **FreeLLMAPI** 및 OpenAI 호환 오픈 API 생태계의 모든 기여자분들께 깊이 감사드립니다.
* **GitHub Repository**: [tashfeenahmed/freellmapi](https://github.com/tashfeenahmed/freellmapi)
* 복잡하고 폐쇄적인 독점 API 의존성을 벗어나, 표준화된 인터페이스를 통해 다양한 로컬 모델과 프록시 백엔드를 유연하게 연동할 수 있는 튼튼한 토대가 되었습니다.

### 3. Pi Agent Architecture & Research 
Assistant Emily의 코드베이스는 외부 대형 에이전트 라이브러리 대신, 옵시디언 샌드박스 환경에 최적화된 **독립형 맞춤 클라이언트(`LLMProxyClient`)와 전용 파이프라인 엔진** 으로 직접 구현되었습니다.
* **GitHub Repository**: [earendil-works/pi](https://github.com/earendil-works/pi)
* 외부 SDK를 직접 번들링하는 대신 가볍고 날렵한 커스텀 엔진을 채택하였으나, 지능형 에이전트의 상태 관리, 컨텍스트 주입, 프롬프트 엔지니어링 및 도구 연계 워크플로우를 설계하는 과정에서 **Pi Agent (pi agent sdk)** 프로젝트가 제시한 선구적인 에이전트 아키텍처와 아이디어로부터 커다란 영감과 기술적 통찰을 얻었습니다. 오픈 에이전트 생태계를 개척해 나가는 Pi Agent 연구 및 개발진에 깊은 존경과 감사를 드립니다.

### 4. 오픈소스 도구 및 생태계
* **[TypeScript](https://www.typescriptlang.org/)** ([GitHub: microsoft/TypeScript](https://github.com/microsoft/TypeScript)): 복잡한 비동기 문서 처리 및 마크다운 AST 파이프라인을 견고하고 결함 없이 유지할 수 있게 해 준 최고의 개발 언어입니다.
* **[esbuild](https://esbuild.github.io/)** ([GitHub: evanw/esbuild](https://github.com/evanw/esbuild)): 초고속 번들링과 트리 셰이킹을 통해 최적화된 배포 번들을 순식간에 빌드해 준 고성능 빌더입니다.
* **[builtin-modules](https://github.com/sindresorhus/builtin-modules)** ([GitHub: sindresorhus/builtin-modules](https://github.com/sindresorhus/builtin-modules)): Node.js 런타임 의존성을 옵시디언 데스크톱 환경과 안전하게 조화시킬 수 있도록 기여해 주었습니다.

---

## 🌿 개발 및 배포 브랜치 전략 (Branching & Release Workflow)

Assistant Emily 프로젝트는 옵시디언 커뮤니티 플러그인 심사 규정 준수 및 안정적인 릴리즈를 위해 체계적인 2단계 브랜치 전략을 운용합니다:
* **`develop` 브랜치**:
  * 신규 기능 구현, UI 개선 및 설정 화면 개편(개선안 A~D) 작업이 진행되는 개발 전용 브랜치입니다.
  * 커뮤니티 플러그인 심사 과정의 사전 프리뷰(Review Branch) 검토 및 린트/테스트 검증을 통과하는 기준점이 됩니다.
* **`master` 브랜치**:
  * `develop` 브랜치에서 프리뷰 심사 및 전체 테스트(58개 TC) 통과가 확인된 후 버전 업그레이드와 함께 최종 병합되는 공식 배포 브랜치입니다.
  * 공식 GitHub Release 및 버전 태그(`v1.0.x`) 발행의 기반이 됩니다.

---

## 📄 라이선스 

Assistant Emily는 **[MIT License](LICENSE)** 에 따라 자유롭게 사용, 수정, 배포할 수 있는 오픈소스 소프트웨어입니다.
사용자 여러분의 피드백과 이슈 제보, Pull Request 기여를 언제나 환영합니다!



---


# Assistant Emily

<p align="center">
  <strong>Intelligent Markdown Proofreading & Translation Specialized AI Pair-Assistant for Obsidian</strong><br>
  Lossless Markdown Proofreading · Context-Aware Professional Translation AI Pair-Assistant Plugin
</p>

<p align="center">
  <a href="https://sparklings.github.io/emily/"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-brightgreen.svg?style=flat-square" alt="Documentation"></a>
  <a href="https://github.com/sparklings/emily/releases"><img src="https://img.shields.io/badge/version-1.0.20-blue.svg?style=flat-square" alt="Version"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-v1.7.2+-purple.svg?style=flat-square" alt="Obsidian"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="#-system-architecture"><img src="https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg?style=flat-square" alt="TypeScript"></a>
  <a href="#-security-privacy--disclosures"><img src="https://img.shields.io/badge/Privacy-100%25%20Local%2FDirect-success.svg?style=flat-square" alt="Privacy"></a>
  <a href="#-overview"><img src="https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg?style=flat-square" alt="Desktop Only"></a>
</p>

<p align="center">
  <a href="#assistant-emily"><b>🇺🇸 English</b></a> | <a href="#어시스턴트-에밀리"><b>🇰🇷 한국어</b></a> | <a href="https://sparklings.github.io/emily/"><b>🌐 Website</b></a>
</p>

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Official Documentation](#-official-documentation)
3. [Detailed Features](#-detailed-features)
   - [1. Lossless Intelligent Markdown Proofreading](#1-lossless-intelligent-markdown-proofreading)
   - [2. Context-Aware Professional Translation](#2-context-aware-professional-translation)
   - [3. Markdown Typography & Selective Format Stripper](#3-markdown-typography--selective-format-stripper)
   - [4. Custom Natural Instructions](#4-custom-natural-instructions)
   - [5. Interactive Diff Review](#5-interactive-diff-review)
   - [6. Settings & AI Provider Management](#6-settings--ai-provider-management)
   - [7. Real-Time Task Cancellation & Desktop UX](#7-real-time-task-cancellation--desktop-ux)
4. [Installation & Setup](#-installation--setup)
   - [Plugin Installation Methods](#plugin-installation-methods)
   - [Configuration Guide (4 Subtabs)](#configuration-guide-4-subtabs)
5. [Security, Privacy & Disclosures](#-security-privacy--disclosures)
   - [External Network Communication Notice (Network Usage)](#external-network-communication-notice)
   - [Vault File Access & Permissions (Vault File Access)](#vault-file-access--permissions)
   - [Account & Monetization Policy (Account & Monetization)](#account--monetization-policy)
   - [Zero Telemetry & Ad-Free Policy (Telemetry & Advertisements)](#zero-telemetry--ad-free-policy)
6. [Acknowledgements & Open Source Credits](#-acknowledgements--open-source-credits)
7. [Branching & Release Workflow](#-branching--release-workflow)
8. [License](#-license)

---

## 🌟 Overview

**Assistant Emily** is a **desktop-only intelligent AI pair-assistant plugin** designed for Obsidian users engaged in academic research, technical documentation, knowledge management, and translation.

Conventional AI tools often corrupt or strip critical Markdown elements—such as YAML frontmatter, Obsidian internal links (`[[Note Name]]`), tags (`#tag`), LaTeX formulas (`$...$`), and callout blocks (`> [!note]`)—when modifying documents. Assistant Emily completely resolves this challenge through its proprietary **Syntax Masking Pipeline**.

### Core Values
* **100% Lossless Preservation**: Safely shields the document's original metadata and unique Obsidian syntax from corruption.
* **Optimized for Academic & Technical Writing**: Features smart chunking for large documents, 1:1 paragraph bilingual alignment, and selective translation for code block comments.
* **Local AI & Privacy First**: Universally supports OpenAI-compatible endpoints—ranging from official OpenAI API and `FreeLLMAPI` to local Ollama, LM Studio, vLLM, and OpenRouter.

---

## 🌐 Official Documentation

Comprehensive user guides, interactive UI mockups, and the latest installation walkthroughs are available on the **[Assistant Emily Official Website](https://sparklings.github.io/emily/)**.

---

## 🚀 Detailed Features

### 1. Lossless Intelligent Markdown Proofreading
* **Context-Aware Spelling and Grammar Correction**: Transcends rigid rule-based checkers by leveraging LLM contextual comprehension to fix spelling, spacing, awkward particles, and subject-predicate agreement.
* **Clean 3-Tool Segmented Grid**: Independently select and combine `Spelling Check`, `Grammar Check`, and `Remove Timestamps` directly from the sidebar segmented button grid.
* **Selection-Scoped Proofreading**: When translation mode is OFF, selecting any text paragraph scopes proofreading strictly to the highlighted selection (falling back to the full document if nothing is selected). A live purple accent badge (`Selection (N chars)`) dynamically appears in the sidebar target document bar. Accepting diff corrections performs atomic string replacement (`replaceRange`), completely preserving the rest of the document.
* **Strict Multilingual Response Guardrails & Zero Synthetic Noise**: The proofreading explanation language strictly honors the user interface setting (English vs. Korean), and synthetic dummy cards are eliminated to ensure 100% genuine, actionable feedback.
* **Syntax Masking Protection**: Obsidian wikilinks (`[[Note]]`, `[[Note|Alias]]`), tags (`#tag`), callout headers (`> [!tip]`), inline and block LaTeX equations (`$...$`, `$$...$$`), and code blocks are securely converted into UUID placeholder tokens before LLM processing, guaranteeing zero corruption to original formatting.
* **Interactive Diff Modal**:
  * Displays all detected corrections categorized by type (`[Spelling Check]`, `[Grammar Check]`, `[Remove Timestamps]`).
  * Allows selective toggling of individual edits via checkboxes.
  * Clicking an issue scrolls directly to its corresponding position in the editor for instant context verification.

### 2. Context-Aware Professional Translation & Tone Rewriting
* **3 Intuitive Translation Scopes**:
  * **Selection Only**: Rapidly translates and refines only highlighted text blocks.
  * **Full Document**: Translates the complete note while strictly preserving heading hierarchies (H1–H6).
  * **Paragraph Bilingual**: Places the translated paragraph immediately below the source paragraph in a 1:1 alignment, ideal for academic papers and international news reviews.
* **Unified Tone & Style Rewriting Engine**:
  * Seamlessly standardizes document register and sentence-ending styles for both multilingual translation and **same-language rewriting** (e.g. English ➔ English polishing or Korean ➔ Korean register alignment).
  * **Tone**: `Academic / Plain (~이다/한다)`, `Formal & Polite (~합니다/하십시오)`, `Casual & Conversational (~해요/있어요)`
  * **Style**: `Literal`, `Balanced Refinement`, `Free Natural`
  * **Strict Exception Preservation Guardrails**: Quotations (`> ...`, `"..."`), code blocks (\`\`\`...\`\`\`), inline code (\`...\`), LaTeX math (`$...$`), YAML frontmatter, and heading titles are strictly excluded from tone alteration, keeping original code and quotes intact.
* **Code Block Comments Only Translation Switch**:
  * Safely translates comments (`//`, `#`, `/* ... */`) while maintaining 100% integrity of code syntax, variable names, and function identifiers across programming languages (`python`, `typescript`, `cpp`, etc.).
* **Safe Smart Chunking & Integrity Protection (2,500 Characters Optimized)**:
  * For long documents exceeding single-turn LLM response token limits (4,096 tokens), the engine intelligently splits text along H1–H3 headers and paragraph boundaries at an optimized 2,500-character threshold, translating sequentially and reconstructing the document seamlessly without token clipping or omissions.
  * Completely prevents the generation of blank or incomplete chunks, ensuring robust 1:1 bilingual contrast alignment.
  * Equipped with an integrity safety guard that detects missing target language text or unclosed reasoning monologues, preventing corrupt files from polluting your vault.

### 3. Markdown Typography & Selective Format Stripper
* **Selective Markdown Format Stripping**:
  * Effortlessly strip bold (`**`), italic (`*`), strikethrough (`~~`), and highlight (`==`) syntax from imported articles or translations using clean checkboxes.
  * Select any combination or all 4 formatting types, and customize the default selection under `Settings > Assistant Emily`.
  * Ergonomically positioned directly above the translation controls in the sidebar.
  * Code blocks (\`\`\`...\`\`\`), inline code (\`...\`), LaTeX formulas (`$...$`), YAML frontmatter, and bullet lists (`-`, `*`) remain 100% byte-level untouched and preserved.
* **East Asian Bold Spacing Normalizer**:
  * In Korean, Japanese, and Chinese texts, when grammatical particles immediately follow bold markup (e.g., `**word**particle`), Obsidian's renderer may fail to render bold formatting correctly. The normalizer automatically standardizes whitespace to ensure pristine visual rendering.
* **YouTube / Lecture Script Timestamp Stripper**:
  * Strips recurring video timestamps (`12:34`, `01:23:45`) and reflows fragmented lines into fluent, readable prose paragraphs.

### 4. Custom Natural Instructions
* Execute arbitrary natural language commands directly in the prompt input field (e.g., *"Wrap key concepts in Obsidian callout blocks"*, *"Add a 3-bullet summary conclusion at the bottom"*).
* **Shortcut Guidance & Clean UI**: Features an intuitive textarea placeholder (`Press Ctrl + Enter (or Cmd + Enter) to start`) for quick invocation, alongside a simplified and clean action button.
* Seamlessly combines with proofreading, translation, and tone styles for unified one-shot execution.

### 5. Interactive Diff Review
* **Needleman-Wunsch Sequence Alignment Engine**: Prevents vertical block distortion and stretching when source and translated paragraph counts differ or when partial omissions occur, preserving 1:1 row alignment between matching sections.
* **Structural Anchor & Token Matching**: Strict heading level matching (`##` with `##`, `###` with `###`), YAML frontmatter anchor lock, and token overlap scoring for code/URLs/proper nouns (`GitHub`, `Discord`, `General`, `Obsidian`).
* **Clean Text-Only UI**: Replaced all emoji icons in the comparison modal with clean, professional text labels across headers, mode toggle buttons, and saving action buttons.
* Re-inspect previous execution outputs at any time via the session history cards located at the bottom of the sidebar.
* **Zero-Token Re-review**: Reopening prior results consumes **zero additional LLM API calls or tokens**, letting you safely compare original and modified documents in a synchronized split-scroll view before applying changes.
* **Desktop Productivity**: Features `Ctrl+Enter` / `Cmd+Enter` global shortcuts, IME composition protection for Korean/CJK input, and modal shake effects to prevent accidental dismissal.

### 6. Settings & AI Provider Management
* **4-Subtab Layout (`AI Providers`, `Translation`, `Proofreading & Formatting`, `General & UI`)**
  * Divides complex settings into 4 dedicated, focused subtabs, minimizing scroll length and maximizing accessibility.
* **One-Click Provider Presets**
  * Auto-fills Base URL, provider display name, and recommended model lists with presets for **Ollama, LM Studio, OpenAI, Google Gemini, OpenRouter, DeepSeek, and Groq**.
* **Status Badges & Live Health Check**
  * Provider card headers feature live status indicators (`⚪ Untested`, `🟢 Online (OOms)`, `🔴 Offline`) alongside model count tags.
  * Clicking the **[Connectivity Test]** button inside the accordion immediately updates the header status badge in real time.
* **Declarative Obsidian 1.13+ Settings Search (`getSettingDefinitions`)**
  * Registers over 20 setting definitions and multilingual aliases (`AI Provider`, `OpenAI`, `Ollama`, `Translation`, `Proofreading`, `Strip Bold`, etc.) for seamless integration with Obsidian's global settings search bar.
* **Global AI Provider Pool & Isolated Device Binding**
  * Register unlimited endpoints and bind specific providers to your active machine via **`[📍 Apply to this Device]`**, completely preventing OneDrive or Obsidian Sync collisions across devices.
* **Port & Key Auto-Probe with Self-Healing**
  * Automatically detects candidate ports and API keys upon connection refused or 401 unauthorized errors, self-healing the current machine binding.
* **LLM Reasoning (CoT) & Draft Monologue Filter**
  * Strips internal `<think>...</think>` traces and draft monologues from reasoning models, applying `reasoning: { effort: 'none', exclude: true }` parameters for OpenRouter.

### 7. Real-Time Task Cancellation & Desktop UX
* **Responsive Adaptive Segmented Buttons**
  * Automatically collapses labels into intuitive Lucide icons when sidebar width is narrow (<320px).
* **One-Click Sidebar Refresh (`refresh-cw`)**
  * Aborts pending requests and cleanly resets work states and core services.
* **Instant Task Cancellation (`AbortController`)**
  * Halts asynchronous requests and cleans partial temporary files to Obsidian trash.
* **Clean Document Header Bar & Typography Hierarchy**
  * Displays note titles cleanly and ensures uniform font sizing across session history cards.
* **Live Chunk Progress Reporting**
  * Sequentially displays chunk progress (e.g., `[1/4]`, `[2/4]`) during long-form document translations.

---

## ⚙️ Installation & Setup

### Plugin Installation Methods

#### 1. Installation via Obsidian Community Plugins (Official Release · Recommended)
1. Open Obsidian and navigate to **Settings (⚙️) > Community plugins**.
2. Turn off 'Restricted mode' if enabled.
3. Click the **Browse** button under Community plugins.
4. Search for **`Assistant Emily`** in the search bar.
5. Select **Assistant Emily**, click **Install**, and then click **Enable**.
6. Click the ✨ ribbon icon on the left sidebar or use the command palette (`Ctrl+P` / `Cmd+P`) to run **Assistant Emily: Open Sidebar** to begin immediately.

#### 2. Manual Installation via GitHub Releases (Offline / Manual)
1. Download the latest **`main.js`**, **`manifest.json`**, and **`styles.css`** files from [GitHub Releases](https://github.com/sparklings/emily/releases).
2. Open your Obsidian Vault directory and create the following plugin folder path:
   ```
   <Your-Obsidian-Vault>/
   └── .obsidian/
       └── plugins/
           └── assistant-emily/
               ├── main.js
               ├── manifest.json
               └── styles.css
   ```
3. In Obsidian, navigate to **Settings > Community plugins**, click **Reload installed plugins**, and enable the **Assistant Emily** toggle.

---

### Configuration Guide (4 Subtabs)

Navigate to Obsidian **Settings > Assistant Emily** to configure preferences across 4 focused subtabs:

#### 1. [🤖 AI Providers]
* **Add Provider**: Click **`[+ Add provider]`** and pick a preset (OpenAI, Ollama, LM Studio, etc.) to configure the Base URL, API key, and chat models.
* **Device Binding**: Click **`[📍 Apply to this Device]`** on any card to bind it to your active computer.
* **Connectivity Test**: Expand the accordion and run tests to inspect response latency and status badges (`🟢 Online` / `🔴 Offline`).

#### 2. [🌐 Translation]
* Configure default translation state, source and target languages.
* Select default scope (Selection, Full Document, Paragraph Bilingual) and preservation strategy (New File, Append, Overwrite).
* Choose default tone, style, and code block comments translation toggle.

#### 3. [✏️ Proofreading & Formatting]
* Configure default proofreading modules (Spelling Check, Grammar Check, Remove Timestamps).
* Set default markdown format stripping options (Bold, Italic, Strikethrough, Highlight).

#### 4. [⚙️ General & UI]
* Select display language (Auto-detect, Korean, English).
* Toggle East Asian bold spacing normalization and floating scroll buttons.

---

## 🔒 Security, Privacy & Disclosures

Compliant with Obsidian's Community Plugin Review Guidelines and user privacy principles.

### External Network Communication Notice
* **Purpose of Communication**: Assistant Emily initiates network requests exclusively to execute user-requested proofreading, translation, and custom instruction tasks.
* **Target Endpoints**: Communicates solely with the endpoint explicitly designated by the user in plugin settings (`API Base URL`)—such as official OpenAI API, `FreeLLMAPI`, custom proxies, or local servers (`http://localhost:11434` for Ollama/LM Studio).
* **Scope of Transmitted Data**: Only the active note text (or selected text) and prompt instructions are transmitted during execution. No other vault files, environment variables, system configurations, or browsing histories are ever accessed or transmitted.
* **No Intermediary Relay Servers**: The plugin communicates directly with the designated endpoint via Obsidian's native `requestUrl` API, without routing through developer personal servers, telemetry endpoints, or private proxies.

### Vault File Access & Permissions
* **Scoped Access**: File read and write operations are strictly limited to the active Markdown file (`TFile`) explicitly opened and requested by the user.
* **No Access Outside Vault**: Completely restricted from scanning or accessing filesystem paths or directories outside the Obsidian Vault.
* **Preservation & Explicit Approval**: All document modifications require explicit user confirmation (via the interactive Diff review modal) before changes are written through Obsidian's native `vault.modify` API.

### Account & Monetization Policy
* **100% Free & No Registration**: Assistant Emily is 100% free open-source software (MIT). It requires no proprietary account creation, sign-up, or login.
* **Decoupled API Costs**: AI token usage fees depend entirely on the provider chosen by the user (OpenAI, OpenRouter, etc.). When using local AI (Ollama, LM Studio) or free proxies (`FreeLLMAPI`), operation is completely free with zero financial cost.

### Zero Telemetry & Ad-Free Policy
* **Zero Telemetry**: Contains zero tracking scripts, diagnostic analytics, or telemetry modules (no Google Analytics, Mixpanel, Sentry, etc.).
* **Ad-Free Experience**: The plugin interface and sidebar contain no advertisements, sponsored banners, or donation popups.

---

## 💖 Acknowledgements & Open Source Credits

Assistant Emily was made possible thanks to the outstanding software and generous contributions of the global open-source community. We express our deepest gratitude to the following projects:

### 1. Obsidian
Our sincere gratitude goes to the **Obsidian Team** for building and fostering an exceptional second-brain and knowledge management ecosystem.
* **GitHub Repository**: [obsidianmd/obsidian-api](https://github.com/obsidianmd/obsidian-api) (Official Website: [obsidian.md](https://obsidian.md))
* Built on modern web technologies and Obsidian's powerful plugin architecture (`WorkspaceLeaf`, `MarkdownView`, `requestUrl`, granular theme design tokens), making it possible to create a deeply integrated, native desktop AI pair-assistant.

### 2. FreeLLMAPI & Open Model Ecosystem
Our profound thanks to **FreeLLMAPI** and the entire OpenAI-compatible open API ecosystem for democratizing access to cutting-edge AI.
* **GitHub Repository**: [tashfeenahmed/freellmapi](https://github.com/tashfeenahmed/freellmapi)
* It provided a flexible foundation to move beyond proprietary vendor locks and seamlessly interface with various local models and proxy backends through a unified standard.

### 3. Pi Agent Architecture & Research
Assistant Emily's codebase is implemented directly with an **independent custom client (`LLMProxyClient`) and specialized pipeline engines** optimized for Obsidian's sandbox environment, rather than relying on heavy external agent frameworks.
* **GitHub Repository**: [earendil-works/pi](https://github.com/earendil-works/pi)
* While choosing a lightweight and agile custom engine over bundling bulky external SDKs, we gained tremendous inspiration and technical insight into agent state management, context injection, prompt engineering, and tool orchestration workflows from the pioneering ideas of the **Pi Agent (pi agent sdk)** project. We extend our deepest respect and gratitude to the Pi Agent researchers and engineering team pioneering the open agent ecosystem.

### 4. Open Source Tools & Ecosystem
* **[TypeScript](https://www.typescriptlang.org/)** ([GitHub: microsoft/TypeScript](https://github.com/microsoft/TypeScript)): The premier language that keeps complex asynchronous document processing and Markdown AST pipelines robust, strictly typed, and reliable.
* **[esbuild](https://esbuild.github.io/)** ([GitHub: evanw/esbuild](https://github.com/evanw/esbuild)): High-performance builder delivering instantaneous builds, fast bundling, and efficient tree-shaking for release distributions.
* **[builtin-modules](https://github.com/sindresorhus/builtin-modules)** ([GitHub: sindresorhus/builtin-modules](https://github.com/sindresorhus/builtin-modules)): Contributed to cleanly harmonizing Node.js runtime dependencies within Obsidian's desktop Electron environment.

---

## 🌿 Branching & Release Workflow

Assistant Emily follows a two-tier branch workflow to maintain plugin review compliance and safe releases:
* **`develop` Branch**:
  * Dedicated to active feature development, UI refactoring, and settings restructuring (Improvements A–D).
  * Serves as the Review Branch for Obsidian Community Plugin validation and comprehensive automated testing.
* **`master` Branch**:
  * Stable production release branch. Merged from `develop` upon passing review validation and all 58 test cases.
  * Serves as the source of truth for official GitHub Release tags (`v1.0.x`).

---

## 📄 License

Assistant Emily is open-source software released under the **[MIT License](LICENSE)**.
Feedback, issue reports, and pull request contributions are always welcome!
