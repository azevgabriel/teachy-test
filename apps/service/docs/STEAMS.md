# NestJS Streaming Guidelines (`STREAMS.md`)

Single source of truth for outbound chunked responses, file streaming, and mid-flight cancellation in `apps/api/`.

> **References:**
>
> - [NestJS — Streaming Responses](https://docs.nestjs.com/http/streaming-responses)
> - [NestJS — Streaming Files](https://docs.nestjs.com/http/file-upload#streaming-files)

---

## 1. Outbound LLM Streaming (Chunked Responses)

Use **Server-Sent Events (`@Sse()`)** returning an RxJS `Observable<MessageEvent>` (or chunked HTTP streams when custom headers/POST bodies are required) to forward partial LLM payloads incrementally from the AI reasoning engine to the web client.

- Emit small, typed event payloads (`chunk`, `done`, `error`, `cancelled`).
- Never buffer the full AI response in memory before sending to the client.
- Keep stream orchestration inside a dedicated service; controllers only bind the transport layer.

---

## 2. Mid-Flight Cancellation & Persistence

The teacher can cancel an in-progress generation at any point. Every streaming endpoint must implement cooperative cancellation:

1. **Bind an `AbortController` per request:** Pass `abortController.signal` downstream to the AI reasoning engine HTTP/SDK call.
2. **Detect client disconnect:** Hook into the request lifecycle (`req.on('close', ...)` or the RxJS `Observable` teardown function) to trigger `abortController.abort()`.
3. **Avoid memory leaks:** Always release upstream readers, timers, and listeners inside the teardown block.
4. **Persist user action:** On cancellation (or completion/error), invoke the persistence layer to record the user's action and resulting state. _(Model structure follows the Schema-First invariant in [AGENTS.md](../AGENTS.md).)_

```ts
// Conceptual pattern — adapt to the chosen HTTP adapter (Express/Fastify)
return new Observable<MessageEvent>((subscriber) => {
  const abortController = new AbortController();

  this.aiStreamService
    .streamLessonPlan(dto, abortController.signal, (chunk) => {
      subscriber.next({ data: { type: 'chunk', content: chunk } });
    })
    .then(() => {
      subscriber.next({ data: { type: 'done' } });
      subscriber.complete();
    })
    .catch((err) => {
      if (!abortController.signal.aborted) subscriber.error(err);
    });

  // Teardown: runs automatically when the client disconnects/cancels
  return () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
      void this.aiStreamService.recordCancellation(dto.sessionId);
    }
  };
});
```
