# Frontend Streaming, Cancellation & File Ingestion (`STREAMING.md`)

Single source of truth for consuming outbound AI token streams, handling mid-flight cancellation, and managing file uploads in `apps/web/`.

> **Direct Backend Alignment:**
>
> - Outbound LLM Streaming & Cancellation: [`apps/service/docs/STREAMS.md`](../../service/docs/STEAMS.md)
> - Multipart File Validation & Ingestion: [`apps/service/docs/UPLOAD.md`](../../service/docs/UPLOAD.md)

---

## 1. Consuming LLM Token Streams

> [!IMPORTANT]
> **Escopo Exclusivo de Streaming:** O streaming é utilizado **estritamente para retornos de LLM** (geração incremental de planos de aula e tokens de IA). Consultas diretas ao banco de dados, listagens e operações de leitura (`GET`) utilizam requisições REST tradicionais com `async/await` (conforme documentado em [`ROUTER.md`](ROUTER.md)).

`apps/service/` delivers incremental AI responses via Server-Sent Events (`@Sse()`) or chunked HTTP streams. The web client consumes these events incrementally to deliver real-time feedback to the teacher.

### Stream Event Contract
The frontend stream consumer must handle the standard typed event envelope emitted by the backend:

| Event Type | Payload | Frontend Action |
| :--- | :--- | :--- |
| `chunk` | `{ content: string }` | Append incremental markdown tokens to local state. |
| `done` | `{}` | Mark generation as complete; enable export and editing tools. |
| `cancelled` | `{ reason?: string }` | Update state to indicate generation was halted by the user. |
| `error` | `{ message: string }` | Display contextual error banner with retry option. |

### Incremental Rendering Guidelines
- **Throttled Updates:** High-frequency token emissions should be batched (or use React 19 concurrent transitions) to avoid unnecessary DOM thrashing.
- **Auto-Scroll Anchor:** Keep the viewport anchored to the latest generated content while the teacher is at the bottom of the container; detach auto-scroll if the teacher manually scrolls up to inspect previous sections.
- **Streaming State Machine:** Represent stream states explicitly: `idle` → `connecting` → `streaming` → `completed` | `cancelled` | `error`.

---

## 2. Mid-Flight Cancellation Lifecycle

In accordance with [`apps/service/docs/STREAMS.md`](../../service/docs/STEAMS.md), teachers must be able to cancel generation at any moment.

### Client-Side Implementation Pattern
1. **Instantiate `AbortController`:** Create a new controller whenever a generation session starts.
2. **Bind Signal to Request:** Pass `abortController.signal` to the `fetch` or `EventSource` call.
3. **Prominent Cancel Button:** While `status === 'streaming'`, render a clearly visible, accessible Cancel button (using shadcn's `Button` with `variant="destructive"` or `variant="outline"`).
4. **Trigger Abort:** Clicking Cancel triggers `abortController.abort()`.
5. **Handle Disconnect:** Catch `AbortError` gracefully—do not show an unexpected error notification. Instead, update the UI to state: *"Generation cancelled by teacher"*.

```tsx
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

export function LessonPlanGenerator() {
  const [content, setContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleStartGeneration = async () => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsStreaming(true)
    setContent("")

    try {
      const response = await fetch("/api/lesson-plans/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "..." }),
        signal: controller.signal,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setContent((prev) => prev + chunk)
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream successfully cancelled by teacher.")
      } else {
        console.error("Stream failed:", err)
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
  }

  return (
    <div>
      {isStreaming ? (
        <Button variant="destructive" onClick={handleCancel}>
          Cancel Generation
        </Button>
      ) : (
        <Button onClick={handleStartGeneration}>Generate Lesson Plan</Button>
      )}
      <div className="prose mt-4">{content}</div>
    </div>
  )
}
```

---

## 3. Reference Material Upload UX

The teacher can supply pedagogical reference documents to ground lesson plan generation. The client pre-validates files before sending them to the backend upload endpoint.

### Supported Formats & MIME Types Allowlist
Strictly matching [`apps/service/docs/UPLOAD.md`](../../service/docs/UPLOAD.md):

| Category | Formats | MIME Types |
| :--- | :--- | :--- |
| **Images** | PNG, JPEG, WebP | `image/png`, `image/jpeg`, `image/webp` |
| **PDF** | PDF | `application/pdf` |
| **Documents** | DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

### Pre-Validation & UI Behavior
- **Immediate Feedback:** Reject files outside the allowlist immediately on drop/selection with an informative toast (`"Invalid format: Please upload a PDF, DOCX, PNG, or JPEG file"`).
- **Size Cap Enforcement:** Pre-validate file sizes before initiating multipart upload.
- **Visual Preview Card:**
  - Images: Display a thumbnail preview with remove button.
  - PDF & DOCX: Display file type badge, sanitized filename, file size, and remove button.
- **Drag-and-Drop Zone:** Clear visual indication of active drag state (`border-primary bg-primary/5`).
