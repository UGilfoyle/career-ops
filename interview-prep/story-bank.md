# Story Bank Ã¢ÂÂ Master STAR+R Stories

This file accumulates your best interview stories over time. Each evaluation (Block F) adds new stories here. Instead of memorizing 100 answers, maintain 5-10 deep stories that you can bend to answer almost any behavioral question.

## How it works

1. Every time `/career-ops oferta` generates Block F (Interview Plan), new STAR+R stories get appended here
2. Before your next interview, review this file Ã¢ÂÂ your stories are already organized by theme
3. The "Big Three" questions can be answered with stories from this bank:
   - "Tell me about yourself" Ã¢ÂÂ combine 2-3 stories into a narrative
   - "Tell me about your most impactful project" Ã¢ÂÂ pick your highest-impact story
   - "Tell me about a conflict you resolved" Ã¢ÂÂ find a story with a Reflection

## Stories

<!-- Stories will be added here as you evaluate offers -->
<!-- Format:
### [Theme] Story Title
**Source:** Report #NNN Ã¢ÂÂ Company Ã¢ÂÂ Role
**S (Situation):** ...
**T (Task):** ...
**A (Action):** ...
**R (Result):** ...
**Reflection:** What I learned / what I'd do differently
**Best for questions about:** [list of question types this story answers]
-->

```json
{
  "title": "Resolving 1 Million Consumer Lag via In-Memory Channel Decoupling",
  "metrics": "Consumer lag dropped 1,000,000 -> 0 messages | DB write latency decoupled from ingestion path",
  "starStory": "### [Event-Driven Architecture / Performance Optimization] Decoupling DB Writes to Eliminate 1M Consumer Lag\n**Date:** 2026-09-17 â Production Incident\n**S (Situation):** During peak operations, consumer lag accumulated to over 1,000,000 messages because synchronous auto-commit database writes slowed down the ingestion pipeline.\n**T (Task):** Decouple database write latency from message ingestion to clear the 1,000,000 message lag

### [Mock Drill: ⚙️ Core Backend & Systems] Explain the difference between Stack memory and Heap memory ...
**Date:** 2026-09-17 — Mock Interview Practice
**Question:** Explain the difference between Stack memory and Heap memory in programming. What actually causes a Memory Leak in a long-running backend service?

🎯 Mock Interview Evaluation
📌 Track: ⚙️ Core Backend & Systems | 🟢 Level 1: Ground Zero Basics
⭐ Score: 1.0 / 10

✅ What You Nailed:
• Attempted to associate stack memory with execution ordering principles.
• Recognized your limit on memory leaks and admitted a gap rather than fabricating a completely incorrect theory.

⚠️ Gaps & Misconceptions:
• Fundamentally Confused Stack Mechanics: Stacks are strictly LIFO (Last-In, First-Out). Stating FIFO (First-In, First-Out) demonstrates a basic misunderstanding of call stacks and execution frames.
• Inaccurate Heap Description: Heap memory is not an "algorithm heap stack." It is an unorganized memory pool used for dynamic allocation, managed by memory allocators, runtime engines, or Garbage Collectors.
• Unanswered Core Question: You provided zero explanation for memory leaks in backend services, which is a foundational requirement for any backend systems role.

🏆 Gold Standard Model Answer (The 30-Second Perfect Pitch):
• 1: Stack memory is thread-local, contiguous memory operating strictly on a LIFO structure for ultra-fast allocation of stack frames and local variables, whereas Heap memory is a shared dynamic pool used for objects whose lifecycle outlives the scope of a single function call.
• 2: Stack frames are automatically reclaimed when functions return, while Heap memory requires explicit deallocation or automatic Garbage Collection to reclaim unreferenced objects.
• 3: A memory leak occurs in a backend service when heap-allocated objects retain active root references (such as static collections, unclosed connections, or unbounded caches) long after they are no longer needed, preventing memory reclamation and eventually causing an Out-Of-Memory crash.
