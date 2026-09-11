# 어시스턴트 에밀리


<p align="center">
  옵시디언 마크다운 지능형 무손실 교열 · 맥락 인식 전문 번역 AI 페어 어시스턴트 플러그인
</p>

<p align="center">
  <a href="https://github.com/sparklings/emily/wiki"><img src="https://img.shields.io/badge/docs-GitHub%20Wiki-brightgreen.svg?style=flat-square" alt="Documentation Wiki"></a>
  <a href="https://github.com/sparklings/emily/releases"><img src="https://img.shields.io/badge/version-1.0.13-blue.svg?style=flat-square" alt="Version"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-v1.7.2+-purple.svg?style=flat-square" alt="Obsidian"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="#-시스템-아키텍처-및-구조-system-architecture"><img src="https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg?style=flat-square" alt="TypeScript"></a>
  <a href="#-보안-프라이버시-및-규정-준수-고지-security-privacy--disclosures"><img src="https://img.shields.io/badge/Privacy-100%25%20Local%2FDirect-success.svg?style=flat-square" alt="Privacy"></a>
  <a href="#-개요-overview"><img src="https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg?style=flat-square" alt="Desktop Only"></a>
</p>

<p align="center">
  <a href="#assistant-emily"><b>🇺🇸 English</b></a> | <a href="#어시스턴트-에밀리"><b>🇰🇷 한국어</b></a> | <a href="https://github.com/sparklings/emily/wiki"><b>📚 Official Wiki</b></a>
</p>

