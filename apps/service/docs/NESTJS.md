## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Check these first-party packages before adding another library or writing your own:

- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md).
- Files (S3 included): [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md).

Validation uses Zod (or any Standard Schema library) via `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md) — no classes or `class-validator`.

`NodeAdapter` from `@nestjs/platform-node` is the HTTP adapter used here (https://docs.nestjs.com/http/performance.md).

Nest's packages and this project are ESM only: relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), and tests run on Vitest (`vi.fn()`, not `jest.fn()`).
