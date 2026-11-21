# TanStack Router Guidelines (`ROUTER.md`)

Single source of truth for routing, navigation, layout composition, and search params/loader lifecycle in `apps/web/`.

> **MVP Scope:** Não há autenticação neste MVP. Todas as rotas são públicas.

---

## 1. File-Based Routing Conventions

`apps/web/` uses TanStack Router with automated file-based routing and Vite code splitting:

- **Routes Directory:** All application routes reside under `src/routes/`.
- **Root Route (`src/routes/__root.tsx`):**
  - Defines the global wrapper layout with `<Outlet />`.
  - Injects global styles (`../styles.css`).
- **Route Declaration Pattern:**
  - Standard page routes are defined using `createFileRoute`:
    ```tsx
    import { createFileRoute } from '@tanstack/react-router'

    export const Route = createFileRoute('/lesson-plans')({
      component: LessonPlansPage,
    })

    function LessonPlansPage() {
      return <div>Lesson Plans</div>
    }
    ```
- **File Naming & URL Structure:**
  - `src/routes/index.tsx` → `/`
  - `src/routes/lesson-plans/index.tsx` → `/lesson-plans`
  - `src/routes/lesson-plans/$planId.tsx` → `/lesson-plans/:planId` (parameterized route)
  - `src/routes/_layout.tsx` → Pathless layout wrapper (shared layouts without changing the URL path)

---

## 2. Type-Safe Search Params & Context Prefetching (`loader` + `loaderDeps`)

> [!NOTE]
> **Padrão REST Assíncrono (`async/await`):** Para rotas que consultam diretamente o banco de dados via backend/Prisma (ex.: requisições `GET` para recuperar sessões anteriores ou carregar metadados), utiliza-se o padrão REST convencional com `async/await` dentro do `loader`. O uso de streams (SSE) é reservado para respostas de LLM.

Para rotas que dependem de parâmetros de busca na URL (ex: carregar o contexto de uma sessão existente via query param `?sessionId=...`), o TanStack Router orquestra a validação dos parâmetros e a busca de dados na API **antes de renderizar a tela**.

### Fluxo de Execução:
1. **`validateSearch`:** Valida e tipa os query params da URL via schema (Zod). Garante que parâmetros inválidos ou ausentes sejam sanitizados logo na entrada.
2. **`loaderDeps`:** Monitora alterações nos search params selecionados (`deps: ({ search }) => ({ sessionId: search.sessionId })`). Sempre que o valor mudar, o loader é acionado automaticamente.
3. **`loader`:** Executa a chamada assíncrona à API para recuperar o contexto antes da montagem do componente.
4. **`pendingComponent`:** Exibe um skeleton ou estado de carregamento enquanto o `loader` obtém os dados.
5. **`errorComponent`:** Renderiza uma mensagem amigável caso a API falhe ou a sessão não seja encontrada.
6. **Consumo no Componente:** O componente consome os dados tipados via `Route.useLoaderData()` e os parâmetros de busca via `Route.useSearch()`.

### Padrão de Implementação:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// 1. Schema de validação do query param
const searchSchema = z.object({
  sessionId: z.string().uuid().optional(),
})

export const Route = createFileRoute('/lesson-plans')({
  // 2. Validação e coerção do query param
  validateSearch: (search) => searchSchema.parse(search),

  // 3. Monitoramento de dependências para re-execução do loader
  loaderDeps: ({ search: { sessionId } }) => ({ sessionId }),

  // 4. Pré-busca na API antes da renderização da tela
  loader: async ({ deps: { sessionId } }) => {
    if (!sessionId) {
      return null
    }

    const response = await fetch(`/api/sessions/${sessionId}`)
    if (!response.ok) {
      throw new Error('Não foi possível carregar a sessão informada.')
    }

    return response.json()
  },

  // 5. Estado visual durante o carregamento
  pendingComponent: LessonPlanSkeleton,

  // 6. Tratamento de erro na rota
  errorComponent: ({ error }) => <ErrorAlert message={error.message} />,

  // 7. Componente principal da página
  component: LessonPlansPage,
})

function LessonPlansPage() {
  // Dados pré-carregados pelo loader (100% tipados)
  const sessionContext = Route.useLoaderData()
  // Search params validados
  const { sessionId } = Route.useSearch()

  return (
    <div className="container mx-auto p-6">
      {sessionId && sessionContext ? (
        <section>
          <h2>Editando Sessão: {sessionContext.title}</h2>
          {/* Renderização com contexto carregado da API */}
        </section>
      ) : (
        <section>
          <h2>Nova Sessão de Planejamento</h2>
          {/* Formulário limpo para nova sessão */}
        </section>
      )}
    </div>
  )
}
```

---

## 3. Type-Safe Navigation

Utilize `<Link>` ou `useNavigate()` com rotas tipadas para garantir validação em tempo de compilação:

```tsx
import { Link, useNavigate } from '@tanstack/react-router'

// Navegação declarativa com tipagem estrita de search params
<Link
  to="/lesson-plans"
  search={{ sessionId: 'a3f78b12-9c34-4b82-9012-3456789abcde' }}
>
  Retomar Sessão
</Link>

// Navegação imperativa
const navigate = useNavigate()
navigate({
  to: '/lesson-plans',
  search: { sessionId: newSessionId },
})
```

---

## 4. Auxílio do TanStack MCP para Roteamento & Navegação

Quando estiver lidando com navegação, rotas, layouts ou carregamento de contexto na interface, o agente tem à disposição o **TanStack MCP** para auxiliar no desenho e orquestração do fluxo de telas:

- **Estruturação de Rotas:** O agente consulta as convenções do TanStack Router para definir rotas baseadas em arquivos (`createFileRoute`), rotas parametrizadas (ex: `/lesson-plans/$planId.tsx`) e layouts aninhados (`_layout.tsx`).
- **Validação e Tipagem de Search Params:** Orientação para estruturar schemas de validação com Zod em `validateSearch`, garantindo coerção de tipos em tempo de compilação e sanitização dos parâmetros de URL.
- **Prefetching e Gerenciamento de Ciclo de Vida (`loader` / `loaderDeps`):** Auxílio na definição de dependências reativas para disparar loaders de dados antes da renderização dos componentes, associando estados visuais de carregamento (`pendingComponent`) e erro (`errorComponent`).
- **Navegação Segura:** Garantia de que links declarativos (`<Link>`) e navegações programáticas (`useNavigate()`) permaneçam 100% sincronizados com a árvore de rotas tipada da aplicação.
