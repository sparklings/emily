# Assistant Emily

> Intelligent Markdown Proofreading, Context-Aware AI Translation, and Obsidian-Flavored Markdown (OFM) Autonomous Pair-Assistant for Desktop Obsidian.

The formal project name is **Assistant Emily**, and the Obsidian Community Plugin registration identifier is strictly lowercase `assistant-emily`.

`assistant-emily` is an enterprise-grade AI pair-assistant plugin engineered for researchers, technical authors, and knowledge workers in Obsidian desktop environments. Built on an explicit **Syntax Masking Pipeline**, it protects internal WikiLinks, hashtags, LaTeX formulas, callouts, and code blocks by isolating syntax tokens into placeholders prior to LLM processing, while delivering context-aware AI translation and proofreading.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Desktop Only](https://img.shields.io/badge/Platform-Desktop%20Only-orange.svg)]()
[![Obsidian: v1.7.2+](https://img.shields.io/badge/Obsidian-v1.7.2%2B-purple.svg)](https://obsidian.md)
[![Version: v1.1.0](https://img.shields.io/badge/Version-v1.1.1-green.svg)](CHANGELOG.md)
[![TypeScript: Strict Mode](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg)]()
[![Privacy: Direct Connection](https://img.shields.io/badge/Privacy-Direct%20Connection-success.svg)](SECURITY.md)

---

## Key Features

* **Markdown & OFM Syntax Token Masking**: Internal WikiLinks (`[[Note]]`), hashtags (`#tag`), LaTeX math (`$...$`), callouts (`> [!note]`), and chapter timestamps (`TOCTIME`) are isolated into dedicated placeholders prior to LLM processing to protect document structure and links.
* **Context-Aware Professional Translation & Tone Alignment**: Supports Full Document Translation (default), Selection-Scoped Translation, and Paragraph Bilingual Parallel Alignment (1:1 sentence comparison) with consistent tone rewrites (Academic, Polite, Friendly).
* **Video Clipping Note Partitioning & 1,800-Character Smart Chunking**: Retains Pre-Transcript metadata (video embeds, timestamps, contact lists) with original line breaks intact; only strips timestamps in subtitle transcripts and reflows fragmented speech into coherent paragraphs.
* **Device-Profile Provider Management**: Isolates endpoints and models (Ollama, LM Studio, FreeLLMAPI, OpenRouter, OpenAI) per machine UUID to eliminate cloud vault (OneDrive, iCloud, Obsidian Sync) configuration collisions.

---

## Documentation Hub

This project provides exhaustive technical documentation organized by domain and architecture. For deep-dive specifications, refer to the individual reports below:

| Domain / Architecture | Target File | Core Contents & Link |
| :--- | :--- | :--- |
| **System Architecture** | `src/core/*`<br>`src/api/*` | [System Architecture & Pipeline Specification](docs/architecture.md)<br>UI Sidecar layer, component data flow, single-responsibility principle |
| **Syntax Token Masking** | `src/core/markdownMasker.ts` | [Markdown & OFM Masking Technical Guide](docs/syntax-masking-pipeline.md)<br>10-element UUID token taxonomy, TOCTIME chapter locking, OFM self-healing |
| **Video Clipping & Chunking** | `src/core/markdownFormatter.ts`<br>`src/core/translationEngine.ts` | [Video Clipping Partitioning & Smart Chunking Guide](docs/video-clipping-and-chunking-guide.md)<br>Pre-transcript line break preservation, subtitle cleaning, 1,800-char chunking |
| **Device Profiles & Settings** | `src/ui/settingsTab.ts`<br>`src/api/llmProxyClient.ts` | [Device Profiles & Provider Endpoint Configuration Manual](docs/settings-and-provider-manual.md)<br>4-tab settings layout, device ID binding, Ollama & FreeLLMAPI setup |
| **FreeLLMAPI Integration** | `docs/freellmapi-guide.md` | [FreeLLMAPI Architecture & Deployment Guide](docs/freellmapi-guide.md)<br>34 free providers, 635 endpoints, ~7.4B tokens/mo, auto failover & self-hosting |
| **Troubleshooting & Diagnostics** | Repository-wide | [Troubleshooting & Diagnostics Guide](docs/troubleshooting.md)<br>Proxy 502 handling, token context overflow, cross-lingual leakage remedies |
| **Version History** | Repository-wide | [Changelog (CHANGELOG.md)](CHANGELOG.md)<br>Version release notes (v1.0.0 through v1.1.0) and 68 automated test cases |

---

## Quick Start

### 1) Plugin Installation
* **Via BRAT (Beta Reviewers Auto-update Tester)**: Add `sparklings/emily` in the BRAT plugin settings.
* **Manual Installation**: Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/sparklings/emily/releases/latest) and place them into your vault at `.obsidian/plugins/assistant-emily/`. Enable the plugin under Community Plugins.

### 2) AI Provider Configuration
Open Obsidian **Settings ➔ Assistant Emily ➔ AI Providers** and select your preferred backend:
* **Local Ollama**: Select preset (`http://127.0.0.1:11434/v1`, model: `qwen2.5:14b` or `llama3.2:3b`).
* **FreeLLMAPI**: Enter endpoint URL (`http://localhost:3001/v1`), unified key (`freellmapi-...`), and model `auto` (or `auto:smart`, `auto:fast`). See [FreeLLMAPI Guide](docs/freellmapi-guide.md).
* **OpenAI / OpenRouter**: Enter endpoint URL and API key, then click **[Test connection]** to verify online status.

### 3) Routine Operations
1. Click the magic wand icon (🪄) on the left ribbon to reveal the **Assistant Emily Sidebar**.
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

## Latest Release Information (v1.1.1)

* **TOC Chapter Timestamp Masking Lock (`TOCTIME`)**: Preserves chapter timestamps (`1:57 BEGINNER`) and formats them into structured bullet list items.
* **Video Clipping Note Section Partitioning**: Strictly preserves pre-transcript metadata line breaks while cleaning timestamps and reflowing subtitle paragraphs.
* **Deterministic Video Embed Restoration**: Deterministically re-injects video embed tags into output even if dropped by LLMs.
* **1,800-Character Smart Chunking & Resilience**: Guarantees complete document translation without fatal interrupts on lightweight models.
* **Responsive Live Status Header**: Automatically collapses the cancel button into a 22px compact icon in sidebars narrower than 380px.

For complete release details, see [CHANGELOG.md](CHANGELOG.md).

---

## System Requirements & Prerequisites

* **Obsidian**: v1.7.2 or higher (Desktop only)
* **Operating System**: Windows 10/11, macOS, Linux
* **AI Backend**: Local Ollama (`localhost:11434`), LM Studio (`localhost:1234`), or any OpenAI-compatible REST API endpoint

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

Assistant Emily는 옵시디언 데스크톱 환경에서 위키링크, 태그, 수식, 콜아웃 등 옵시디언 고유 문법 요소를 토큰 마스킹으로 보호하며 AI 번역과 교열을 수행하는 플러그인입니다. 상세한 한국어 튜토리얼과 기술 리포트는 [공식 웹사이트](https://sparklings.github.io/emily/) 및 [GitHub Wiki](https://github.com/sparklings/emily/wiki)에서 확인하실 수 있습니다.
