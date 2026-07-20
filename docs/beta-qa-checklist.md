# Career-Ops Aug 1 Beta — QA Checklist

Manual gate for 3 beta accounts before calling the release ready.

## Env

- [ ] `NEXT_PUBLIC_BETA_MODE=1` on Vercel Production (shows Dashboard beta banner)
- [ ] GitHub OAuth signup works (open signup — no invite allowlist)
- [ ] Neon DB + auth session healthy

## Happy path (each tester)

1. [ ] Sign in with GitHub
2. [ ] Dashboard shows **Beta** banner + Launch Checklist
3. [ ] Open **Resume Studio** — empty state guides to Personal Info / import
4. [ ] Fill name + one experience role (or import PDF/DOCX)
5. [ ] Open **Templates** gallery — switch among Classic / Modern Compact / Technical / Minimal
6. [ ] Preview updates; reload page — selected `template_id` persists
7. [ ] Run **scan --deep** (PAT with `workflow` scope in Settings) → jobs appear in Pipeline
8. [ ] Evaluate or Tailor one job so `jd_text` is captured
9. [ ] In Studio, pick that job → honest/gap chips + **real ATS /100** within ~2s
10. [ ] Click **Tailor this job** → document lands in **Generated Docs**
11. [ ] From Generated Docs or Pipeline, **Open in Studio** → master | tailored review lite
12. [ ] Export HTML from Studio; PDF via deep tailor when available (HTML fallback OK on Vercel)

## Negative / empty states

- [ ] No jobs → Pipeline empty state offers Scan
- [ ] Job without JD → Studio panel says run Evaluate/Tailor
- [ ] Missing PAT → toast + Settings hint (not a raw stack dump)

## CI / deploy

- [ ] `main` CI green
- [ ] Vercel production deploy green after merge
