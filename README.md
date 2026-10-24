# Assistant Emily

> Intelligent Lossless Markdown Proofreading, Context-Aware AI Translation, and Obsidian-Flavored Markdown (OFM) Pair-Assistant for Desktop Obsidian.

프로젝트 공식 명칭은 **Assistant Emily** 로 정의하며, 옵시디언 커뮤니티 플러그인 등록 식별자 및 패키지 명칭은 소문자 `assistant-emily`로 표기합니다.

`assistant-emily`는 옵시디언(Obsidian) 데스크톱 환경에서 학술 연구, 기술 문서 작성, 지식 정리를 수행하는 사용자를 위해 설계된 AI 페어 어시스턴트 플러그인입니다. 독자적인 **문법 마스킹 파이프라인(Syntax Masking Pipeline)** 을 기반으로 위키링크, 태그, LaTeX 수식, 콜아웃, 코드 블록을 100% 무손실 보존하며, 맥락 인식 AI 번역과 정밀 교열을 수행합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Desktop Only](https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg)]()
[![Obsidian: v1.7.2+](https://img.shields.io/badge/Obsidian-v1.7.2%2B-purple.svg)](https://obsidian.md)
[![Version: v1.1.0](https://img.shields.io/badge/Version-v1.1.0-green.svg)](CHANGELOG.md)
[![TypeScript: Strict Mode](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg)]()
[![Privacy: 100% Local/Direct](https://img.shields.io/badge/Privacy-100%25%20Local%2FDirect-success.svg)](SECURITY.md)

---

## Key Features

* **100% 무손실 마크다운 & OFM 문법 마스킹**: 위키링크(`[[노트]]`), 태그(`#tag`), LaTeX 수식(`$...$`), 콜아웃(`> [!note]`), 목차 타임스탬프(`TOCTIME`)를 UUID 토큰으로 잠금하여 LLM에 의한 서식 왜곡 0% 보장.
* **맥락 인식 전문 번역 및 문체 정합**: 전체 문서 번역(기본값), 선택 영역 번역, 단락별 1:1 대조 병렬 번역(Bilingual Alignment)과 학술체·경어체·친근체 종결어미 정합 지원.
* **영상 클리핑 구역 분할 & 1,800자 스마트 청킹**: 메타데이터(목차, 동영상 링크, 연락처) 줄바꿈을 100% 원형 보존하고, `## Transcript` 자막 본문만 타임스탬프 제거 및 유려한 단락 리플로우 적용.
* **기기 프로필 기반 스마트 엔드포인트 관리**: 로컬 Ollama, LM Studio, FreeLLMAPI, OpenRouter, OpenAI 호환 프록시를 기기별로 독립 바인딩하여 OneDrive/클라우드 볼트 동기화 시 설정 충돌 방지.

---

## Documentation Hub

본 프로젝트는 산출물 및 기능 도메인별로 세분화된 전용 기술 문서를 제공합니다. 상세 내용은 아래 개별 문서를 참조하십시오:

| 기능 / 도메인 | 대상 산출물 파일 | 주요 내용 및 링크 |
| :--- | :--- | :--- |
| **시스템 아키텍처** | `src/core/*`<br>`src/api/*` | [시스템 구조 및 코어 파이프라인 설계](docs/architecture.md)<br>UI Sidecar 계층, 컴포넌트 데이터 흐름, 모듈별 단일 책임 원칙 |
| **무손실 문법 마스킹** | `src/core/markdownMasker.ts` | [무손실 마크다운 & OFM 문법 마스킹 기술 가이드](docs/syntax-masking-pipeline.md)<br>10대 문법 요소 UUID 토큰 체계, TOCTIME 잠금, OFM 자가 치유 정규화 |
| **영상 클리핑 & 청킹** | `src/core/markdownFormatter.ts`<br>`src/core/translationEngine.ts` | [영상 클리핑 구역 분할 및 스마트 청킹 기술 가이드](docs/video-clipping-and-chunking-guide.md)<br>Pre-Transcript 줄바꿈 보존, 자막 타임스탬프 정제, 1,800자 청킹 |
| **기기 프로필 & 설정** | `src/ui/settingsTab.ts`<br>`src/api/llmProxyClient.ts` | [기기 프로필 기반 AI 엔드포인트 및 설정 매뉴얼](docs/settings-and-provider-manual.md)<br>4대 서브탭 명세, 기기 ID 바인딩, Ollama/FreeLLMAPI 연동 |
| **장애 진단 & 문제 해결** | 전체 프로젝트 리포지토리 | [장애 진단 및 문제 해결 가이드](docs/troubleshooting.md)<br>LLM Proxy 502 오류 처리, 413 컨텍스트 초과 대처, 중국어 간체 누출 방지 |
| **버전 및 변경 이력** | 전체 프로젝트 리포지토리 | [변경 이력 (CHANGELOG.md)](CHANGELOG.md)<br>버전별(v1.0.0 ~ v1.1.0) 신규 기능, 버그 수정, 68개 테스트 케이스 추적 |

---

## Quick Start

### 1) 플러그인 설치 (Installation)
* **BRAT 플러그인 이용**: 옵시디언 BRAT 플러그인에서 `sparklings/emily`를 추가합니다.
* **수동 설치**: [Releases](https://github.com/sparklings/emily/releases)에서 `main.js`, `manifest.json`, `styles.css`를 다운로드하여 볼트의 `.obsidian/plugins/assistant-emily/` 폴더에 복사하고 플러그인을 활성화합니다.

### 2) AI 프로바이더 설정 (Provider Setup)
옵시디언 **설정 ➔ Assistant Emily ➔ AI 프로바이더** 탭에서 사용 중인 환경을 선택합니다:
* **로컬 Ollama**: 기본 프리셋 선택 (`http://127.0.0.1:11434/v1`, 모델: `qwen2.5:14b` 등)
* **FreeLLMAPI**: 엔드포인트 URL 및 API 키 입력 (`dots-3-note-preview:free`)
* **OpenAI / OpenRouter**: 엔드포인트 및 API 키 입력 후 **[연결 테스트]** 버튼으로 상태 확인

### 3) 일상적 번역 및 교열 실행 (Routine Operations)
1. 왼쪽 리본 메뉴의 마법봉 아이콘(🪄)을 클릭하여 **Assistant Emily 사이드바** 를 엽니다.
2. 번역 스위치를 켜고 원하는 범위(`전체 문서 번역`, `선택 영역 번역`, `단락별 1:1 대조`)를 선택합니다.
3. **[🚀 작업 시작하기]** 버튼을 클릭하면 실시간 진행 타임라인과 함께 무손실 번역이 수행됩니다.

---

## Quick Feature Reference

| 구분 | 지원 모드 / 옵션 | 설명 및 기대 효과 |
| :--- | :--- | :--- |
| **번역 범위 (Scope)** | `전체 문서 (all)` | H1~H6 헤더 계층 및 본문 전체를 100% 대상 언어로 완역 (기본값) |
| | `선택 영역 (selection)` | 에디터에서 마우스로 드래그한 블록 텍스트만 원자적으로 번역 치환 |
| | `단락별 대조 (bilingual)` | 원문 문단 하단에 번역 문단을 1:1로 배치하여 직관적 대조 검토 |
| **교열 도구 (Proofread)** | `맞춤법 검사` | 한글 맞춤법 및 표준어 규정에 따른 오탈자 수정 |
| | `문법 검사` | 주술 호응 관계, 불필요한 피동/사동 표현, 어색한 조사 교정 |
| | `타임스탬프 삭제` | 자막 본문에 난립하는 시간 기호를 선제적으로 제거 |
| **문체 (Tone)** | `학술체` / `경어체` / `친근체` | `~이다/한다`, `~합니다`, `~해요` 종결어미를 문서 전체에 일관되게 정합 |
| **서식 정규화 (OFM)** | `헤딩 개행 보정` | 헤딩(`#`) 전후 빈 줄 자동 보장으로 렌더링 충돌 방지 |
| | `콜아웃 연속성` | 콜아웃 블록 내부의 누락된 `>` 인용 부호 자동 재주입 |

---

## Latest Release Information (v1.1.0)

* **목차 타임스탬프 마스킹 잠금 (`TOCTIME`)**: `1:57 BEGINNER` 등 목차 시간과 불릿 리스트를 100% 원형 보존.
* **영상 클리핑 구역 분할**: Pre-Transcript 메타데이터 줄바꿈을 원형 보존하고 본문 자막만 타임스탬프 정제 및 문단 리플로우.
* **동영상 임베드 사후 확정 복원**: LLM이 영상 태그를 누락하더라도 코드 레벨에서 100% 강제 재주입.
* **1,800자 스마트 청킹 & 복원 회복력**: 경량/무료 모델에서도 에러 없이 끝까지 완역.
* **반응형 사이드바 아이콘 모드**: 380px 미만 사이드바 환경에서 취소 버튼을 22px 콤팩트 아이콘으로 전환.

전체 버전별 세부 변경 사항은 [CHANGELOG.md](CHANGELOG.md)에서 확인하실 수 있습니다.

---

## System Requirements & Prerequisites

* **Obsidian**: v1.7.2 이상 (데스크톱 전용)
* **운영체제**: Windows 10/11, macOS, Linux
* **네트워크 / AI 백엔드**: 로컬 Ollama (`localhost:11434`), LM Studio (`localhost:1234`), 또는 OpenAI 호환 REST API 엔드포인트

---

## LLM & AI Agent Indexing (AI Ingestion)

* **간략 요약 명세**: [`llms.txt`](llms.txt) 및 [`docs/llms.txt`](docs/llms.txt)
* **심층 아키텍처 및 구현 명세**: [`llms-full.txt`](llms-full.txt)
* **AI 코딩 에이전트 제약 규칙**: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
* **소프트웨어 인용 메타데이터**: [`CITATION.cff`](CITATION.cff)

---

## License

본 프로젝트는 [MIT License](LICENSE)에 따라 자유롭게 사용, 수정 및 배포할 수 있습니다.

---

## Privacy, Security & Disclosures

> **Local-First & Zero-Telemetry Disclosure**: Assistant Emily는 개발자가 운영하는 중간 프록시 서버나 원격 분석(Telemetry) 수집기를 일체 포함하지 않습니다. 모든 AI 요청은 사용자가 설정한 로컬 백엔드 또는 공식 API 엔드포인트로 직접 전송됩니다. 상세 내용은 [SECURITY.md](SECURITY.md)를 참조하십시오.
