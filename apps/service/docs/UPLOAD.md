# NestJS File Upload Guidelines (`UPLOAD.md`)

Single source of truth for inbound file ingestion, validation, and streaming uploads in `apps/api/`.

> **References:**
>
> - [NestJS — File Upload](https://docs.nestjs.com/http/file-upload)
> - [NestJS — Streaming Files](https://docs.nestjs.com/http/file-upload#streaming-files)

---

## 1. Accepted File Types

This MVP accepts teacher reference materials in three categories:

| Category                         | Formats         | Allowed MIME Types                                                        |
| :------------------------------- | :-------------- | :------------------------------------------------------------------------ |
| **Images** (screenshots, photos) | PNG, JPEG, WebP | `image/png`, `image/jpeg`, `image/webp`                                   |
| **PDF**                          | PDF             | `application/pdf`                                                         |
| **Documents**                    | DOCX            | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

Reject any file outside this allowlist with `400 Bad Request` or `415 Unsupported Media Type`.

---

## 2. Validation Pipeline

Always validate uploads at the controller boundary before passing them to services or the AI engine:

- Use `ParseFilePipe` with explicit validators:
  - `MaxFileSizeValidator` (enforce per-request size cap).
  - `FileTypeValidator` (or magic-byte inspection — never trust file extensions or client-supplied `Content-Type` alone).
- Sanitize original filenames before logging or storing (strip path traversal characters; generate UUIDs for stored keys).

---

## 3. Buffered vs. Streaming Ingestion

Choose the ingestion strategy according to file size and downstream target:

- **Standard Multipart (`FileInterceptor` / `FilesInterceptor`):** Acceptable only for small, bounded payloads when immediate in-memory extraction is required.
- **Streaming Upload (Preferred for larger PDFs/DOCX/high-res photos):** Pipe the incoming multipart stream directly to object storage or the extraction pipeline (e.g., via adapter-native multipart streams) to prevent Node.js heap spikes under concurrent uploads.

---

## 4. Handoff to Processing & Streaming

- Keep upload controllers thin: validate and ingest the file, then delegate parsing/AI analysis to a dedicated service.
- If file processing triggers an incremental AI response, follow the outbound streaming and cancellation rules in [STREAMS.md](STREAMS.md).
- Any new metadata tables or storage architecture decisions must follow the invariants in [AGENTS.md](../AGENTS.md).
