# Chrome Web Store Metadata — Career-Ops Companion

This document tracks all the store listing details, permissions justifications, and privacy declarations required to publish the **Career-Ops Companion** extension.

* **Last Updated:** 2026-06-21
* **Target Version:** 1.0.0

---

## 1. Store Listing Details

### Product Name (Max 45 chars)
Career-Ops Companion

### Short Description (Max 150 chars)
Scrapes job details, checks match scores, and auto-fills application forms using your local career-ops profile.

### Detailed Description (Max 16,000 chars)
**Career-Ops Companion** is the browser extension companion for the open-source **career-ops** job search pipeline automation suite. 

Integrate your job hunting directly with your web browser. 

**Key Features:**
1. **Instant Fit Scores:** Open any job posting on LinkedIn, Greenhouse, Ashby, or Lever, and immediately see your personalized AI fit score directly in the extension panel.
2. **One-Click Auto-Fill:** Save time by auto-filling long application forms (First/Last name, email, phone, LinkedIn, GitHub, portfolio link, notice period, and salary targets) using your secure local profile.
3. **Trigger Scrapes & Tailoring:** Easily evaluate a job or queue a resume tailoring job (`agentic-tailor.mjs`) on your local backend directly from your active browser tab.
4. **Resume Upload Highlight:** Intelligently highlights file inputs for resumes/CVs so you never submit an application without your tailored PDF.

**Note:** This extension requires the local `career-ops` backend dashboard server running on your machine (`http://localhost:4242`).

---

## 2. Permissions & Justification

These are the permissions declared in `manifest.json` and must match the justifications provided in the Chrome Developer Console.

| Permission | Scope | Technical Justification |
|------------|-------|-------------------------|
| `activeTab` | Tab | Grants temporary access to the active job description page to scrape its URL, title, and body text for AI evaluation. |
| `scripting` | System | Required to inject the content script (`content.js`) into active application form pages to auto-fill inputs. |
| `storage` | Extension | Used to persist extension-specific preferences (such as dashboard URL configuration or user overrides). |
| `tabs` | Browser | Allows the extension to check if the current active tab's URL matches existing jobs in your local pipeline database. |
| `host_permissions: <all_urls>` | All websites | Job descriptions and application portals are hosted on thousands of custom corporate domains. Scopes `<all_urls>` are necessary to ensure form-filling functions on any custom careers portal. |

---

## 3. Privacy & Data Use

### Single Purpose
The extension's sole purpose is to scrape the current tab's job listing to fetch its match score from your local `career-ops` server and fill out form fields on that tab.

### Data Collection & Usage Disclosures
* **User Activity:** We read the URL and DOM content of the active tab to extract job specifications.
* **Personally Identifiable Info:** We read candidate details (name, email, phone, links) from your locally-hosted server to populate forms.
* **Storage Location:** All data remains on your local machine. No data is sent to external clouds or third parties (except direct communication to your own server at `http://localhost:4242`).
