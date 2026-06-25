# Setup Guide

## Prerequisites

- An AI coding CLI — [Claude Code](https://claude.ai/code), Gemini CLI, Codex, Qwen Code, OpenCode or GitHub Copilot CLI
- [Node.js](https://nodejs.org) 18+ and `git` (`npx` ships with Node — the installer refuses to run without them) — note: the Gemini CLI integration requires Node.js 20+
- (Optional) Go 1.21+ (for the dashboard TUI)

## Quick Start

To set up the system:

```bash
git clone https://github.com/UGilfoyle/career-ops.git
cd career-ops
npm install
```

Then open your AI CLI in the folder — the first-run onboarding applies. Use this path to track your branch, customize, or audit the code before installing dependencies.

### PDF rendering (one-time)

PDFs are rendered with a headless Chromium. Install it once per machine:

```bash
npx playwright install chromium
```

## Available Commands

| Action | How |
|--------|-----|
| Evaluate an offer | Paste a URL or JD text |
| Search for offers | `/career-ops scan` |
| Process pending URLs | `/career-ops pipeline` |
| Generate a PDF | `/career-ops pdf` |
| Batch evaluate | `/career-ops batch` |
| Check tracker status | `/career-ops tracker` |
| Fill application form | `/career-ops apply` |

## Verify Setup

```bash
node cv-sync-check.mjs      # Check configuration
node verify-pipeline.mjs     # Check pipeline integrity
```

## Build Dashboard (Optional)

```bash
cd dashboard
go build -o career-dashboard .
./career-dashboard --path ..  # Opens TUI pipeline viewer
```
