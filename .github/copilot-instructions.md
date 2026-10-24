# Copilot & AI Coding Agent Instructions for Assistant Emily

You are assisting with development on the **Assistant Emily** repository (`assistant-emily` / `sparklings/emily`).
Follow these strict architectural, testing, and Obsidian Community Plugin policies:

## 1. Naming & Case Convention (Strict Policy)
- The formal project title in headings and documentation is **Assistant Emily**.
- The Obsidian Community Plugin ID and package name is strictly lowercase: `assistant-emily`.
- UI labels, setting titles, and button tooltips MUST use sentence casing per Obsidian Developer Guidelines (e.g. "Select target language", not "Select Target Language").

## 2. Lossless Syntax Masking Pipeline Invariants
- Never allow an LLM prompt or string transformation to alter Obsidian Flavored Markdown (OFM) syntax elements:
  - YAML Frontmatter (`--- ... ---`)
  - WikiLinks (`[[Note]]`, `[[Note|Alias]]`)
  - Tags (`#tag`, `#parent/child`)
  - Callout headers (`> [!NOTE]`)
  - LaTeX Math (`$...$`, `$$...$$`)
  - Code blocks and inline code
  - Obsidian highlights (`==text==`)
  - Task checkboxes (`- [ ]`, `- [x]`)
  - Private comments (`%%...%%`)
  - Block IDs (`^block-id`)
  - Footnote definitions (`[^1]:`)
  - Table of Contents chapter timestamps (`TOCTIME`: `- 0:00 Intro`)
  - Video and image embeds (`![](...)`, `![[...]]`)
- Always route markdown transformations through `MarkdownMasker.mask()` and restore them via `MarkdownMasker.restore()`.

## 3. Obsidian Markdown Self-Healing (`normalizeObsidianMarkdown`)
- After unmasking, always run `normalizeObsidianMarkdown` to guarantee:
  - Newline padding before and after headings (`#`–`######`).
  - Continuity of `>` prefixes across multi-line callouts.
  - Conversion of leaked HTML tags (`<br>`, `<b>`, `<strong>`, `<i>`, `<em>`, `<mark>`) into native Markdown and `==highlights==`.

## 4. Video Clipping & Section Partitioning Invariants
- For video clipping documents containing timestamps or `## Transcript`:
  - Pre-transcript metadata (video link, timestamps list, `Connect:`, `About`) MUST preserve line breaks 100%.
  - Table of contents timestamps like `0:00 Intro` MUST be formatted and preserved as list items (`- 0:00 Intro`).
  - Only the `## Transcript` body should undergo timestamp stripping and paragraph reflow (400–600 characters).
  - Video embed tags (`![](https://www.youtube.com/...)`) MUST be deterministically restored via `ensureVideoEmbedsPreserved`.
- General web clippings and news articles without subtitle timestamps MUST bypass timestamp pre-processing so original paragraphs remain intact.

## 5. Deployment Isolation Constraint
- The build script (`esbuild.config.mjs`) MUST strictly deploy only to `PlugVaults`.
- Deployment to `ObsidianVaults` is strictly prohibited.

## 6. Testing & Quality Verification
- All new features and fixes MUST be backed by test cases in `tests/integration_test.mjs`.
- Always run and pass `npm run check`, `npm run test` (all tests PASS), and `npm run build` before committing.
