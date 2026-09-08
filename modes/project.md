# Mode: project — Portfolio & Exposure Project Engineering

When the user runs `/career-ops project`, execute one of two flows:
1. **Flow A: Project Evaluation** — Evaluate an existing project idea or repository URL using the 6-dimension scoring matrix.
2. **Flow B: Exposure Project Scaffolding** — Generate a production-grade, verifiable proof-of-work project blueprint tailored to eliminate candidate skill gaps identified in job evaluations.

---

## Flow A: Portfolio Project Evaluation

Used when the user provides a project link, repository, or concept for feedback.

**URL:** {project-url}  
**Legitimacy:** {High Confidence | Proceed with Caution | Suspicious}

Scoring matrix with 6 dimensions (1–5):

| Dimension | Weight | 5 = ... | 1 = ... |
|-----------|------|---------|---------|
| Signal for target roles | 25% | Directly demonstrates JD skill | Not related |
| Uniqueness | 20% | Nobody has done this / novel twist | Very common / tutorial clone |
| Demo ability | 20% | Live demo in 2 min (clean CLI or UI) | Code only, hard to run |
| Metrics potential | 15% | Clear metrics (latency, throughput, cost) | No measurable metrics |
| Time to MVP | 10% | 1 week to functional baseline | 3+ months |
| STAR story potential | 10% | Rich narrative with trade-offs | Implementation only |

### "Interview Pack" Requirements
For each approved project:
1. **One-pager**: product + architecture + metrics + evaluation plan
2. **Demo**: live URL or 2 min recorded walkthrough
3. **Postmortem**: what worked, what didn’t, mitigations

### 80/20 Plan
- Week 1 → MVP with core metric
- Week 2 → polish + interview pack

### Verdicts
- **BUILD** → plan with weekly milestones
- **SKIP** → why and what to do instead
- **PIVOT TO [alternative]** → more impactful variant

---

## Flow B: Exposure Project Scaffolding (Proof of Work)

Triggered by `/career-ops project scaffold {role or tech}` or when the user asks for a project to fill a specific skill gap from an evaluation report.

SkillMeet-style **Exposure** replaces vague resume bullet points with concrete, benchmarked repositories that prove architectural competence.

### Step 1: Identify Target Skill Gap
- Inspect recent evaluation reports in `reports/` or the target role archetypes in `modes/_profile.md`.
- Identify the highest-weight missing requirement (e.g. Distributed Caching, Kafka Event Streaming, Vector Search / RAG latency, High-Concurrency WebSockets, Transactional Outbox).

### Step 2: Formulate Exposure Blueprint
Generate a structured project spec saved to `interview-prep/exposure-{project-slug}.md`:

```markdown
# Exposure Project: {Project Name}

**Target Role / Archetype:** {Role}  
**Primary Skill Gap Addressed:** {Key Technology or Concept}  
**Target SLA / Benchmark:** {e.g. p99 < 15ms @ 10,000 req/sec}

---

## 1. System Architecture & Core Workflow
- **Component Breakdown:** {Services, storage, queue, worker}
- **Data Flow:** {Step-by-step request lifecycle}
- **Key Architectural Trade-Off:** {e.g. At-least-once vs exactly-once delivery, memory vs query latency}

## 2. Measurable Benchmark Targets
- **Baseline Metric:** {Unoptimized performance, e.g. 850 req/sec}
- **Optimized Metric:** {Target performance after pooling/batching/caching, e.g. 8,200 req/sec}
- **Resource Constraints:** {e.g. 1 vCPU, 512MB RAM}

## 3. Minimal Repository Layout
```
├── src/               # Clean modular implementation
├── benchmarks/        # Reproducible load test (k6, autocannon, or Go test)
├── docker-compose.yml # 1-command reproducible local setup
└── README.md          # Architecture diagram + benchmark summary table
```

## 4. Verifiable Proof-of-Work Checklist
- [ ] Architecture diagram explaining component boundaries
- [ ] Reproducible benchmark script with single command (`npm run bench` or `make bench`)
- [ ] Published benchmark results table in README
- [ ] Chaos / Failure mode test (graceful degradation when downstream is down)

## 5. STAR+R Interview Narrative
- **Situation:** Simulated high-throughput bottleneck or distributed consistency challenge.
- **Task:** Build a resilient subsystem meeting strict SLA requirements under tight compute bounds.
- **Action:** Implemented {specific architectural choice} with explicit trade-offs.
- **Result:** Achieved {quantified metric: latency reduction / throughput increase}.
- **Reflection:** Key production gotchas (connection saturation, cache stampede) and next-step scaling.
```

### Step 3: Story Bank Auto-Sync
Automatically extract the **STAR+R Interview Narrative** from Section 5 and append it to `interview-prep/story-bank.md` under a new section `### Project Proof: {Project Name}` so the user can directly reference it during interviews.
