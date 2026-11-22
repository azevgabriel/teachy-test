# 04 — Conversational Intent Catalog & Prisma Operations

This document catalogs teacher conversational intents, their dialogue workflows, and corresponding PostgreSQL mutations via Prisma.

---

> [!TIP]
> **Communication Guideline (Teacher-to-Teacher Tone):**
> Across all intents below, AI chat responses remain concise, supportive, and collegial (avoiding redundant full-table text walls). Updated blocks, dates, and specifications reflect immediately in the **Living Draft** side panel.

## 🗺️ Intent Matrix Overview

```mermaid
flowchart TD
    Msg["Teacher Input"] --> Classifier{"Intent Classifier"}
    
    Classifier -->|0. Initial Setup / Definitive Data| I0["UPSERT_PLANNING\nCreates/updates macro header, BNCC and initial block tree"]
    Classifier -->|1. Point Replacement| I1["UPDATE_BLOCK_BY_DATE\nLocates block by date and modifies content"]
    Classifier -->|2. Column Disambiguation| I2["ADD_SPECIFICATION_PENDING\nInquires scope and requests required values"]
    Classifier -->|3. Tree Reorganization| I3["REORGANIZE_TREE\nCreates parent blocks and reparents children via parentId"]
    Classifier -->|4. Batch Column Update| I4["BATCH_UPDATE_COLUMN\nUpdates native or EAV column across target granularity"]
    Classifier -->|5. Analytical Query| I5["READ_ONLY\nComputes response without database mutations"]
    Classifier -->|6. Block Deletion| I6["DELETE_BLOCK_WITH_GAP\nDeletes block and guides remediation of time gap"]
    Classifier -->|7. Full Reset| I7["RESET_PLANNING\nCascading reset to restart planning workflow"]
    Classifier -->|8. Native Override & Reordering| I8["ADD_SPECIFICATION / UPSERT_PLANNING\nOverrides native labels, toggles visibility, sets order"]
    Classifier -->|9. Macro BNCC Purge| I9["UPSERT_PLANNING (bnccCodes: [])\nClears macro header skills while preserving daily block skills"]
```

---

## 0. Initial Setup & Definitive Parameters (`UPSERT_PLANNING`)
* **Teacher Command:** *"I want to create a monthly math plan for the 3rd grade covering BNCC skills EF03MA01 and EF03MA02"* or *"Let's switch to High School 3rd year in Portuguese"*.
* **AI Behavior:**
  - Detects consolidated planning parameters (subject, grade level, cycle granularity, dates, and BNCC objectives).
  - Emits the `UPSERT_PLANNING` payload utilizing **rigorously the official string catalog** for `applicationYearName` (e.g. `"3º ano do Ensino Médio"`) and `curricularComponentNames` (e.g. `["Língua Portuguesa"]`).
  - **Dynamic Pivot Support:** When the teacher redirects the plan to another grade or subject mid-conversation, emits `UPSERT_PLANNING` with the new target parameters, atomically purging obsolete macro `learningObjectives` from the previous stage.
* **Prisma Operation:**
  ```typescript
  await prisma.planning.upsert({
    where: { sessionId },
    create: {
      sessionId,
      granularity: 'MONTHLY',
      curricularComponents: { connect: [{ id: mathComponentId }] },
      applicationYearId: thirdGradeId,
      blocks: {
        create: initialBlocksData,
      },
      learningObjectives: {
        create: bnccSkillIds.map((skillId) => ({ bnccSkillId: skillId })),
      },
    },
    update: {
      granularity: 'MONTHLY',
      applicationYearId: thirdGradeId,
    },
  });
  ```

---

## 1. Point Replacement by Date (`UPDATE_BLOCK_BY_DATE`)
* **Teacher Command:** *"Switch the lesson on August 6th to the Father's Day craft activity"*.
* **AI Behavior:**
  - Locates the `PlanningBlock` where `start_at` matches August 6th.
  - Updates the `metodologia` field and lesson description to reflect the Father's Day craft project.
  - Associates relevant BNCC skills if appropriate.
* **Prisma Operation:**
  ```typescript
  await prisma.planningBlock.updateMany({
    where: {
      planning: { sessionId },
      startAt: { gte: new Date('2026-08-06T00:00:00Z'), lte: new Date('2026-08-06T23:59:59Z') },
    },
    data: { metodologia: 'Special Father’s Day craft and oral storytelling activity...' },
  });
  ```

---

