# shadcn/ui & Styling Guidelines (`SHADCN.md`)

Single source of truth for UI components, design tokens, and Tailwind CSS v4 styling in `apps/web/`.

> **References:**
>
> - [shadcn/ui Documentation](https://ui.shadcn.com)
> - [shadcn MCP Registry Guide](https://ui.shadcn.com/docs/registry/mcp)
> - [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
> - [Radix UI Primitives](https://www.radix-ui.com/primitives)

---

## 1. Component Philosophy & Invariants

To maintain UI consistency, accessibility, and high development velocity, `apps/web/` adheres to a strict component hierarchy:

- **Never Reinvent Primitive Components:** Never write ad-hoc HTML elements or custom CSS for buttons, inputs, dialogs, dropdowns, popovers, select menus, sheets, tabs, or tooltips. Always use **shadcn/ui** implementations.
- **Accessibility by Default:** All shadcn components are built on top of **Radix UI** primitives, guaranteeing WAI-ARIA compliance, keyboard navigation, and screen-reader support out of the box.
- **Component Placement:**
  - Reusable primitives live in `src/components/ui/` (e.g. `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`).
  - Domain-specific composed widgets live in `src/components/` or feature directories (e.g. `src/components/lesson-plan/PlanStreamViewer.tsx`).
- **Composition over Monolithic Props:** Favor composable compound components (e.g., `<Dialog><DialogTrigger /><DialogContent><DialogHeader />...</DialogContent></Dialog>`) over rigid, monolithic prop configurations.

---

## 2. Tailwind CSS v4 Architecture

`apps/web/` uses Tailwind CSS v4 powered by the `@tailwindcss/vite` plugin:

### Configuration & Global CSS
- Import directive in `src/styles.css`:
  ```css
  @import "tailwindcss";
  ```
- No legacy `tailwind.config.js` required: Tailwind v4 handles themes, variants, and colors via standard CSS variables and CSS rules.

### Class Merging Helper (`cn`)
All dynamic classes and variant combinations must use the standard `cn` utility based on `clsx` and `tailwind-merge`:
```tsx
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 3. Auxílio do shadcn MCP para Construção de UI/UX

Ao lidar com a criação de interfaces e componentes em `apps/web/`, o agente tem à disposição o **shadcn MCP Server** para auxiliar na construção ágil e consistente do UI/UX da aplicação:

- **Descoberta & Inspeção:** O agente utiliza as ferramentas do MCP para consultar registries oficiais e customizados, inspecionando esquemas de componentes, props e variantes adequadas às necessidades da interface do professor (ex.: botões de ação e cancelamento, modais de inspeção de arquivos, cartões de parâmetros, containers com scroll lock).
- **Resolução de Dependências & Tokens:** O MCP auxilia a identificar primitivos do Radix UI necessários e assegura alinhamento com as classes utilitárias e variáveis semânticas do Tailwind CSS v4.
- **Scaffolding de Componentes:** Permite estruturar e posicionar novos componentes em `src/components/ui/` sem criar elementos HTML primitivos ad-hoc, mantendo o padrão arquitetural do projeto.
- **Garantia de Qualidade:** Após o scaffolding de novos blocos visuais, o código deve ser validado via Biome (`npm run check`).

---

## 4. Key Primitives for Teacher MVP

The following shadcn/ui components form the core building blocks for the teacher experience:

| Primitive | Use Case in Teacher MVP |
| :--- | :--- |
| `Button` | Action triggers, Primary CTA ("Generate Plan"), Cancel Generation button (destructive variant). |
| `Card` | Lesson plan containers, material upload drop zones, parameter selection panels. |
| `Dialog` / `Sheet` | Material inspection drawer, lesson export modal, configuration side-panel. |
| `Input` / `Textarea` | Curriculum prompt input, subject, grade level, topic customization. |
| `Progress` | Real-time file upload progress and token generation status indicator. |
| `ScrollArea` | Constrained streaming output container with auto-scroll lock. |
| `Badge` | Uploaded file format indicator (PNG, PDF, DOCX), generation status (`Streaming`, `Cancelled`, `Completed`). |
| `Sonner` / `Toast` | Notifications for upload errors, cancellation confirmation, and clipboard copy. |

---

## 5. Icons & Typography

- **Icons:** Use [`lucide-react`](https://lucide.dev) for all icons.
- **Typography:** Use Tailwind semantic text classes (`text-sm`, `text-base`, `font-medium`, `font-semibold`, `text-muted-foreground`). Never use inline font styles.
