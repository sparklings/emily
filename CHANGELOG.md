# Changelog

All notable changes to the **Assistant Emily** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0a] - 2026-10-25

### Fixed
* **Community Plugin Review Compliance**:
  * Removed unnecessary escape character `\)` in regex character class (`[^)\n]+`) in `MarkdownFormatter.extractVideoEmbeds`.
  * Completely eliminated all 8 occurrences of `!important` in `styles.css` using mutually exclusive specificity selectors.
  * Overhauled `README.md` into comprehensive, professional English to comply with the Obsidian Community Plugin Directory English text requirements.

---

## [1.1.0] - 2026-10-24

### Added
* **TOC Chapter Timestamp Masking Lock (`TOCTIME`)**:
  * Implemented `__EMILY_TOCTIME_n__` immutable token masking in `MarkdownMasker` for table of contents chapter timestamps (e.g. `0:00 Intro`, `1:57 BEGINNER`, `25:17 Summary`).
  * Enforces bullet-list (`- `) item preservation, preventing LLMs from stripping times or collapsing chapter tables into a single line.
* **Intelligent Video Clipping Note Section Partitioning (`MarkdownFormatter`)**:
  * Segmented video clipping documents into Pre-Transcript Meta (title, video embed, timestamps, `Connect:`, `About`) and `## Transcript` body.
  * Preserves metadata and contact lines with 100% original line breaks.
  * Automatically detects general web clippings and news articles without subtitle timestamps, bypassing timestamp pre-processing to keep paragraphs intact.
* **Deterministic Video Embed Post-Restoration (`ensureVideoEmbedsPreserved`)**:
  * Deterministically extracts video embeds (`![](https://www.youtube.com/...)`, `<iframe...>`, player URLs) before translation and re-injects them into the translated document if the LLM drops them.
* **Korean Ratio & Untranslated English Block Interception**:
  * Validates translated chunks for untranslated English text (blocks >200 chars with >75% Latin characters) and executes self-healing retries.
* **Chinese Cross-Lingual Leakage Sanitization**:
  * Intercepts and transliterates leaked Chinese simplified tokens (e.g. `我们所拥有的` ➔ `우리가 가진 것`) caused by latent space cross-lingual leakage in multilingual LLMs.
* **Responsive Live Status Header UI/UX (Narrow Sidebar Compact Mode)**:
  * Automatically converts the live pipeline cancel button into a compact 22px icon-only button in narrow sidebars (<380px) to prevent layout overflows.
* **Obsidian Flavored Markdown (OFM) Self-Healing Normalizer (`normalizeObsidianMarkdown`)**:
  * Automatically ensures newline padding before and after headings (`#`–`######`).
  * Restores missing `>` quote prefixes in Obsidian callouts.
  * Transpiles leaked HTML tags (`<br>`, `<b>`, `<strong>`, `<i>`, `<em>`, `<mark>`) into native Markdown and Obsidian highlights (`==...==`).
* **Test Suite Expansion (TC-59 ~ TC-68)**:
  * Expanded automated integration test suite to 68 test cases covering OFM masking, video embed restoration, TOC protection, and responsive UI with 100% PASS rate.

### Changed
* **Graceful Translation Resilience & Fatal Error Elimination**:
  * Eliminated fatal error interrupts when using lightweight/free models (`dots-3-note-preview:free`, auto proxies), ensuring translations complete and output files are generated even if an individual chunk requires sanitization.
* **Smart Chunking Threshold Optimization**:
  * Optimized chunk size threshold from 2,500 to 1,800 characters to prevent token context truncation on small or free models.
* **Prompt Refinement & Echoing Prevention**:
  * Purged negative prompt examples that previously triggered prompt echoing/monologues in small LLMs, replacing them with direct positive translation directives.
* **Error Retry Button Visual Lockout**:
  * Immediately disables the retry button upon click, updates its label to `⏳ 재시작 진행 중...`, and displays a restart badge on the error header.
* **Default Translation Scope Optimization**:
  * Set "Full Document Translation (`all`)" as the default scope upon plugin initialization.

---

## [1.0.1] - 2026-10-18

### Added
* Selection-Scoped Proofreading (`replaceRange`) with real-time sidebar character count badge.
* Interactive Diff Review Modal using Needleman-Wunsch algorithm with checkbox approval.
* Code block comment-only translation toggle.
* Telemetry & detailed LLM resource usage collapsible badge in sidebar.

### Changed
* Refactored settings tab into 4 distinct sub-tabs (AI Providers, Translation, Proofreading & Formatting, General & UI).
* Added device-profile endpoint isolation for OneDrive/cloud vault synchronization.

---

## [1.0.0] - 2026-09-14

### Added
* Initial public release of Assistant Emily for Obsidian.
* Syntax Masking Pipeline for WikiLinks (`[[...]]`), Tags (`#tag`), LaTeX math (`$...$`), Callouts (`> [!NOTE]`), and Code Blocks.
* 3-tier translation scope: Full Document, Selection, and Paragraph Bilingual (1:1 Parallel Alignment).
* Tone (Academic, Polite, Friendly) and Style (Literal, Balanced, Free Natural) rewriting engine.
* Multi-provider OpenAI-compatible proxy and local LLM client support.