## 2. Column Addition with Disambiguation (`ADD_SPECIFICATION_PENDING`)
* **Teacher Command:** *"Add a column for teaching resources"*.
* **AI Behavior:**
  - Identifies that "teaching resources" is not a native column and that the current plan contains multiple tiers (e.g. Trimester $\rightarrow$ Monthly $\rightarrow$ Daily).
  - Clarifies scope: *"Would you like teaching resources for the entire trimester (header), for each month (Jan, Feb, Mar), or for each daily lesson?"*.
  - Upon answer (*"Just for the months"*), creates the `Specification` (`table_ref = PLANNING_BLOCK`, `isRequired = true`).
  - **Mandatory Slot-Filling:** Promptly follows up: *"What resources will you be using in January, February, and March?"*.
  - Records answers in `PlanningMetadataValue`.

---

## 3. Recursive Tree Reorganization (`REORGANIZE_TREE`)
* **Teacher Command:** *"Group the lessons by week, but keep every single day detailed"*.
* **AI Behavior:**
  - Creates new parent `PlanningBlock` records with `granularity = WEEKLY` (e.g. Week 1, Week 2).
  - Reassigns the `parentId` of existing daily blocks (`granularity = DAILY`) to their matching weekly parent block based on date windows.
* **Prisma Operation:**
  ```typescript
  // 1. Create parent weekly block
  const weekBlock = await prisma.planningBlock.create({
    data: {
      planningId,
      granularity: 'WEEKLY',
      startAt: weekStart,
      endAt: weekEnd,
      order: 1,
    },
  });
  // 2. Re-parent matching daily child blocks
  await prisma.planningBlock.updateMany({
    where: {
      planningId,
      granularity: 'DAILY',
      startAt: { gte: weekStart, lte: weekEnd },
    },
    data: { parentId: weekBlock.id },
  });
  ```

---

## 4. Batch Column Update & Compression (`BATCH_UPDATE_COLUMN`)
* **Teacher Command:** *"Make the didactic sequences more concise across all weeks"* or *"Shorten the teaching resources description in the weekly blocks"*.
* **AI Behavior:**
  - Identifies target granularity (e.g. `WEEKLY`) and target column.
  - Distinguishes whether the target is the physical native `metodologia` column in `planning_blocks` or an EAV dynamic column in `planning_metadata_values`.
  - Rewrites/updates target texts across all matching blocks in batch.
* **Prisma Operation:**
  ```typescript
  // Native column batch update:
  await prisma.planningBlock.updateMany({
    where: { planningId, granularity: 'WEEKLY' },
    data: { metodologia: 'Concise synthesized didactic sequence...' },
  });

  // Or EAV dynamic column batch update:
  await prisma.planningMetadataValue.updateMany({
    where: {
      specificationId: customSpecId,
      planningBlock: { planningId, granularity: 'WEEKLY' },
    },
    data: { textValue: 'Updated concise resources...' },
  });
  ```

---

## 5. Read-Only Analytical Query (`READ_ONLY`)
* **Teacher Command:** *"How many class periods are left before the midterm exam?"*.
* **AI Behavior:**
  - Queries `PlanningBlock` records and finds the `Evaluation` marked as the midterm exam.
  - Computes the count of instructional blocks prior to the exam timestamp.
  - **Zero Database Mutations:** Replies analytically without executing `create`, `update`, or `delete` queries.

---

## 6. Block Deletion with Gap Management (`DELETE_BLOCK_WITH_GAP`)
* **Teacher Command:** *"Delete the week 2 block"*.
* **AI Behavior:**
  - Deletes the Week 2 `PlanningBlock` (and child rows in cascade).
  - Detects the unmapped gap between Week 1 and Week 3.
  - Inquires: *"I removed Week 2. Would you like to introduce a revised topic for that window or adjust the schedule forward?"*.

---

## 7. Full Planning Reset (`RESET_PLANNING`)
* **Teacher Command:** *"I don't like how this turned out; let's start over from scratch"* or *"Quero recomeçar do zero"*.
* **AI Behavior:**
  - Emits the `RESET_PLANNING` payload (`{ "operation": "RESET_PLANNING", "data": {} }`).
  - Executes cascading deletion of the session's planning and specifications:
    ```typescript
    await prisma.planning.deleteMany({ where: { sessionId } });
    await prisma.specification.deleteMany({ where: { sessionId } });
    ```
  - **Watermark Pruning:** Triggers historical context demarcation in `ChatService`, purging conversations prior to the reset point and starting the discovery phase 100% clean without residual terms from the discarded plan.

