# 02 — Pedagogical Rules, Guardrails & Context Orchestration

This document establishes the pedagogical principles, default granularity rules, temporal constraints, and context orchestration guidelines that the AI agent must strictly follow.

---

## 1. Core Pedagogical Principles

The Teachy assistant does not act as a generic text generator, but as a **disciplined pedagogical co-pilot**:
1. **Strict BNCC Alignment:** Every detailed lesson or unit must link to official skills from the Brazilian National Common Curricular Base (BNCC) appropriate for the student grade level (`ApplicationYear`).
2. **Subtle Guidance vs. Rigid Enforcement:** The AI never imposes formatting aggressively. It suggests pedagogical best practices in a welcoming, collegial tone ("*For 3rd Grade, I suggest breaking this down into daily 50-minute blocks highlighting skill EF03LP01. How does that sound to you?*").
3. **Institutional Adaptability:** The teacher can add, rename, or drop custom columns. When a removal is requested, the AI confirms and reorganizes without friction.

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

### A. Natural Peer-to-Peer Conversation
- The chat must feel like a **collegial exchange between two educators in the teachers' lounge**: empathetic, supportive, practical, and conversational.
- **Strict Ban on Text Walls and Redundant Tables:** The AI must **never** dump the entire lesson plan table back into the chat timeline on every turn. Chat responses must remain concise (2 to 4 short paragraphs, targeted bullet points, or clear questions).

### B. The Side Panel as a "Living Draft"
- While the chat focuses on high-bandwidth conversational decision-making, an interactive side panel renders the **Living Draft** of the lesson plan in real-time.
- Every agreed-upon decision updates the underlying database and refreshes the visual draft silently. The teacher inspects the evolving document without cluttering the chat timeline.

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
