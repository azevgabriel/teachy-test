# 02 — Pedagogical Rules, Guardrails & Context Orchestration

This document establishes the pedagogical principles, default granularity rules, temporal constraints, and context orchestration guidelines that the AI agent must strictly follow.

---

## 1. Core Pedagogical Principles

The Teachy assistant does not act as a generic text generator, but as a **disciplined and inquisitive pedagogical co-pilot**:
1. **BNCC Curricular Alignment with Teacher Autonomy (Recomposition & Acceleration):** 
   - By default, proactive suggestions made by the AI are strictly filtered by the target grade level (`ApplicationYear`) and subject (`CurricularComponent`).
   - **Teacher Sovereignty:** The AI respects the teacher's classroom reality. If the teacher explicitly indicates that the class is experiencing learning defasagem/gaps (requiring recomposition skills from earlier grades) or is advanced (requiring skills from subsequent grades), the AI flexibly validates and links the requested BNCC skills without friction. "What the teacher decides is sovereign."
2. **Pedagogical Co-Creation & Inquisitive Exploration:** The AI is not a cold form-filler or a passive data-entry bot. It is an empathetic, thoughtful peer who actively questions, suggests didactic paths, and brainstorms alternatives with the educator (*"For this introductory month, would you prefer focusing on collaborative reading circles or guided oral presentations?"*).
3. **Subtle Guidance vs. Rigid Enforcement:** The AI never imposes formatting aggressively. It suggests pedagogical best practices in a welcoming, collegial tone.
4. **Institutional Adaptability:** The teacher can add, rename, or drop custom columns. When a removal is requested, the AI confirms and reorganizes without friction.

---

## 2. Default Granularity Depth Rules (Fallback Without Teacher Specification)

When the teacher does not explicitly prescribe the block depth, the AI applies these standardized granularity tiers:

```mermaid
flowchart TD
    Init["Initial Granularity Requested"]
    
    Init -->|Trimester / Semester| Tri["TRIMESTER (Macro)\n1. Descends to Monthly (Months 1, 2, 3)\n2. Descends to Weekly (Weeks 1..4)\n🛑 Does not descend to daily by default.\nBNCC linked to Monthly/Weekly."]
    Init -->|Bimester / Monthly| Men["MONTHLY (Intermediate)\n1. Macro context with monthly BNCC skills\n2. Details into Weekly or Daily upon request."]
    Init -->|Weekly / Daily| Sem["WEEKLY (Micro / Surgical)\n1. Details every daily PlanningBlock\n2. Individual daily BNCC skill assignment\n3. Active methodology and punctual evaluation."]
```

### Golden Rules of Granularity:
- **TRIMESTER:** Descends at most 2 levels (**Trimester $\rightarrow$ Monthly $\rightarrow$ Weekly**). Generating 60 to 80 daily lessons at once exhausts model context, causes hallucinations, and overwhelms the teacher. BNCC skills remain associated with weekly or monthly blocks.
- **WEEKLY:** Focuses on concrete classroom execution: each daily `PlanningBlock` receives a BNCC code (`learning_objectives`), didactic sequence (`metodologia`), and assessment instrument (`evaluations`).
- **Macro BNCC Cleanup in Daily Plans:** When plans descend to surgical daily granularity, accumulating all BNCC skills at the macro header creates visual noise and redundancy. The AI supports clearing macro header skills via `bnccCodes: []` in `UPSERT_PLANNING` (deleting only macro objectives while preserving all daily block objectives) or concealing them via `isVisible: false` on the macro specification.

---

## 3. Temporal Gap Management Following Block Deletions

When a teacher removes an intermediate block, a **chronological gap** is created. The AI must proactively detect and remediate this discontinuity:

### Operational Lifecycle:
1. **Deletion Request:** *"I want to delete the month of January; the plan didn't turn out as expected"*.
2. **Database Execution:** The January block (and all its child daily blocks, objectives, and evaluations) is deleted via cascading foreign keys.
3. **Gap Detection:** The system detects an unmapped 31-day gap between the plan's `start_at` (`01/01/2026`) and the earliest existing block (February, `02/01/2026`).
4. **Proactive AI Engagement:** The assistant does not remain silent; it presents clear remediation options:
   > *"I removed January and all its scheduled lessons. That leaves an unmapped period from 01/01 to 01/31. How would you like to handle this?*
   > *1. Create a fresh block with revised topics for January;*
   > *2. Adjust the planning start date forward to February 1st."*