---

## 8. Native Field Override, Reordering & Label Omission (`ADD_SPECIFICATION` / `UPSERT_PLANNING`)
* **Teacher Command:** *"Rename Component to Subject and change it to English"*, *"Don't show the label for the bimester, just display '2º Bimestre'"*, or *"Move evaluations to the first position in the header"*.
* **AI Behavior:**
  - **Native Field Override (Anti-Duplication):** Detects when the teacher references an existing native field (`curricularComponents`, `metodologia`, `evaluations`). Instead of creating a redundant EAV specification, overrides the presentation mold (`colName: "curricularComponents"`, `customLabel: "Subject"`) and updates the physical relation directly (`curricularComponentNames: ["Língua Inglesa"]`).
  - **Label Omission (`showLabel: false`):** Enables direct value rendering on cards or columns when the teacher prefers displaying only the content without an overarching category title.
  - **Universal Reordering (`order: Int`):** Assigns deterministic integer sequence values (`order = 1, 2, 3...`) to control header cards and table columns.
* **Prisma Operation:**
  ```typescript
  // Overrides native column presentation without creating PlanningMetadataValue rows:
  await prisma.specification.upsert({
    where: { id: existingSpecId },
    update: {
      customLabel: 'Subject',
      order: 1,
      showLabel: false,
    },
    create: {
      sessionId,
      colName: 'curricularComponents',
      customLabel: 'Subject',
      tableRef: 'PLANNING',
      order: 1,
      showLabel: false,
    },
  });
  ```

---

## 9. Macro BNCC Skill Purge (`UPSERT_PLANNING` with `bnccCodes: []`)
* **Teacher Command:** *"The daily lessons already have their BNCC codes; remove the skills from the header at the top"* or *"Don't display skills in the macro header"*.
* **AI Behavior:**
  - Understands that aggregating BNCC skills at the macro level creates visual clutter in daily-granularity plans.
  - Emits `UPSERT_PLANNING` with `bnccCodes: []`.
  - Atomically purges all `learning_objectives` linked to `planning_id` while preserving 100% of skills linked to `planning_block_id`.
* **Prisma Operation:**
  ```typescript
  // Explicitly deletes only macro header skills:
  await prisma.learningObjective.deleteMany({
    where: { planningId: planning.id },
  });
  ```

---

## 10. Natural Language $\leftrightarrow$ Schema Mapping Dictionary

| Teacher Conversational Expression | Schema Target | Scope / Table | Primary Operation | Anti-Duplication Rule |
| :--- | :--- | :--- | :--- | :--- |
| *"No cabeçalho"*, *"No topo"*, *"No ciclo"* | `Planning` | Macro Header (`PLANNING`) | `UPSERT_PLANNING` / `ADD_SPECIFICATION` | Direct macro properties; never attach to blocks. |
| *"Disciplina"*, *"Matéria"*, *"Componente"* | `Planning.curricularComponents` | Macro Header (`PLANNING`) | `UPSERT_PLANNING.curricularComponentNames` | Override `colName: "curricularComponents"`; **never** create `colName: "disciplina"` in EAV. |
| *"Avaliação no cabeçalho"* | `Planning.evaluations` | Macro Header (`PLANNING`) | `UPSERT_PLANNING.evaluations` | XOR constraint: `planning_id IS NOT NULL`. |
| *"Sequência didática"*, *"Metodologia"* | `PlanningBlock.metodologia` | Blocks (`PLANNING_BLOCK`) | `UPDATE_BLOCK_BY_DATE` / `BATCH_UPDATE_COLUMN` | Override `colName: "metodologia"`; persist text in physical column. |
| *"Remover habilidades do cabeçalho"* | `Planning.learningObjectives` | Macro Header (`PLANNING`) | `UPSERT_PLANNING` with `bnccCodes: []` | Deletes only `where: { planningId: id }`; preserves daily block skills. |
| *"Exibir só o valor, sem rótulo"* | `Specification.showLabel` | Either | `ADD_SPECIFICATION` (`showLabel: false`) | Renders raw value without card title. |
| *"Ocultar coluna/seção"* | `Specification.isVisible` | Either | `ADD_SPECIFICATION` (`isVisible: false`) | Suppresses rendering without deleting persisted data. |
| *"Mudar ordem das colunas/cards"* | `Specification.order` | Either | `ADD_SPECIFICATION` (`order: Int`) | Sequenced via `orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]`. |
