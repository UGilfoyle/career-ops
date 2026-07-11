# Mode: contacto -- LinkedIn Power Move + GCC Curated Outreach

> Apply `voice-dna.md` (if present) to every generated message — full guardrail, conversational voice included (Tier 1 + Tier 2). See `_shared.md` → Voice DNA.
> For GCC targets, also read `modes/gcc.md`. Prefer **curated email or value DM** over blind "Apply Now".

1. **Identify targets** via WebSearch:
   - Hiring manager of the team
   - Assigned recruiter
   - 2-3 team peers (people with similar roles)
   - Interviewer (if the candidate already has a scheduled interview)

2. **Classify contact type** -- ask the candidate or infer from context:
   - **Recruiter** -- person whose role is talent acquisition, sourcing, or recruiting
   - **Hiring Manager** -- the person who leads the hiring team
   - **Peer** -- someone with a similar role in the team (indirect referral)
   - **Interviewer** -- someone who will interview the candidate (known date)

3. **Select primary target**: the person who would benefit most from the candidate being there

4. **Generate message** with a 3-sentence framework adapted to the contact type:

   ### Recruiter
   - **Sentence 1 (Fit)**: Direct match criteria -- role, relevant experience, availability, or location
   - **Sentence 2 (Proof)**: Data that answers their screening questions before they ask them (e.g., "5 years building ML pipelines, currently in Berlin, available immediately")
   - **Sentence 3 (CTA)**: "Happy to share my CV if this aligns with what you're looking for"

   ### Hiring Manager
   - **Sentence 1 (Hook)**: Specific challenge their team is facing (extracted from the JD, company blog, or news)
   - **Sentence 2 (Proof)**: Candidate's greatest quantifiable achievement showing they have solved similar problems
   - **Sentence 3 (CTA)**: "Would love to hear how your team is approaching [specific challenge]"

   ### Peer (referral)
   - **Sentence 1 (Interest)**: Genuine reference to their work -- blog post, talk, open-source project, or publication
   - **Sentence 2 (Connection)**: Something the candidate is doing in the same space (NOT a job pitch)
   - **Sentence 3 (CTA)**: "I've been working on similar problems at [company], would love to hear your take on [topic]"
   - **Note**: DO NOT ask for a job. The referral happens naturally if the conversation flows.

   ### Interviewer (pre-interview)
   - **Sentence 1 (Research)**: Reference to something specific from their work or trajectory
   - **Sentence 2 (Context)**: Light connection to the candidate's experience in that area
   - **Sentence 3 (CTA)**: "Looking forward to our conversation on [date]"
   - **Note**: Light tone, not desperate. The goal is to show that you prepared.

5. **Versions**:
   - EN (default)
   - ES (if Spanish company)

6. **Alternative targets** with justification for why they are good second choices

## GCC curated email (preferred over Apply Now for high-value GCC targets)

When `classifyCompany(company) === 'GCC'` or Block H score ≥ 3, generate a **curated email** in addition to LinkedIn options.

**Subject line:** `{Role} — {specific problem from JD you can solve}`

**Body structure (4 short paragraphs, <150 words total):**

1. **Hook** — Reference company's platform/initiative from JD or recent news (1 sentence)
2. **PAR proof** — Problem you faced → Action you took → Quantified result (from cv.md, use **I** not **we**)
3. **Fit bridge** — Map one JD requirement to your proof (1 sentence)
4. **CTA** — "I'd welcome 15 minutes to discuss how this maps to {team/initiative}." No desperation.

**Example:**

```
Subject: Senior Backend Engineer — payment reliability at scale

Hi {name},

{Company}'s focus on platform reliability for {JD theme} caught my attention.

At {past company}, payment failures were causing revenue leakage. I redesigned retry logic and monitoring. Failure rate dropped 42%.

That maps directly to your requirement for {JD skill/requirement}.

I'd welcome 15 minutes to discuss how this experience fits your team.

{Candidate name}
```

**Rules for email:**
- Never use "Apply Now" language — this is a direct outreach, not a portal submission
- No buzzwords: passionate, synergies, leverage, robust
- NEVER share phone number in the email body
- Personalize `{name}` from WebSearch (recruiter or hiring manager)
- If email address unknown, note: "Find via LinkedIn + prospecting tools; draft ready to send"

## GCC value DM (LinkedIn, ≤80 words)

For connection requests or InMail when email is unavailable:

> Hi {name} — I saw {company} scaling its {team/platform} in India. I {specific proof with metric}. If useful, happy to share how I approached {problem from JD}. No ask beyond a quick perspective.

**Message rules (LinkedIn):**
- Maximum 300 characters (LinkedIn connection request limit)
- NO corporate-speak
- NO "I'm passionate about..."
- Something that makes them want to respond
- NEVER share phone number
- The contact type changes the EMPHASIS, not the structure
