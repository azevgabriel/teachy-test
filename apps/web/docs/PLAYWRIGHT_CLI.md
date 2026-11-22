# Playwright CLI & Layout Verification Guidelines (`PLAYWRIGHT_CLI.md`)

This document establishes the official **Playwright CLI (`playwright-cli`)** workflow and verification routines for the web application (`apps/web/`), with specific focus on **A4 Print Layout, Visual Hierarchy & Pagination Verification**.

---

## 🎯 Motivation & Why Playwright CLI

Traditional browser automation tools and Model Context Protocol (MCP) servers often return massive JSON payloads or hundreds of kilobytes of raw HTML/DOM trees. When loaded into an AI agent's context window, this creates severe **context drag**, degrades reasoning quality, and wastes token budget.

**Playwright CLI (`playwright-cli`)** solves this problem by providing a lean, command-driven terminal interface:

- **Token-Efficient Snapshots:** Inspects the live accessibility tree using compact, reference-based notation (`[ref=e1] button "Exportar PDF"`).
- **Targeted Action via Refs:** Actions are executed against specific short references (`playwright-cli click e1`) without traversing bulky DOM paths.
- **Deterministic Print & Pagination Auditing:** Runs lightweight DOM geometry checks (`eval`) and generates real Chromium PDF outputs to catch A4 page-break regressions before code is finalized.

---

## 📄 A4 Reference Dimensions (96 DPI)

When auditing print layouts in the browser viewport, always lock the viewport to exact A4 pixel equivalents before running geometry checks:

- **A4 Portrait (`210mm × 297mm`):** `794px × 1123px`
- **A4 Landscape (`297mm × 210mm`):** `1123px × 794px`

*(Adjust printable height in calculations by subtracting top + bottom `@page` margins, e.g., `20mm` top + `20mm` bottom ≈ `150px`, leaving a printable content budget of **`~970px`**).*

---

## 🔍 A4 Pagination & Page-Break Verification Routine

Whenever modifying document templates, tables, or print CSS (`@media print` / `@page`), the agent **MUST** execute this verification loop:

### 1. Open and Lock Viewport to A4

```bash
playwright-cli open http://localhost:5173/chat/<session-id>
# Lock viewport to Portrait A4
playwright-cli resize 794 1123
```

---

### 2. Deterministic Height & Overflow Guardrail (`scrollHeight`)

Every single A4 sheet (`.a4-sheet`) rendered in the DOM must strictly respect the vertical boundary of an A4 sheet (`scrollHeight <= 1125px`).

Run this verification check:
```bash
playwright-cli eval "Array.from(document.querySelectorAll('.a4-sheet')).map((el) => ({ page: el.getAttribute('data-page-number'), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, hasOverflow: el.scrollHeight > 1125 }))"
```

> [!CAUTION]
> If any sheet reports `hasOverflow: true`, content has spilled past the A4 page boundary. The chunking budget in `paginatePlanning.ts` must be adjusted to move excessive rows onto the subsequent page.

---

### 3. Table Continuity & Header Repetition Verification

When a macro pedagogical unit (e.g. *Mês 1* or *Semana 2*) spans across multiple pages, the continued page must never orphan the table structure:

1. **Section Continuation Badge:** The continued block must bear the title `[Bloco] (Continuação)`.
2. **TableHeader Repetition:** The second page **must repeat** the complete `<thead>` with all columns (`Aula / Data`, `Sequência Didática`, `BNCC`, `Avaliação`, and dynamic EAV columns).
3. **Row Integrity (`break-inside: avoid`):** No individual lesson row (`<tr>`) may be split across page boundaries.

Audit check:
```bash
playwright-cli eval "Array.from(document.querySelectorAll('.a4-sheet')).map((sheet) => ({ page: sheet.getAttribute('data-page-number'), tablesCount: sheet.querySelectorAll('table').length, theadCount: sheet.querySelectorAll('thead').length, rowsCount: sheet.querySelectorAll('tbody tr').length }))"
```

---

### 4. High-Contrast White Paper Legibility (WCAG Audit)

All colors used inside `.a4-sheet` must guarantee crisp legibility on white paper (`#ffffff`) for physical printing and PDF export:

| Element | CSS Token | Target Ratio | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **Document Title & Headings** | `text-slate-950 font-serif` | `> 19:1` (AAA) | Deep black/slate, serif font for formal institutional look. |
| **Body & Methodology** | `text-slate-900` | `> 14:1` (AAA) | High contrast, clear line-height (`leading-relaxed`). |
| **Table Borders** | `border-slate-300` | High definition | Distinct lines that do not vanish in laser black-and-white printing. |
| **BNCC Skill Badges** | `bg-amber-50 text-amber-950 border-amber-300` | `> 10:1` | Dark amber text on soft amber background, distinct in color and grayscale. |
| **Evaluations & Criteria** | `bg-slate-50 border-slate-300 text-slate-900` | `> 12:1` | Crisp box with clear check icon and assessment criteria. |

---

### 5. Running Header & Footer Sequence (`Folha X de Y`)

The bottom of every `.a4-sheet` contains an authoritative running footer (`.a4-sheet-footer`) verifying total page count:

```bash
playwright-cli eval "Array.from(document.querySelectorAll('.a4-sheet-footer')).map(f => f.innerText.replace(/\s+/g, ' ').trim())"
```

Expected output sample:
```json
[
  "Plano Curricular Estruturado • Teachy Folha 1 de 2",
  "Plano Curricular Estruturado • Teachy Folha 2 de 2"
]
```

---

### 6. Split-View & Independent Scroll Verification

In desktop mode, verify that the left panel (`PlanningViewer`) and right panel (`ChatContainer`) maintain isolated scrolling:

```bash
# Scroll the chat timeline down
playwright-cli eval "document.querySelector('main').scrollTop = 500"

# Verify that the A4 document sheet scroll position did NOT move
playwright-cli eval "document.querySelector('aside .overflow-y-auto').scrollTop"
# Expected: 0 (or unaffected)
```

---

### 7. Real Artifact Captures (Visual Evidence)

Generate real screenshots and PDF outputs to physically inspect the final result:

```bash
# Capture individual A4 sheets
playwright-cli screenshot ".a4-sheet[data-page-number='1']" page-1.png
playwright-cli screenshot ".a4-sheet[data-page-number='2']" page-2.png

# Generate full PDF via Chromium
playwright-cli pdf --format A4 --print-background ./planning-test.pdf
```
