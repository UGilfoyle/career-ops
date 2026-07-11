# Career-Ops System Achievements & Architecture (Last 6 Days)

This document maps out the system capabilities, optimizations, and stability fixes implemented in `career-ops` over the last 6 days.

---

## 1. AI Resume Tailoring Core (agentic-tailor.mjs)
We have optimized the resume generation engine to target a **90+ ATS Score** and handle diverse target company profiles:
* **Figma-Aligned Modern Template:** Standardized on `templates/ats-template-professional.html` for clean, single-column parsing in ATS platforms (Greenhouse, Workday, Ashby).
* **Target Company Categorization (GCC vs Services):**
  - **GCC Mode:** Highlights product ownership, global collaboration, scale, and long-term codebase accountability.
  - **IT Services Mode:** Highlights multi-project execution, client SLAs, client-facing communication, and adaptability.
* **100% Verbatim ATS Keyword Matching:** The LLM prompt enforces matching exact terminology from the Job Description (e.g. "PostgreSQL" vs "Postgres") to maximize search ranking scores.
* **Tenure Protection:** Automatically appends `(Contract)` to jobs with a tenure of less than 6 months to bypass job-hopper flags.
* **Strict Individual Ownership:** Directs the LLM to write bullet points using strong action verbs in the first-person singular ("I", not "We").

---

## 2. Interactive Dashboard Web UI (dashboard-v2)
We have transformed the dashboard into a premium Command Center matching Figma specifications:
* **Collapsible Sidebar:** Fits standard workflows with icon-only and expanded modes.
* **Generated Docs Section:** A centralized archive tab providing instant previews and downloads for all tailored PDFs and cover letters.
* **Figma Beige Design System:** Unified the palette, typography (Inter + JetBrains Mono), and cards.
* **Funnel Analytics & Kanban Board:** Integrated stages to track applications from `Evaluated` -> `Applied` -> `Interview` -> `Offer`.

---

## 3. Resilience, Diagnostics & Multi-LLM Chat
* **Sequential LLM Fallback Chain:** The Career Copilot chatbot (`/api/chat`) implements a robust cascade order, falling back to Gemini if DeepSeek fails or experiences rate limits.
* **JSON Parsing Safety:** Handles raw unescaped newlines in LLM outputs robustly.
* **Dispatch Debugging:** Prints detailed HTTP error codes and body text from the GitHub API if a manual tailoring trigger fails.
* **Defensive Settings Tab Rendering:** Applied optional chaining and fallbacks on the Settings tab inputs to prevent browser crashes (`TypeError: Cannot read properties of undefined (reading 'map')`) when loading a blank or newly synced profile.

---

## 4. Profile Syncing & Preserving Settings
* **Version Control Fact-Base:** Added `config/profile.yml` and `cv.md` to git tracking to serve as the local source of truth.
* **Safe Profile Merge:** Modified the startup auto-sync to **merge** the local profile fields with the existing database settings instead of replacing them. This prevents overwriting dashboard-specific parameters like `github_settings.pat` (GitHub Personal Access Token) and `openai_key`.
