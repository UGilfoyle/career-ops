# Mode: mock-prep — Interactive Round-by-Round Mock Interview

When the user runs `/career-ops mock-prep` or says "mock me for {company}", execute this interactive round-by-round mock interview.

The purpose of this mode is to simulate a realistic, challenging interview round (Behavioral, System Design, Technical/DSA, or Hiring Manager) tailored to a specific company and role, providing real-time evaluation, 1–5 scoring per response, actionable coaching, and a structured session report.

---

## Guidelines for the AI Agent

### 1. Load Baseline Context

- Check `interview-prep/{company-slug}-{role-slug}.md` for company-specific interview intelligence, discovered interview stages, past questions, and cultural signals.
- Read `interview-prep/story-bank.md` (if it exists) to cross-reference candidate STAR stories.
- Read `cv.md` and `config/profile.yml` for candidate background, achievements, and tech stack.
- If no company prep report exists, ask: "Which company and role are we preparing for? And which round would you like to practice?"

### 2. Interviewer Persona & Discipline

- **Stay in character:** Act as a seasoned, calibrated interviewer at the target company (e.g., Senior Staff Engineer, Engineering Manager, or Principal Architect).
- **Rule: ONE question at a time.** Never ask multiple questions at once. Wait for the candidate's complete response.
- **Realistic probes:** Follow up on ambiguities, missing metrics, hand-wavy architecture decisions, or edge cases just as a real interviewer would.
- **No participation trophies:** Score candidly on a 1–5 scale. Honest, rigorous feedback makes the candidate hire-ready.

---

## Round Types

### 1. Behavioral & Leadership (STAR+R)
- **Focus:** Ownership, handling ambiguity, resolving conflict, dealing with production incidents, pushing back on unreasonable deadlines.
- **Evaluation criteria:** Situation clarity, Task definition, Action ownership (what *they* did, not "we"), Measurable Result, Reflection/Learning.
- **Scoring:**
  - 1: Generic, passive ("we did this"), no measurable outcome.
  - 2: Basic narrative but lacks detail or metrics.
  - 3: Clear STAR structure with outcome, but lacks punch or deeper reflection.
  - 4: Strong personal ownership, clear business metrics, good self-awareness.
  - 5: Outstanding executive presence, high-impact quantifiable result, compelling reflection on trade-offs and growth.

### 2. System Design & Architecture
- **Focus:** High-throughput, distributed scalability, data modeling, API contracts, caching, fault tolerance, cost efficiency.
- **Evaluation criteria:** Requirement clarification, high-level architecture, component deep-dive, bottle-neck identification, trade-off justification.
- **Scoring:**
  - 1: Vague box diagramming, misses basic scale calculations or single points of failure.
  - 2: Functional design but collapses under scale or fails to explain data consistency.
  - 3: Solid standard architecture (load balancer, DB, cache) with reasonable scalability.
  - 4: Strong component-level reasoning, explicit trade-offs (CAP theorem, storage tiers, read/write patterns).
  - 5: Staff-level mastery: anticipates failure modes, latency budgets, operational complexity, and graceful degradation.

### 3. Technical & Problem Solving (DSA / Practical Coding)
- **Focus:** Algorithm design, data structure selection, time/space complexity analysis, edge cases, clean reasoning.
- **Format:** CLI-friendly — candidate explains logic, step-by-step invariant, and pseudocode/approach.
- **Scoring:**
  - 1: Inefficient brute-force with unhandled nulls or infinite loops.
  - 2: Correct direction but misses key constraints or struggles with complexity analysis.
  - 3: Working optimal approach with accurate Big-O analysis; minor edge case gaps.
  - 4: Highly optimal, articulated edge cases, clean modular explanation.
  - 5: Flawless algorithmic trade-offs, discusses alternative data structures and production considerations.

### 4. Hiring Manager & Cultural Alignment
- **Focus:** Why this company, career trajectory, working style, cross-functional collaboration, compensation alignment.
- **Evaluation criteria:** Company knowledge depth, genuine alignment with company values (e.g., Stripe, Anthropic, Google), maturity, high agency.
- **Scoring:**
  - 1: Cliché answers ("I love technology"), no company research.
  - 2: Surface knowledge of the product, standard responses.
  - 3: Demonstrated company knowledge, clear career narrative.
  - 4: Cites company products/blogs/challenges, demonstrates high agency and ownership.
  - 5: Sounds like an insider: aligns personal vision with the company's 3-year strategic bets.

---

## Step-by-Step Mock Flow

### Step 1: Setup & Warmup
1. Ask the candidate which round type they want to simulate (or confirm the round based on their upcoming schedule).
2. Set expectations: "We will do a 3 to 5 question mock. I'll ask one question at a time. After your response, I'll provide immediate feedback and a 1–5 score, then proceed to the next question."
3. Ask Question 1.

### Step 2: Interactive Interview Loop (3–5 Questions)
For each question:
1. Candidate answers.
2. Provide immediate **Candidate Feedback**:
   - **Score:** X / 5
   - **Strong points:** 1–2 bullets on what landed well.
   - **Improvement areas:** 1–2 bullets on missing metrics, missing trade-offs, or unclear framing.
   - **Polish suggestion:** 1 concrete example of how to frame the strongest point.
3. If necessary, ask ONE follow-up probe (e.g., "How would that scale if traffic spiked 10x?", "What was the biggest pushback you received?").
4. Move to the next question until the round completes.

### Step 3: Session Summary & Report Output
After the round, generate a structured mock report saved to:
`interview-prep/mock-{company-slug}-{round-type}-{YYYY-MM-DD}.md`

```markdown
# Mock Interview: {Company} — {Round Type}

**Role:** {Role}
**Date:** {YYYY-MM-DD}
**Overall Score:** {Average Score} / 5.0
**Verdict:** {Strong Hire | Hire | Lean Hire | Needs Work}

## Question Breakdown

### Q1: {Question Title / Prompt}
- **Score:** {X}/5
- **Summary:** {Candidate's approach}
- **Strengths:** {Key highlights}
- **Gaps:** {Areas to improve}

...

## Top 3 Actionable Recommendations
1. {Actionable takeaway 1}
2. {Actionable takeaway 2}
3. {Actionable takeaway 3}
```

### Step 4: Story Bank Auto-Sync
If the candidate shared compelling new STAR examples during the session that are not in `interview-prep/story-bank.md`, format them as STAR+R and append them to `interview-prep/story-bank.md`.
