# Assistant Emily

> Intelligent Markdown Proofreading, Context-Aware AI Translation, and Obsidian-Flavored Markdown (OFM) Autonomous Pair-Assistant for Desktop Obsidian.

The formal project name is **Assistant Emily**, and the Obsidian Community Plugin registration identifier is strictly lowercase `assistant-emily`.

`assistant-emily` is an enterprise-grade AI pair-assistant plugin engineered for researchers, technical authors, and knowledge workers in Obsidian desktop environments. Built on an explicit **Syntax Masking Pipeline**, it protects internal WikiLinks, hashtags, LaTeX formulas, callouts, and code blocks by isolating syntax tokens into placeholders prior to LLM processing, while delivering context-aware AI translation and proofreading.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Desktop Only](https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg)]()
[![Obsidian: v1.7.2+](https://img.shields.io/badge/Obsidian-v1.7.2%2B-purple.svg)](https://obsidian.md)
[![Version: v1.1.2](https://img.shields.io/badge/Version-v1.1.2-green.svg)](CHANGELOG.md)
[![TypeScript: Strict Mode](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg)]()
[![Privacy: Direct Connection](https://img.shields.io/badge/Privacy-Direct%20Connection-success.svg)](SECURITY.md)

---

## Key Features

* **Markdown & OFM Syntax Token Masking**: Internal WikiLinks (`[[Note]]`), hashtags (`#tag`), LaTeX math (`$...$`), callouts (`> [!note]`), and chapter timestamps (`TOCTIME`) are isolated into dedicated placeholders prior to LLM processing to protect document structure and links.
* **Context-Aware Professional Translation & Tone Alignment**: Supports Full Document Translation (default), Selection-Scoped Translation, and Paragraph Bilingual Parallel Alignment (1:1 sentence comparison) with consistent tone rewrites (Academic, Polite, Friendly).
* **Video Clipping Note Partitioning & 1,800-Character Smart Chunking**: Retains Pre-Transcript metadata (video embeds, timestamps, contact lists) with original line breaks intact; only strips timestamps in subtitle transcripts and reflows fragmented speech into coherent paragraphs.
* **FreeLLMAPI & Device-Profile Management**: Built exclusively for **FreeLLMAPI** (34+ free providers, 635 endpoints, ~7.4B tokens/month) with isolated machine-level device profiles to eliminate cloud vault (OneDrive, iCloud, Obsidian Sync) configuration collisions.

---

## Documentation Hub

Assistant Emily provides comprehensive, step-by-step user manuals and technical guides in the [`/docs`](docs/README.md) directory and the [GitHub Wiki](https://github.com/sparklings/emily/wiki).

| Part | User Manual / Technical Guide | Core Contents & Link |
| :--- | :--- | :--- |
| **Part 1** | [Quick Start & Installation](docs/01-quick-start.md) | 3-minute setup, community plugin installation, hotkey and context menu translation |
| **Part 2** | [FreeLLMAPI & Device Profiles](docs/02-ai-providers-setup.md) | FreeLLMAPI integration, model selection, and isolated multi-device profiles |
| **Part 3** | [Smart Translation & Hotkeys](docs/03-translation-and-hotkeys.md) | Selection append, 1,800-char chunking, 1:1 paragraph bilingual matching, cancel support |
| **Part 4** | [Proofreading & Live Diff Review](docs/04-proofreading-and-diff-review.md) | Spelling, grammar, context refinement, interactive diff review, and live document sync |
| **Part 5** | [Video Clipping & Transcripts](docs/05-video-clipping-and-transcripts.md) | Pre-transcript metadata lock, subtitle cleaning, H3 sub-titles, STT disambiguation |
| **Part 6** | [OFM Syntax Masking & Safety](docs/06-syntax-masking-and-safety.md) | 10-element UUID token taxonomy, TOCTIME chapter locking, OFM self-healing |
| **Part 7** | [Troubleshooting & FAQ](docs/07-troubleshooting.md) | Diagnostics, 502/413 error remedies, hotkey customization, and frequently asked questions |
| **Tech 1** | [FreeLLMAPI Architecture & Integration](docs/freellmapi-technical-guide.md) | 34 provider & 635 endpoint architecture analysis, fallback routing |
| **Tech 2** | [OFM Syntax Masking Pipeline](docs/markdown-syntax-masking-pipeline-technical-guide.md) | Regex UUID token taxonomy, token preservation, self-healing normalization |
| **Index** | [Documentation Hub (README.md)](docs/README.md) | Complete documentation index, reading roadmap, and architecture overview |

---

## Quick Start

### 1) Plugin Installation
Assistant Emily is officially released on the [Obsidian Community Plugins Directory](https://community.obsidian.md/plugins/assistant-emily):
1. In Obsidian, open **Settings ➔ Community plugins**.
2. Ensure **Restricted mode** is disabled, then click **Browse**.
3. Search for **Assistant Emily** and click **Install**, then click **Enable**.

### 2) FreeLLMAPI Configuration
Open Obsidian **Settings ➔ Assistant Emily ➔ AI Providers**:
* **API Base URL**: `https://api.freellmapi.com/v1` (or local instance `http://localhost:3000/v1`)
* **API Key**: Enter your FreeLLMAPI key (`flm_...`)
* **Model**: Enter your preferred model (e.g. `dots-3-note-preview:free`, `gemini-2.5-flash`, `deepseek-chat`)
* Click **[Test connection]** to verify online status.

### 3) Routine Operations
1. Click the sparkles icon (✨) on the left ribbon to reveal the **Assistant Emily Sidebar**.
2. Toggle translation on and select your scope (`Full document`, `Selection only`, `Paragraph bilingual`).
3. Click **[🚀 Start task]** to execute the pipeline with real-time timeline telemetry and restored markdown output.

---

## Quick Feature Reference

| Category | Supported Modes / Options | Description & Key Invariants |
| :--- | :--- | :--- |
| **Translation Scope** | `Full document (all)` | Completely translates H1~H6 headings and body text (default) |
| | `Selection only (selection)` | Atomically translates only the highlighted text block via `replaceRange` |
| | `Paragraph bilingual (bilingual)` | Pairs original paragraphs with translated paragraphs 1:1 for study and review |
| **Proofreading Tools** | `Spelling check` | Detects and fixes spelling typos and orthographic mistakes |
| | `Grammar check` | Resolves subject-predicate mismatches, passive voice, and postposition errors |
| | `Strip timestamps` | Cleans residual subtitle timestamps from video clipping notes |
| **Tone & Style** | `Academic` / `Polite` / `Friendly` | Unifies sentence endings and stylistic registers across the entire document |
| **OFM Normalization** | `Heading newline padding` | Automatically guarantees blank lines around headings (`#`–`######`) |
| | `Callout continuity` | Restores missing `>` quote prefixes across multi-line Obsidian callouts |

---

## Latest Release Information (v1.1.2)

* **Community Plugin Security & Native Hotkey Compliance**: Fully integrated with Obsidian's native `addCommand` system (customizable in Hotkeys settings) and editor context menu (`editor-menu`), removing rogue global DOM listeners with zero default hotkey conflicts.
* **Synchronized Live Pipeline & User Cancellation**: Quick translation immediately activates the sidebar's live progress box, elapsed timer, and Cancel (`❌`) button via `AbortController`, with automatic inline placeholder rollback upon cancellation.
* **Live In-Place Document Replacement**: Edits saved in the Translation Diff Review Modal (`TranslationDiffModal`) are immediately reflected directly in the active Markdown editor and synchronized across sidebar session history.
* **Audio Transcript STT Disambiguation**: Prevents and auto-heals number concatenation distortion in speech-to-text transcripts (e.g., `101 13 lessons` ➔ `101: 13 lessons`).
* **Minimalist UI Refinement**: Eliminated redundant information icons and tooltip collisions to provide a clean, professional sidebar interface.

For complete release details, see [CHANGELOG.md](CHANGELOG.md).

---

## System Requirements & Prerequisites

* **Obsidian**: v1.7.2 or higher (Desktop only)
* **Operating System**: Windows 10/11, macOS, Linux
* **AI Backend**: FreeLLMAPI (`https://api.freellmapi.com/v1`)

---

## LLM & AI Agent Indexing (AI Ingestion)

* **Summary Specification**: [`llms.txt`](llms.txt) and [`docs/llms.txt`](docs/llms.txt)
* **Full Architecture Specification**: [`llms-full.txt`](llms-full.txt)
* **AI Coding Agent Rules**: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
* **Software Citation**: [`CITATION.cff`](CITATION.cff)

---

## Privacy, Security & Disclosures

> **Local-First & Zero-Telemetry Disclosure**: Assistant Emily does not operate intermediate relay servers, collection telemetry, or third-party analytical trackers. All network communication is dispatched directly to the local or cloud endpoint specified in user settings. For details, consult [SECURITY.md](SECURITY.md).

---

## License

Assistant Emily is open-source software licensed under the [MIT License](LICENSE).

---

## 🇰🇷 한국어 요약 안내 (Korean Summary)

Assistant Emily는 옵시디언 데스크톱 환경에서 위키링크, 태그, 수식, 콜아웃 등 옵시디언 고유 문법 요소를 토큰 마스킹으로 보호하며 AI 번역과 교열을 수행하는 공식 커뮤니티 플러그인입니다. FreeLLMAPI 전용으로 설계되어 34개 이상의 무료 LLM(월 74억 토큰)을 완전 무료로 제공합니다. 단계별 한국어 사용자 매뉴얼 및 가이드는 [/docs 문서 모음](docs/README.md) 및 [GitHub Wiki](https://github.com/sparklings/emily/wiki)에서 확인하실 수 있습니다.