---

## 4. Custom Specifications Lifecycle (Mandatory Slot-Filling)

Authoring custom columns follows a strict business invariant: **creating a custom column requires providing its content** (`isRequired = true`).

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher
    participant AI as AI Co-Pilot
    participant DB as Database

    Teacher->>AI: "Add a Teaching Resources column"
    AI->>Teacher: Disambiguation: "Would you like this column for the entire trimester, for each month, or for each daily lesson?"
    Teacher->>AI: "For each month (Jan, Feb, Mar)"
    AI->>DB: Creates Specification (colName: "recursos", tableRef: PLANNING_BLOCK, isRequired: true)
    AI->>Teacher: Mandatory Follow-up: "Great! What resources will you need in January, February, and March?"
    Teacher->>AI: "Jan: Colored paper and markers; Feb: Tablets; Mar: Textbook"
    AI->>DB: Persists PlanningMetadataValue (3 rows linked to monthly blocks)
    AI->>Teacher: Confirmation & updated draft reflection
```

### Slot-Filling Invariants:
- If the teacher requests a column without values, the AI **must request the missing data immediately**.
- The AI never leaves required custom metadata unpopulated without teacher follow-up.
- If the teacher changes their mind (*"Never mind, drop the resources column"*), the AI deletes the `Specification` and its metadata rows in cascade.

---

## 5. Temporal Inference & Date Guardrails

### A. Calendar Translation
The AI translates natural conversational expressions into normalized ISO `DateTime`:
- *"Starting on March 1st for a bimester"* $\rightarrow$ `start_at = 2026-03-01T00:00:00Z` and `end_at = 2026-04-30T23:59:59Z`.
- *"Planning for the 2nd week of August"* $\rightarrow$ Locates the business days (Monday through Friday) of the second calendar week of August.

### B. Strict Date Guardrails
- **Date Inversion Prevention:** Recording `end_at < start_at` is strictly prohibited. If inconsistent dates are detected (*"October 20th to September 15th"*), the AI gently asks: *"I noticed the end date precedes the start date. Did you mean November 15th?"*.
- **Parent Boundary Containment:** A `PlanningBlock` or `Evaluation` can never carry timestamps outside the temporal boundaries of its parent `Planning` or parent block.

---

## 6. Teacher-to-Teacher Tone & Living Draft UI

### A. Natural Peer-to-Peer Conversation & Inquisitive Co-Creation
- The chat must feel like an **engaging, collegial collaboration between two educators in the teachers' lounge**: empathetic, supportive, practical, pedagogical, and actively inquisitive.
- The AI is encouraged to ask thoughtful questions and propose alternatives to help the teacher find the best didactic path, rather than just returning dry, blunt confirmations.

### B. Strict Ban on Repeated Full-Table Dumps (Anti-Dump Guardrail)
- The AI must **never** dump the entire lesson plan table back into the chat timeline on every turn.
- The chat timeline is strictly reserved for high-bandwidth conversational decision-making, pedagogical reasoning, and co-creative dialogue.
- The comprehensive visual representation of the table belongs exclusively to the **Living Draft** rendered in the interactive side-panel, which updates silently in real time.

### C. Trailing Structured Envelope Rule
- Any structured planning mutation payload (`<!--PLANNING_PATCH: ... -->`) must reside **strictly at the very end** of the model's message.
- Emitting the conversational explanation first guarantees zero perception delay for the teacher during visual streaming.

---

## 7. Database Snapshot as Single Source of Truth

### A. Snapshot Precedence Over Conversational Iterations
During co-planning, teachers frequently revise earlier requests: adding then removing a column, changing a BNCC skill, or rescheduling an exam.
- **The Challenge:** Chat history retains all contradictory messages (the initial request alongside the subsequent correction).
- **The Architectural Solution:** The **current consolidated database state (Snapshot)** is injected into the AI system prompt as the **Single Source of Truth**.
- **Cognitive Priority Rule:** The AI grants **absolute priority to the database snapshot** over historical chat turns. If a column or skill was removed from the database, it simply no longer exists for the model, preventing hallucinations or resurrection of discarded ideas.

### B. Continuous Gap Analysis
Prior to formulating each response, the AI evaluates the current Snapshot against active `Specification` records to determine what has been completed versus what remains pending:
1. **Completeness Diagnostic:**
   - Are institutional fields, grade level, and subject components populated?
   - Are macro boundaries (`start_at` and `end_at`) closed?
   - Are there `Specification` rows with `isRequired = true` lacking `PlanningMetadataValue` records?
   - Are there daily blocks without methodology or assigned BNCC skills?
   - Do registered evaluations include clear assessment criteria?
2. **Surgical Guidance:** The AI leverages this diagnostic to steer the next turn naturally, keeping the co-planning workflow focused on completing the lesson plan with maximum pedagogical rigor.

---

## 8. Atomic Stream Commit & Mid-Flight Cancellation Resilience

Planning modifications are strictly decoupled from mid-flight streaming:
1. **Transactional Gating:** Mutating use cases in `PlanningModule` are executed **exclusively upon successful completion of the stream**.
2. **Cancellation Invariant:** If the teacher clicks the stop generation button (`signal.aborted`) or the connection disconnects:
   - The message is flagged as `interrupted: true`.
   - **Zero planning mutations are committed to PostgreSQL**.
   - The previously established lesson plan draft remains fully preserved and uncorrupted.

---

## 9. The Watermark Boundary Principle in Post-Reset History

### A. The Challenge of Post-Reset Context Contamination
Even when the database is purged via `RESET_PLANNING`, a naive sliding conversation window (e.g. `conversations.slice(-4)`) would still feed messages from the discarded plan into the LLM and the pre-search BNCC keyword extractor. This caused the AI to persist with obsolete terms (e.g. "Early Childhood", "infants") even after the teacher switched to a completely different grade.

### B. Watermark Demarcation
- Whenever a reset command (`RESET_PLANNING`) occurs in the session:
  * A temporal **Watermark Boundary** is established.
  * **All messages prior to the reset point are pruned** from the context window supplied to the LLM and the keyword extractor.
  * The conversational timeline restarts strictly from the reset command, guaranteeing a 100% clean slate.

### C. Immediate Direction Shift Without Friction (Anti-Insistence)
When the teacher redirects the plan (e.g. *"Let's not do Early Childhood; let's switch to 3rd year of High School"*), the model must welcome the new choice immediately without badgering the educator with repetitive confirmations about the discarded context, promptly emitting `UPSERT_PLANNING` with the new official catalog stage.

---

## 10. Domain Vocabulary Mapping & Native Overrides (Anti-Duplication)

### A. Natural Vocabulary Translation
Teachers communicate using everyday layout and didactic terminology rather than relational database terms:
- **"Header" / "At the top" / "Macro":** Maps to the `Planning` entity (`tableRef: "PLANNING"`).
- **"Evaluations in header":** Maps to `Planning.evaluations` at the cycle level.
- **"Subject" / "Discipline" (*"Disciplina"* / *"Matéria"*):** Maps to the native relation `Planning.curricularComponents`.
- **"Didactic Sequence" / "Development":** Maps to the native column `PlanningBlock.metodologia`.

### B. Strict Native Field Override Invariant
Native relational entities (`curricularComponents`, `metodologia`, `evaluations`, `learningObjectives`) must never be duplicated into custom EAV tables:
- When a teacher requests renaming "Componente" to "Disciplina" and changing the subject:
  1. The AI updates the native relation via `curricularComponentNames: ["Língua Portuguesa"]` in `UPSERT_PLANNING`.
  2. The AI updates the specification display mold (`colName: "curricularComponents"`, `customLabel: "Disciplina"`, `tableRef: "PLANNING"`).
  3. **Zero rows are generated in `PlanningMetadataValue`**. Generating an ad-hoc EAV specification `colName: "disciplina"` is strictly prohibited as it produces duplicate cards on screen.

### C. Visual Presentation Modifiers (`showLabel: false` and `order`)
- **Label Suppression (`showLabel: false`):** Enables direct value rendering (e.g. showing `"2º Bimestre"` directly without the top `"Bimestre"` label).
- **Deterministic Universal Ordering (`order: Int`):** Controls the sequence of macro header cards and daily table columns deterministically.
