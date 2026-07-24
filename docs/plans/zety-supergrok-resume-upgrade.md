# SuperGrok + Zety Hybrid Resume Upgrade

**Goal:** Raise offline + LLM-gated resume output to professional resume-builder quality (Zety bar) without inventing employers/metrics.

## Gaps vs Zety

| Area | Current | Target |
|------|---------|--------|
| Bullets | Fragments, repeated verbs, synthetic metrics chase 90+ | Capitalized complete sentences, unique strong verbs, metrics only from profile |
| Summary | Formulaic 3-line template | 3–4 tight lines, JD tech named, senior tone, no clichés |
| Competencies | Flat list, sometimes sparse/junk | Rich JD-matched Core + Technical rows, no "Software"/"applications" |
| Template | Plain Arial ATS dump | Clean hierarchy, spacing, subtle navy accent — ATS-safe, not purple AI slop |
| Offline vs LLM | Offline overwrites LLM; quality ceiling = templates | Offline polish ≈ LLM quality; LLM draft still honesty-gated |
| Dual scripts | Root / dashboard `agentic-tailor.mjs` diverge | Keep in sync on tailor + polish opts |

## Architecture (extend, don't rewrite)

```
JD text
  → jd-keyword-align (extract + light weave)
  → jd-profile-match (Zety summary + rich competencies + honest reframe)
  → resume-quality (deterministic polish: verbs, graft-only metrics, casing)
  → resume-alignment-validator (honesty gate)
  → templates / ats-professional-template.ts → HTML → PDF
```

**Modules to touch**

1. `jd-profile-match.mjs` — `buildHonestSummary`, `buildJdMatchedCompetencies`, `enhanceBulletHonest`
2. `resume-quality.mjs` — default `allowSyntheticMetrics: false`, completeness polish, ATS score rebalance
3. `jd-keyword-align.mjs` — summary weave polish (no "Tech stack:" spam line when avoidable)
4. `templates/ats-template-*.html` + `dashboard-v2/src/lib/resume/ats-professional-template.ts` — visual polish
5. `agentic-tailor.mjs` + `dashboard-v2/scripts/agentic-tailor.mjs` — sync polish opts / role counts
6. Tests: `resume-quality-tests.mjs`, `test-jd-honest-match.mjs`, wire into `test-all.mjs`

## Acceptance

- Every bullet: Capitalized, ends with `.`, unique leading verbs, quantified only when profile has metrics
- Summary: 3–4 lines, JD tech present, no "passionate about" / "results-oriented"
- Competencies ≥10 when JD has tech; no junk tokens
- Template: clearer hierarchy + spacing; navy accent OK; no purple gradients
- `node resume-quality-tests.mjs` + `node test-jd-honest-match.mjs` + `simulate-jd-align` pass
- Honesty: no invented employers/metrics; skills may mirror JD for ATS (existing policy)

## Out of scope

- Editing `cv.md` / user profile data
- Full LLM rewrite replacing offline builders
- Purple / glow / multi-column ATS-hostile layouts