> [!TIP]
> 📚 **공식 GitHub Wiki 오픈**: 설치 방법, 상세 기능 시나리오, 로컬 AI(Ollama, LM Studio 등) 연동 레시피, 다중 기기 프로필 관리 및 문제 해결 팁은 **[Assistant Emily 공식 Wiki](https://github.com/sparklings/emily/wiki)**에서 확인하실 수 있습니다!

---

## 📖 목차

1. [개요 (Overview)](#-개요-overview)
2. [공식 위키 문서 가이드 (Official Wiki Guide)](#-공식-위키-문서-가이드-official-wiki-guide)
3. [상세 기능 (Detailed Features)](#-상세-기능-detailed-features)
   - [1. 무손실 지능형 마크다운 교열 (Lossless Proofreading)](#1-무손실-지능형-마크다운-교열-lossless-proofreading)
   - [2. 맥락 인식 전문 번역 (Context-Aware Translation)](#2-맥락-인식-전문-번역-context-aware-translation)
   - [3. 마크다운 타이포그래피 및 서식 정규화 (Typography Normalizer)](#3-마크다운-타이포그래피-및-서식-정규화-typography-normalizer)
   - [4. 사용자 맞춤 자유 지시 (Custom Natural Instructions)](#4-사용자-맞춤-자유-지시-custom-natural-instructions)
   - [5. 대화형 Diff 검토 (Interactive Diff Review)](#5-대화형-diff-검토-interactive-diff-review)
   - [6. 듀얼 AI 서비스 프로바이더 및 고가용성 운영 (Multi-Provider High Availability)](#6-듀얼-ai-서비스-프로바이더-및-고가용성-운영-multi-provider-high-availability)
   - [7. 실시간 작업 제어 및 스마트 데스크톱 UX (Real-Time Control & Smart UX)](#7-실시간-작업-제어-및-스마트-데스크톱-ux-real-time-control--smart-ux)
4. [설치 및 환경 설정 (Installation & Setup)](#-설치-및-환경-설정-installation--setup)
   - [플러그인 설치 방법](#플러그인-설치-방법)
   - [AI 백엔드 엔드포인트 연결 가이드](#ai-백엔드-엔드포인트-연결-가이드)
5. [보안, 프라이버시 및 규정 준수 고지 (Security, Privacy & Disclosures)](#-보안-프라이버시-및-규정-준수-고지-security-privacy--disclosures)
   - [외부 네트워크 통신 고지 (Network Usage)](#외부-네트워크-통신-고지-network-usage)
   - [볼트 파일 접근 및 권한 (Vault File Access)](#볼트-파일-접근-및-권한-vault-file-access)
   - [계정 및 요금 정책 (Account & Monetization)](#계정-및-요금-정책-account--monetization)
   - [원격 분석 및 광고 배제 (Telemetry & Advertisements)](#원격-분석-및-광고-배제-telemetry--advertisements)
6. [오픈소스 프로젝트 크레딧 및 감사의 글 (Acknowledgements & Open Source Credits)](#-오픈소스-프로젝트-크레딧-및-감사의-글-acknowledgements--open-source-credits)
7. [라이선스 (License)](#-라이선스-license)

---

## 🌟 개요 

**Assistant Emily** 는 옵시디언(Obsidian) 환경에서 학술 연구, 기술 문서 작성, 지식 정리 및 번역 작업을 수행하는 사용자를 위해 설계된 **데스크톱 전용 지능형 AI 페어 어시스턴트 플러그인** 입니다.

일반적인 AI 도구들은 마크다운 문서를 다룰 때 YAML 프론트매터, 옵시디언 내부 링크(`[[노트명]]`), 태그(`#tag`), 수식(`$...$`), 콜아웃 블록(`> [!note]`) 등을 훼손하거나 변형시키는 문제를 안고 있습니다. Assistant Emily는 이러한 문제를 극복하기 위해 **독자적인 문법 마스킹 파이프라인(Syntax Masking Pipeline)** 을 기반으로 설계되었습니다.

### 핵심 가치
* **100% 무손실 보존(Lossless Preservation)** : 원본 문서의 고유한 메타데이터와 옵시디언 고유 문법을 보호합니다.
* **학술 및 전문 문서에 최적화** : 대용량 문서에 대한 지능형 스마트 청킹(Smart Chunking), 1:1 문단 대조 번역(Bilingual Alignment), 코드 블록 내부 주석 선택 번역을 지원합니다.
* **로컬 AI 및 프라이버시 존중** : OpenAI 공식 API뿐만 아니라 `FreeLLMAPI`, 로컬 Ollama, LM Studio, vLLM, OpenRouter 등 OpenAI 호환 엔드포인트를 폭넓게 지원합니다.

---

## 📚 공식 위키 문서 가이드 (Official Wiki Guide)

Assistant Emily의 모든 설정법, 심층 기능 시나리오, 실전 활용 팁은 **[GitHub 공식 Wiki](https://github.com/sparklings/emily/wiki)**에 체계적으로 정리되어 있습니다. 원하시는 항목을 클릭하여 바로 이동하십시오.

| 위키 가이드 문서 | 주요 안내 내용 | 바로가기 |
| :--- | :--- | :---: |
| 🏠 **[위키 홈 (Home)](https://github.com/sparklings/emily/wiki)** | 플러그인 철학, 핵심 가치, 작동 아키텍처 파이프라인 개요 | [열기 →](https://github.com/sparklings/emily/wiki) |
| 🚀 **[상세 기능 (Detailed Features)](https://github.com/sparklings/emily/wiki/Detailed-Features)** | 무손실 문법 마스킹 교열, 3대 번역 모드(선택/전체/1:1 대조), 코드 주석 전용 번역, Needleman-Wunsch 대화형 Diff 검토 | [열기 →](https://github.com/sparklings/emily/wiki/Detailed-Features) |
| ⚙️ **[설치 및 초기 설정 (Installation & Setup)](https://github.com/sparklings/emily/wiki/Installation-and-Setup)** | GitHub 릴리즈 수동 설치, BRAT 간편 설치, 데스크톱 요구사항 및 단축키 안내 | [열기 →](https://github.com/sparklings/emily/wiki/Installation-and-Setup) |
| 🤖 **[AI 프로바이더 및 기기 프로필 가이드 (AI Providers Guide)](https://github.com/sparklings/emily/wiki/AI-Providers-Guide)** | 3-Tab 서브탭 구조, 듀얼 프로바이더 동시 헬스체크, 무중단 자동 Failover, 짝/홀수 청크 분산 처리, 집/회사 다중 기기 프로필(`os.hostname()`) 관리, 포트/키 자동 탐색(Auto-Probe) | [열기 →](https://github.com/sparklings/emily/wiki/AI-Providers-Guide) |
| 💡 **[FAQ 및 문제 해결 (Troubleshooting & FAQ)](https://github.com/sparklings/emily/wiki/Troubleshooting-and-FAQ)** | 연결 테스트 오류 점검, Ollama CORS 및 로컬 프록시 설정법, 대용량 번역 최적화 팁 | [열기 →](https://github.com/sparklings/emily/wiki/Troubleshooting-and-FAQ) |
| 🔒 **[보안 및 프라이버시 (Security & Privacy)](https://github.com/sparklings/emily/wiki/Security-and-Privacy)** | 중계 서버 배제 100% 직접 통신, 볼트 파일 권한 원칙, 사용자 추적/광고 배제 정책 | [열기 →](https://github.com/sparklings/emily/wiki/Security-and-Privacy) |
| 💖 **[크레딧 및 라이선스 (Credits & License)](https://github.com/sparklings/emily/wiki/Credits-and-License)** | Obsidian API, FreeLLMAPI, Pi Agent 등 오픈소스 커뮤니티 감사의 글 및 MIT 라이선스 | [열기 →](https://github.com/sparklings/emily/wiki/Credits-and-License) |

---

## 🚀 상세 기능

### 1. 무손실 지능형 마크다운 교열 (Lossless Proofreading)
* **문맥 기반 오탈자 및 문법 교정** : 단순 규칙 기반 검사를 넘어, LLM의 문맥 이해력을 활용하여 맞춤법, 띄어쓰기, 어색한 조사, 주술 호응 관계를 지능적으로 바로잡습니다.
* **문법 마스킹 보호** : 옵시디언 위키링크(`[[Note]]`, `[[Note|Alias]]`), 태그(`#tag`), 콜아웃 헤더(`> [!tip]`), 인라인/블록 LaTeX 수식(`$...$`, `$$...$$`), 인라인 코드 및 코드 블록 전체를 UUID 토큰으로 안전하게 보호한 뒤 교열을 수행하여 원본 서식이 절대 깨지지 않습니다.
* **인터랙티브 Diff 모달**
  * 발견된 모든 교정 항목을 목록화하여 표시합니다.
  * 항목별로 개별 적용 여부를 체크박스로 자유롭게 켜고 끌 수 있습니다.
  * 항목을 클릭하면 에디터의 해당 위치로 즉시 스크롤되어 전후 맥락을 직관적으로 확인할 수 있습니다.

### 2. 맥락 인식 전문 번역 (Context-Aware Translation)
* **3가지 작업 범위(Scope) 지원**
  * **선택 영역(Selection)** : 블록 지정된 텍스트만 빠르게 번역.
  * **전체 문서(All Document)** : 문서 전체의 H1~H6 헤더 계층 구조를 보존하며 번역.
  * **문단별 1:1 대조 병렬 번역(Paragraph Bilingual)** : 원문 문단 바로 아래에 번역 문단을 1:1로 배치하여 논문이나 외신 번역 검토 시 최적의 가독성을 제공합니다.
* **문체 및 어조 맞춤 설정**
  * 문체: `학술체(Academic)`, `경어체(Polite)`, `친근체(Friendly)`
  * 스타일: `직역(Literal)`, `균형(Balanced)`, `자연스러운 의역(Free Natural)`
* **코드 블록 주석 전용 번역 스위치**
  * 프로그래밍 코드 블록(`python`, `typescript`, `cpp` 등) 내부의 코드 로직, 변수명, 함수명은 100% 보존하면서 오직 주석(`//`, `#`, `/* ... */`)만 자연스럽게 번역할 수 있습니다.
* **안전 스마트 청킹(Smart Chunking - 1,600자 최적화)**
  * LLM의 단일 응답 토큰 한계를 초과하는 대용량 문서는 H1~H3 헤더 및 문단 경계를 분석하여 무결성을 유지하며 1,600자 단위로 안전하게 분할 번역한 뒤 하나로 완벽하게 재조립합니다. (조기 단절 및 누락 0% 보장)

### 3. 마크다운 타이포그래피 및 서식 정규화 (Typography Normalizer)
* **동아시아 언어 볼드 공백 자동 보정(East Asian Bold Spacing Normalizer)**
  * 한국어, 일본어, 중국어 환경에서 마크다운 볼드 구문 뒤에 조사가 바로 붙을 경우(`**중요한**것은`), 옵시디언 에디터의 렌더링 규칙에 따라 볼드 서식이 풀리거나 깨지는 현상을 방지하기 위해 표준적인 공백 규칙을 자동으로 정규화합니다.
* **유튜브/강의 스크립트 타임스탬프 클리너**
  * 영상 자막이나 강의 녹취록에서 빈번하게 발생하는 타임스탬프(`12:34`, `01:23:45`)를 즉시 제거하고, 줄 단위로 잘려진 파편화된 문장들을 하나의 완성도 높은 문단으로 매끄럽게 재구성합니다.

### 4. 사용자 맞춤 자유 지시 (Custom Natural Instructions)
* 사용자가 원하는 임의의 자연어 지시(예: *"핵심 개념을 옵시디언 콜아웃 블록으로 감싸줘"*, *"글 전체의 결론을 3줄 요약 불릿으로 하단에 추가해줘"*)를 입력창에 적어 손쉽게 적용할 수 있습니다.

### 5. 대화형 Diff 검토 (Interactive Diff Review)
* **정밀 시퀀스 정렬 엔진 (Needleman-Wunsch Sequence Alignment)**: 원문과 번역문 간 단락 수 불일치 또는 일부 생략이 발생하더라도 상단 번역 블록이 아래로 왜곡·밀리는 현상을 원천 방지하고 1:1 완벽 정합을 유지합니다.
* **구조 앵커 매칭**: 프론트매터 1:1 고정, 헤딩 레벨(`##`, `###`) 엄격 일치, 공통 고유명사/코드/URL 토큰 유사도 기반 정확한 블록 대조.
* **깔끔한 텍스트 UI**: 대조 검토 모달창 내 모든 이모지/아이콘을 전면 제거하여 가독성과 전문성을 극대화한 순수 텍스트 레이블 UI.
* 사이드바 하단의 세션 이력 카드에서 과거 실행 결과를 언제든지 다시 열람할 수 있습니다.
* 과거 세션 결과를 다시 열 때는 **추가 LLM API 호출이나 토큰 소모가 전혀 발생하지 않으며(Zero-Token)**, 좌우 분할 스크롤(Synchronized Split View) 화면에서 원본과 수정본을 안전하게 비교 검토한 뒤 원하는 방식으로 문서에 적용할 수 있습니다.
* **데스크톱 편의성**: `Ctrl+Enter` / `Cmd+Enter` 글로벌 단축키 실행, 한글 IME 조합 중복 방지, 실수로 인한 모달 닫힘 방지(Shake 효과)가 적용되어 있습니다.

### 6. 듀얼 AI 서비스 프로바이더 및 고가용성 운영 (Multi-Provider High Availability)
* **탭 네비게이션 설정 UI (Tab Navigation UI)**
  * 기본 프로바이더(Provider 1)와 보조 프로바이더(Provider 2)를 직관적인 상단 탭으로 독립 관리합니다.
  * WAI-ARIA 접근성 표준(`role="tablist"`, `role="tab"`, `aria-selected`)을 준수하며, 키보드 좌우 방향키(`ArrowLeft`/`ArrowRight`)를 통한 즉각적인 탭 전환을 지원합니다.
  * 프로바이더 1과 2의 메뉴명을 100% 일원화(`API 기본 URL`, `API 키`, `모델 이름`, `연결 테스트`)하여 설정 혼선을 완전히 제거하였습니다.
* **동시 헬스체크 및 동적 기본값 선출 (Concurrent Health Check)**
  * **`모든 프로바이더 헬스체크 및 기본값 설정`** 버튼 클릭 한 번으로 등록된 양측 프로바이더의 연결 상태와 응답 지연 시간(Latency ms)을 동시 측정합니다.
  * 정상 응답을 반환하는 프로바이더를 감지하여 최적의 기본 요청 프로바이더로 자동 선출합니다.
* **무중단 자동 장애 복구 (Auto Failover)**
  * 주 프로바이더 통신 중 네트워크 타임아웃, 502/503 게이트웨이 오류, 서비스 다운 등 장애가 감지되면, 작업 실패를 방지하기 위해 등록된 보조 프로바이더로 **무중단 자동 우회 재시도(Silent Retry)**를 수행합니다.
* **대용량 문서 청크 분산 처리 (Distributed Chunk Processing)**
  * 1,600자를 초과하는 긴 문서는 헤딩(`##`, `###`) 및 문단 사이 빈 줄을 기준으로 스마트 청킹을 수행합니다.
  * 분할된 청크를 프로바이더 1과 프로바이더 2에 짝수/홀수 교차 분산(`[P1][1/4]`, `[P2][2/4]`, `[P1][3/4]`, `[P2][4/4]`) 요청하여 단일 프로바이더의 요청 빈도 제한(Rate Limit)을 우회하고 전체 번역 처리량을 대폭 향상합니다.
  * 사용자가 `기본 활성 프로바이더`를 특정 프로바이더(`프로바이더 1 고정` 또는 `프로바이더 2 고정`)로 명시 지정한 경우, 사용자 의도를 엄격히 존중하여 타 프로바이더로 분산하지 않고 단일 프로바이더를 고수합니다.
* **연결 테스트 프롬프트 가드레일 및 추론 독백(`<think>`) 정제**
  * 현재 시간대(아침/오후/저녁/밤) 및 로케일 언어에 맞춘 자연스러운 인사말을 생성합니다.
  * DeepSeek R1, Qwen 2.5 등 최신 오픈소스 추론형 LLM의 내부 생각 과정(`<think>...</think>`) 태그 블록 및 영문 독백을 정교한 정규식으로 완벽 제거하고 순수 한국어 인사말만 정제하여 표시합니다.

### 7. 실시간 작업 제어 및 스마트 데스크톱 UX (Real-Time Control & Smart UX)
* **실시간 즉시 작업 취소 (Immediate Task Cancel with AbortController)**
  * 긴 문서 번역이나 교열 작업 중 사용자가 언제든지 중단할 수 있도록 스트림 헤더에 **`[❌ 작업 취소]`** 버튼을 제공합니다.
  * 취소 클릭 시 `AbortController`를 통해 진행 중이던 비동기 HTTP 통신을 즉시 중단하고, 생성 중이던 미완성 임시 파일을 옵시디언 휴지통(`trashFile`)으로 자동 정리하여 볼트 오염을 원천 방지합니다.
* **방해 없는 클린 대상 문서 표시줄**
  * 사이드바 대상 문서 바에서 시각적 노이즈를 배제하여 활성 노트의 전체 제목을 온전하고 또렷하게 표시합니다.
* **실시간 타임라인 및 세션 프로바이더 텔레메트리**
  * 다단계 파이프라인 진행 중 실시간 타임라인에 `[P1] [1/4]`, `[P2] [2/4]` 형태로 청크별 진행 상황을 상세히 안내합니다.
  * 완료된 세션 히스토리 카드에 실제 사용된 공급자 정보(`P1`, `P2`, `P1+P2 분산`, `(Failover)`) 및 처리 시간, 토큰 속도(tokens/sec)를 투명하게 기록합니다.

---

## ⚙️ 설치 및 환경 설정 

### 플러그인 설치 방법

#### 1. 깃허브 릴리즈 수동 설치 (권장)
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

#### 2. BRAT(Beta Reviewers Auto-update Tester)을 통한 설치
1. 옵시디언 BRAT 플러그인 설정에서 **Add Beta plugin** 을 클릭합니다.
2. 리포지토리 주소 `sparklings/emily`를 입력하여 추가합니다.

---

### AI 서비스 프로바이더 및 운영 정책 설정 가이드

옵시디언 **설정 > Assistant Emily** 탭에서 주(Primary) 및 보조(Secondary) 프로바이더 정보를 설정하십시오:

#### 1. 프로바이더 등록 (Tab Navigation)

| 프로바이더 구분 | 역할 및 용도 | API 기본 URL 예시 | 모델 이름 예시 |
| :--- | :--- | :--- | :--- |
| **프로바이더 1 (Primary)** | 기본 작업 및 일반 질의 수행 | `https://api.openai.com/v1`<br>`https://your-freellmapi/v1`<br>`http://localhost:11434/v1` (Ollama) | `gpt-4o`<br>`auto`<br>`llama3` |
| **프로바이더 2 (Secondary)** | 고가용성 보조, 장애 자동 복구(Failover) 및 대용량 청크 분산 처리 | `https://api.groq.com/openai/v1`<br>`http://localhost:1234/v1` (LM Studio)<br>`https://openrouter.ai/api/v1` | `llama-3.3-70b-versatile`<br>`auto`<br>`anthropic/claude-3.5-sonnet` |

#### 2. 다중 프로바이더 운영 정책

* **기본 활성 프로바이더 (Active Provider)**
  * `자동 선택 (Auto)`: 헬스체크 결과를 바탕으로 정상 연결된 프로바이더를 스마트하게 선출하여 활용합니다.
  * `프로바이더 1 고정`: 모든 일반 요청을 프로바이더 1로 고정하며 대용량 분산 청크도 타 프로바이더로 분산하지 않습니다.
  * `프로바이더 2 고정`: 모든 일반 요청을 프로바이더 2로 고정하며 대용량 분산 청크도 타 프로바이더로 분산하지 않습니다.
* **자동 장애 복구 (Auto Failover)**: 토글 활성화 시 주 프로바이더 오류 발생 시 보조 프로바이더로 자동 우회 재시도합니다.
* **대용량 문서 청크 분산 처리 (Distributed Chunk Processing)**: 대용량 번역 시 짝수/홀수 청크를 프로바이더 1과 2에 교차 분산 요청합니다.
* **모든 프로바이더 헬스체크 및 기본값 설정**: 원클릭으로 등록된 양측 프로바이더의 연결 상태와 응답 시간을 동시 진단하고 권장 프로바이더를 즉시 확인합니다.
* **기기별 프로필 관리 (Device Profiles) 및 자동 탐색 (Auto-Probe)**: 집/회사 노트북 등 다중 기기 환경에서 동일한 localhost 주소를 사용하지만 기기별 API Key나 포트 번호가 다를 때 `os.hostname()` 기반 기기 프로필을 1순위로 자동 매칭합니다. 포트 연결 거부나 401 인증 오류 발생 시 작동하는 포트/키를 자동으로 진단하여 현재 기기 프로필에 즉시 저장합니다.
* 📖 더 자세한 백엔드별 연동 레시피(Ollama, LM Studio, Groq, OpenRouter) 및 기기별 설정법은 **[AI 프로바이더 및 기기 프로필 가이드 Wiki](https://github.com/sparklings/emily/wiki/AI-Providers-Guide)**를 참고하십시오.

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
  <a href="https://github.com/sparklings/emily/wiki"><img src="https://img.shields.io/badge/docs-GitHub%20Wiki-brightgreen.svg?style=flat-square" alt="Documentation Wiki"></a>
  <a href="https://github.com/sparklings/emily/releases"><img src="https://img.shields.io/badge/version-1.0.13-blue.svg?style=flat-square" alt="Version"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-v1.7.2+-purple.svg?style=flat-square" alt="Obsidian"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License"></a>
  <a href="#-system-architecture"><img src="https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg?style=flat-square" alt="TypeScript"></a>
  <a href="#-security-privacy--disclosures"><img src="https://img.shields.io/badge/Privacy-100%25%20Local%2FDirect-success.svg?style=flat-square" alt="Privacy"></a>
  <a href="#-overview"><img src="https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg?style=flat-square" alt="Desktop Only"></a>
</p>

<p align="center">
  <a href="#assistant-emily"><b>🇺🇸 English</b></a> | <a href="#어시스턴트-에밀리"><b>🇰🇷 한국어</b></a> | <a href="https://github.com/sparklings/emily/wiki"><b>📚 Official Wiki</b></a>
</p>

> [!TIP]
> 📚 **Official GitHub Wiki Now Available**: Comprehensive guides, setup walkthroughs, local AI (Ollama/LM Studio) recipes, multi-device profile management, and troubleshooting tips are available on the **[Assistant Emily Official Wiki](https://github.com/sparklings/emily/wiki)**!

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Official Documentation & Wiki Guide](#-official-documentation--wiki-guide)
3. [Detailed Features](#-detailed-features)
   - [1. Lossless Intelligent Markdown Proofreading](#1-lossless-intelligent-markdown-proofreading)
   - [2. Context-Aware Professional Translation](#2-context-aware-professional-translation)
   - [3. Markdown Typography & Formatting Normalization](#3-markdown-typography--formatting-normalization)
   - [4. Custom Natural Instructions](#4-custom-natural-instructions)
   - [5. Interactive Diff Review](#5-interactive-diff-review)
   - [6. Dual AI Service Providers & High Availability](#6-dual-ai-service-providers--high-availability)
   - [7. Real-Time Task Cancellation & Desktop UX](#7-real-time-task-cancellation--desktop-ux)
4. [Installation & Setup](#-installation--setup)
   - [Plugin Installation Methods](#plugin-installation-methods)
   - [AI Service Providers & Operating Policies Guide](#ai-service-providers--operating-policies-guide)
5. [Security, Privacy & Disclosures](#-security-privacy--disclosures)
   - [External Network Communication Notice (Network Usage)](#external-network-communication-notice)
   - [Vault File Access & Permissions (Vault File Access)](#vault-file-access--permissions)
   - [Account & Monetization Policy (Account & Monetization)](#account--monetization-policy)
   - [Zero Telemetry & Ad-Free Policy (Telemetry & Advertisements)](#zero-telemetry--ad-free-policy)
6. [Acknowledgements & Open Source Credits](#-acknowledgements--open-source-credits)
7. [License](#-license)

---

## 🌟 Overview

**Assistant Emily** is a **desktop-only intelligent AI pair-assistant plugin** designed for Obsidian users engaged in academic research, technical documentation, knowledge management, and translation.

Conventional AI tools often corrupt or strip critical Markdown elements—such as YAML frontmatter, Obsidian internal links (`[[Note Name]]`), tags (`#tag`), LaTeX formulas (`$...$`), and callout blocks (`> [!note]`)—when modifying documents. Assistant Emily completely resolves this challenge through its proprietary **Syntax Masking Pipeline**.

### Core Values
* **100% Lossless Preservation**: Safely shields the document's original metadata and unique Obsidian syntax from corruption.
* **Optimized for Academic & Technical Writing**: Features smart chunking for large documents, 1:1 paragraph bilingual alignment, and selective translation for code block comments.
* **Local AI & Privacy First**: Universally supports OpenAI-compatible endpoints—ranging from official OpenAI API and `FreeLLMAPI` to local Ollama, LM Studio, vLLM, and OpenRouter.

---

## 📚 Official Documentation & Wiki Guide

Comprehensive user guides, architecture overviews, recipe integrations, and FAQs are maintained on the **[Official GitHub Wiki](https://github.com/sparklings/emily/wiki)**. Click any link below to explore:

| Wiki Document | Covered Topics | Quick Link |
| :--- | :--- | :---: |
| 🏠 **[Wiki Home](https://github.com/sparklings/emily/wiki)** | Plugin philosophy, core values, and processing pipeline architecture | [Open →](https://github.com/sparklings/emily/wiki) |
| 🚀 **[Detailed Features](https://github.com/sparklings/emily/wiki/Detailed-Features)** | Lossless syntax masking proofreading, 3 translation scopes, code comments translation, Needleman-Wunsch interactive diff modal | [Open →](https://github.com/sparklings/emily/wiki/Detailed-Features) |
| ⚙️ **[Installation & Setup](https://github.com/sparklings/emily/wiki/Installation-and-Setup)** | GitHub Releases manual install, BRAT quick setup, desktop requirements, and keyboard shortcuts | [Open →](https://github.com/sparklings/emily/wiki/Installation-and-Setup) |
| 🤖 **[AI Providers Guide](https://github.com/sparklings/emily/wiki/AI-Providers-Guide)** | 3-Tab navigation settings, dual provider concurrent health checks, auto failover, distributed chunk processing, multi-device profile management (`os.hostname()`), and Auto-Probe | [Open →](https://github.com/sparklings/emily/wiki/AI-Providers-Guide) |
| 💡 **[Troubleshooting & FAQ](https://github.com/sparklings/emily/wiki/Troubleshooting-and-FAQ)** | Connection testing diagnostics, Ollama CORS & local proxy setups, large document chunk optimization tips | [Open →](https://github.com/sparklings/emily/wiki/Troubleshooting-and-FAQ) |
| 🔒 **[Security & Privacy](https://github.com/sparklings/emily/wiki/Security-and-Privacy)** | Zero telemetry, direct client-to-endpoint network communication, and scoped vault file permissions | [Open →](https://github.com/sparklings/emily/wiki/Security-and-Privacy) |
| 💖 **[Credits & License](https://github.com/sparklings/emily/wiki/Credits-and-License)** | Acknowledgements to Obsidian API, FreeLLMAPI, Pi Agent, and the MIT License | [Open →](https://github.com/sparklings/emily/wiki/Credits-and-License) |

---

## 🚀 Detailed Features

### 1. Lossless Intelligent Markdown Proofreading
* **Context-Aware Spelling and Grammar Correction**: Transcends rigid rule-based checkers by leveraging LLM contextual comprehension to fix spelling, spacing, awkward particles, and subject-predicate agreement.
* **Syntax Masking Protection**: Obsidian wikilinks (`[[Note]]`, `[[Note|Alias]]`), tags (`#tag`), callout headers (`> [!tip]`), inline and block LaTeX equations (`$...$`, `$$...$$`), and code blocks are securely converted into UUID placeholder tokens before LLM processing, guaranteeing zero corruption to original formatting.
* **Interactive Diff Modal**:
  * Displays all detected corrections in an organized list.
  * Allows selective toggling of individual edits via checkboxes.
  * Clicking an issue scrolls directly to its corresponding position in the editor for instant context verification.

### 2. Context-Aware Professional Translation
* **3 Translation Scopes**:
  * **Selection**: Rapidly translates only highlighted text blocks.
  * **All Document**: Translates the full document while preserving heading hierarchies (H1–H6).
  * **Paragraph Bilingual**: Places the translated paragraph immediately below the source paragraph in a 1:1 alignment, ideal for academic papers and international news reviews.
* **Tone & Style Customization**:
  * Tone: `Academic`, `Polite`, `Friendly`
  * Style: `Literal`, `Balanced`, `Free Natural`
* **Code Block Comments Only Translation Switch**:
  * Safely translates comments (`//`, `#`, `/* ... */`) while maintaining 100% integrity of code syntax, variable names, and function identifiers across programming languages (`python`, `typescript`, `cpp`, etc.).
* **Safe Smart Chunking (1,600 Characters Optimized)**:
  * For long documents exceeding single-turn LLM response token limits, the engine intelligently splits text along H1–H3 headers and paragraph boundaries at a safe 1,600-character threshold, translating sequentially and reconstructing the document seamlessly without token clipping or omissions.

### 3. Markdown Typography & Formatting Normalization
* **East Asian Bold Spacing Normalizer**:
  * In Korean, Japanese, and Chinese texts, when grammatical particles immediately follow bold markup (e.g., `**word**particle`), Obsidian's renderer may fail to render bold formatting correctly. The normalizer automatically standardizes whitespace to ensure pristine visual rendering.
* **YouTube / Lecture Script Timestamp Stripper**:
  * Strips recurring video timestamps (`12:34`, `01:23:45`) and reflows fragmented lines into fluent, readable prose paragraphs.

### 4. Custom Natural Instructions
* Execute arbitrary natural language commands directly in the prompt input field (e.g., *"Wrap key concepts in Obsidian callout blocks"*, *"Add a 3-bullet summary conclusion at the bottom"*).

### 5. Interactive Diff Review
* **Needleman-Wunsch Sequence Alignment Engine**: Prevents vertical block distortion and stretching when source and translated paragraph counts differ or when partial omissions occur, preserving 1:1 row alignment between matching sections.
* **Structural Anchor & Token Matching**: Strict heading level matching (`##` with `##`, `###` with `###`), YAML frontmatter anchor lock, and token overlap scoring for code/URLs/proper nouns (`GitHub`, `Discord`, `General`, `Obsidian`).
* **Clean Text-Only UI**: Replaced all emoji icons in the comparison modal with clean, professional text labels across headers, mode toggle buttons, and saving action buttons.
* Re-inspect previous execution outputs at any time via the session history cards located at the bottom of the sidebar.
* **Zero-Token Re-review**: Reopening prior results consumes **zero additional LLM API calls or tokens**, letting you safely compare original and modified documents in a synchronized split-scroll view before applying changes.
* **Desktop Productivity**: Features `Ctrl+Enter` / `Cmd+Enter` global shortcuts, IME composition protection for Korean/CJK input, and modal shake effects to prevent accidental dismissal.

### 6. Dual AI Service Providers & High Availability
* **Tab Navigation Configuration UI**
  * Manage Provider 1 (Primary) and Provider 2 (Secondary) independently using modern tab navigation.
  * Complies with WAI-ARIA accessibility standards (`role="tablist"`, `role="tab"`, `aria-selected`) with keyboard arrow (`ArrowLeft`/`ArrowRight`) navigation support.
  * 100% unified field labeling (`API Base URL`, `API Key`, `Model Name`, `Test Connection`) for seamless user experience.
* **Concurrent Health Check & Dynamic Recommendation**
  * Click **`Test All Providers & Set Default`** to simultaneously probe latency (ms) and operational health for both registered providers.
  * Dynamically nominates the healthy, lower-latency provider as the default for upcoming tasks.
* **Seamless Auto Failover**
  * If the primary provider encounters network timeouts, HTTP 502/503 errors, or service downtime, Assistant Emily automatically and silently fails over to the secondary provider without aborting the task.
* **Distributed Chunk Processing**
  * For long documents exceeding 1,600 characters, the engine splits content along Markdown headings and paragraph boundaries.
  * Odd and even chunks are distributed alternately across Provider 1 and Provider 2 (`[P1][1/4]`, `[P2][2/4]`, `[P1][3/4]`, `[P2][4/4]`), bypassing single-provider rate limits and boosting overall translation throughput.
  * Respects explicit provider pinning (`Primary Only` or `Secondary Only`) by disabling chunk distribution and honoring the user's pinned provider.
* **Reasoning Monologue (`<think>`) Sanitization**
  * Automatically strips internal thinking tokens (`<think>...</think>`) and internal English monologue generated by modern reasoning LLMs (such as DeepSeek R1 and Qwen 2.5), presenting only clean, formatted greetings.

### 7. Real-Time Task Cancellation & Desktop UX
* **Instant Task Cancellation (`AbortController`)**
  * An intuitive **`[❌ Cancel Task]`** button is displayed in the active streaming header during long-running tasks.
  * Clicking Cancel immediately aborts asynchronous HTTP requests and moves any partially written temporary files to Obsidian's trash (`trashFile`), keeping your vault pristine.
* **Clutter-Free Target Document Bar**
  * Displays the full, unobscured file name in the active note bar without visual noise or badge truncation.
* **Live Timeline & Provider Telemetry**
  * The multi-step execution timeline displays real-time chunk indicators (e.g., `[P1] [1/4]`, `[P2] [2/4]`).
  * Completed session cards record exact provider telemetry (`P1`, `P2`, `P1+P2 Distributed`, `(Failover)`), total execution time, and throughput speeds (tokens/sec).

---

## ⚙️ Installation & Setup

### Plugin Installation Methods

#### 1. Manual GitHub Releases Installation (Recommended)
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

#### 2. Installation via BRAT (Beta Reviewers Auto-update Tester)
1. In the Obsidian BRAT plugin settings, click **Add Beta plugin**.
2. Enter the repository path `sparklings/emily` and add the plugin.

---

### AI Service Providers & Operating Policies Guide

Navigate to Obsidian **Settings > Assistant Emily** to configure primary and secondary providers:

#### 1. Provider Registration (Tab Navigation)

| Provider | Role & Primary Purpose | Example API Base URL | Example Model |
| :--- | :--- | :--- | :--- |
| **Provider 1 (Primary)** | Default endpoint for everyday proofreading and translation | `https://api.openai.com/v1`<br>`https://your-freellmapi/v1`<br>`http://localhost:11434/v1` (Ollama) | `gpt-4o`<br>`auto`<br>`llama3` |
| **Provider 2 (Secondary)** | High-availability fallback, auto failover, and chunk distribution | `https://api.groq.com/openai/v1`<br>`http://localhost:1234/v1` (LM Studio)<br>`https://openrouter.ai/api/v1` | `llama-3.3-70b-versatile`<br>`auto`<br>`anthropic/claude-3.5-sonnet` |

#### 2. Multi-Provider Operational Policies

* **Active Provider for LLM Requests**
  * `Auto (Healthcheck based)`: Intelligently routes to the healthy provider and enables cooperative dual-provider operations.
  * `Provider 1 Only`: Pins all requests strictly to Provider 1 (suppresses chunk distribution).
  * `Provider 2 Only`: Pins all requests strictly to Provider 2 (suppresses chunk distribution).
* **Automatic Failover**: Automatically retries with the secondary provider if the active provider fails or times out.
* **Distributed Chunk Processing**: Alternates split translation chunks between Provider 1 & 2 for large documents.
* **Test All Providers & Set Default**: One-click concurrent health check measuring live latency (ms) and recommending the optimal default provider.
* **Multi-Device Profile Management & Auto-Probe**: When using identical localhost proxy addresses across multiple machines (home/work laptops) with distinct API keys or ports, Emily prioritizes device profiles matching `os.hostname()`. Automatically probes responsive ports and working keys upon connection failures or 401 errors and saves them directly to the active profile.
* 📖 For step-by-step backend recipes (Ollama, LM Studio, Groq, OpenRouter) and multi-device setups, refer to the **[AI Providers Guide Wiki](https://github.com/sparklings/emily/wiki/AI-Providers-Guide)**.

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

## 📄 License

Assistant Emily is open-source software released under the **[MIT License](LICENSE)**.
Feedback, issue reports, and pull request contributions are always welcome!
