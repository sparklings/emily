# Security & Privacy Policy for Assistant Emily

## Supported Versions

| Version | Supported | Security & Maintenance Updates |
|---|---|---|
| 1.1.x | :white_check_mark: | Active support |
| 1.0.x | :white_check_mark: | Critical patches only |
| < 1.0 | :x: | End of life (deprecated) |

---

## Privacy, Security Architecture & Disclosures

**Assistant Emily** is designed under strict **Local-First & Zero-Telemetry Privacy Guarantees**:

### 1. Direct AI Communication (No Intermediate Proxies)
* Assistant Emily contains **no developer-operated telemetry servers or intermediate relay servers**.
* Network requests are dispatched exclusively and directly to the endpoint configured by the user in settings (e.g. `http://localhost:11434` for Ollama, `http://localhost:1234` for LM Studio, `https://api.openai.com/v1`, or a user-specified private proxy).
* API keys are stored exclusively in Obsidian's local vault plugin settings (`data.json`) and are never transmitted to any third party.

### 2. Vault File Access Boundary
* Assistant Emily only reads or modifies the markdown document currently opened and active in the user's workspace, or specifically selected in the sidebar.
* It does not crawl, scan, index, or upload unselected files or folders in your Obsidian vault.

### 3. Syntax Masking & Zero Content Loss
* Markdown links, tags, frontmatter, LaTeX math formulas, and code blocks are protected using client-side in-memory regex tokens before dispatch.
* No raw file metadata or file system paths outside the document are shared with the LLM.

---

## Reporting a Vulnerability

If you discover a security or privacy vulnerability in Assistant Emily, please **do NOT disclose it via public GitHub issues**.

Instead, report it responsibly via:
1. **GitHub Security Advisories**: Navigate to the **Security** tab of [sparklings/emily](https://github.com/sparklings/emily) and select **Report a vulnerability**.
2. Or contact the maintainers directly via repository security contacts.

Please include:
* Description of the vulnerability and security implications.
* Step-by-step reproduction instructions.
* Obsidian desktop version, OS environment, and plugin version.

Reports will be acknowledged within 48 hours with an estimated remediation plan.
