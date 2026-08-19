# Akash — AI + DSA study tracker (4 weeks)

Living checklist. Full lessons come from Gemini Pro using [`gemini-ai-dsa-handbook-prompt.md`](./gemini-ai-dsa-handbook-prompt.md) — charts/mermaid + whiteboard images, not text walls. If Gemini dumps paragraphs, paste the **visuals follow-up** at the bottom of that file (same chat).

**Dashboard:** Interview Practice tab → copy the same Gemini prompt, then generate a **JD pack** for the company you are targeting this week. Handbook = concepts. Pack = that job’s coding / design / STAR.

**Stories:** [`story-bank.md`](./story-bank.md) — do not invent metrics; only `cv.md` / `config/profile.yml`.

Daily block (85 min): 25 concept · 35 problems · 15 speak-aloud · 10 flashcards.

## How the two tools split

| Need | Use |
|------|-----|
| Easy DSA + AI concepts in Hindi-first | Gemini handbook from the prompt file |
| Timed coding in the editor | Interview Practice → Generate pack |
| Company-specific rounds | `/career-ops interview-prep` + this tracker |
| Behavioral | Story bank + pack STAR section |

## Week 1 — Foundations

- [ ] DSA A–E: complexity, arrays/strings, hash maps, two pointers / sliding window, stack/queue
- [ ] AI: tokens, embeddings, RAG retrieve→generate, when Postgres vs Chroma
- [ ] Design warmup: rate limit / API gateway
- [ ] Interview Practice pack for **one** real pipeline JD
- [ ] Sunday mock (45m DSA + 20m RAG talk)

## Week 2 — Trees, graphs, retrieval

- [ ] Trees/BST, graphs BFS/DFS, heaps / Top-K
- [ ] Chunking, overlap, evals, “did retrieval even work?”
- [ ] Design: chat with company PDFs (citations + streaming)
- [ ] New JD pack if the target company changed
- [ ] Sunday mock

## Week 3 — Search + LLM proxy

- [ ] Binary search (including on answer), intervals, LRU ↔ Redis, DP start (6 patterns only)
- [ ] Design: multi-model proxy (timeouts, Anthropic→OpenAI→Llama fallback, budget)
- [ ] Design: keyword + vector + rerank
- [ ] Three spoken mocks
- [ ] Sunday mock

## Week 4 — Mocks

- [ ] Weak-topic drill only (no new rabbit holes)
- [ ] Four timed mocks: DSA 45m + design 45m + AI concepts 20m
- [ ] STAR: conflict, incident, mentoring, “no” to a bad LLM feature — from story bank
- [ ] Honest gaps: CUDA / training from scratch → “not my lane; here’s how I’d partner with ML”

## Day 1 (do this before Gemini finishes the book)

1. Copy the prompt (dashboard or the `.md` file) into Gemini Pro.
2. Read Part 0 + embeddings/RAG section only.
3. Hash map: explain in Hindi out loud, then write `groupAnagrams` in TypeScript in Interview Practice editor (or a scratch file).
4. Tick Week 1 boxes you actually finished. Do not tick ahead.

## Notes

<!-- Date — what clicked / what blanked -->
