# Aprendizados & Decisões Arquiteturais — Issue #38

> **Contexto:** Resolução da issue [#38](https://github.com/azevgabriel/teachy-test/issues/38) — *Corrigir resolução de blocos folha e persistência de metadados em planejamentos hierárquicos*.  
> **Aplicações impactadas:** `apps/service` (Backend NestJS + Prisma + IA Gemini) e `apps/web` (Frontend React + TanStack Router).

---

## 🎯 Visão Geral do Problema

Em planejamentos pedagógicos multinível (ex.: **Trimestre → Mês → Semana → Dia**), o sistema enfrentava três desafios críticos de consistência e persistência:

1. **Ambiguidade na resolução de blocos:** Comandos da IA que preenchiam semanas ou aulas usando `order: 1` ou intervalos de data acabavam sobrescrevendo o primeiro bloco encontrado (geralmente o bloco pai `MONTHLY` ou `TRIMESTER`), em vez do bloco folha correto (`WEEKLY`).
2. **Duplicação de estado em colunas nativas:** A coluna `metodologia` (física em `planning_blocks`) estava sendo gravada simultaneamente como metadado dinâmico na tabela EAV `planning_metadata_values`.
3. **Assimetria entre texto conversacional e patch estruturado:** A IA prometia na resposta visual ao professor que havia preenchido todas as colunas customizadas de todas as semanas pendentes, mas o envelope `<!--PLANNING_PATCH: ... -->` continha apenas uma coluna (`aulas_data`), devido a limitações do schema Zod e falta de diretrizes no System Prompt.

---

## 💡 Principais Aprendizados Técnicos

### 1. Resolução Hierárquica com Priorização de Nós Folha (*Leaf Node Priority*)
- **O Desafio:** Em uma árvore hierárquica, múltiplos blocos compartilham o mesmo `order` (ex.: Semana 1 do Mês 1 e Semana 1 do Mês 2 têm ambos `order: 1`) e os mesmos intervalos de datas (o Mês de Fevereiro e as semanas de Fevereiro englobam os mesmos dias).
- **A Solução:**
  - **Prioridade Estrutural:** Ao buscar blocos sem especificação de granularidade, o resolvedor prioriza **nós folha** (`children.length === 0`), garantindo que comandos de preenchimento de conteúdo afetem a menor unidade didática.
  - **Desambiguação em Cascata:** A resolução segue a ordem estrita:
    1. `blockId` explícito (alta precisão via snapshot da árvore).
    2. `parentId` + `order` (escopo local do mês pai).
    3. `granularity` + `date` (intervalo de tempo dentro da camada desejada).
  - **Guarda de Integridade XOR:** Na tabela `planning_metadata_values`, uma constraint XOR exige que o valor pertença ou ao planejamento macro (`planning_id`), ou a um bloco específico (`planning_block_id`). Se a resolução de bloco falhar em uma coluna de nível bloco, a gravação é suspensa com log de alerta para não corromper o banco com violação de chave estrangeira.

### 2. Invariante Anti-Duplicação para Colunas Físicas
- **O Desafio:** `planning_blocks.metodologia` é uma coluna relacional tipada no PostgreSQL. Quando scripts de patch gravavam `metodologia` como EAV em `planning_metadata_values`, criavam-se duas fontes da verdade. O frontend exibia ora o valor antigo da coluna física, ora valores conflitantes da tabela EAV.
- **A Solução:**
  - Centralização da regra: sempre que `colName === 'metodologia'`, a gravação é desviada exclusivamente para `prisma.planningBlock.update({ where: { id: blockId }, data: { metodologia } })`.
  - Limpeza de segurança atômica: execução imediata de `prisma.planningMetadataValue.deleteMany` para expurgar quaisquer registros residuais de `metodologia` da tabela EAV.

### 3. Flexibilidade de Schemas Zod vs. Capacidade Expressiva do LLM
- **O Desafio:** O schema `fillMetadataPatchSchema` foi inicialmente modelado com `colName` como string obrigatória no nível raiz. Consequentemente, para preencher 4 colunas customizadas em 12 semanas, o LLM precisaria emitir 4 operações separadas. Como o prompt só exemplificava patches de operação única, o LLM sofria restrição de sintaxe e emitia apenas a primeira coluna, alucinando no texto que havia feito todas.
- **A Solução:**
  - **Schema Polimórfico:** Tornamos `colName` opcional na raiz e permitimos que cada item do array `values` defina seu próprio `colName` (`{ blockId, colName, textValue }`), com validação superRefine do Zod garantindo que pelo menos um dos dois esteja presente.
  - **Suporte a Múltiplas Operações:** Documentação formal no envelope de suporte a `{ "operations": [ ... ] }` executadas sequencialmente no backend.
  - **Invariante de Fidelidade Texto-JSON:** Adição da regra explícita no System Prompt: *"NUNCA afirme no texto pedagógico que preencheu colunas ou blocos se você não incluiu TODOS eles no patch JSON delimitado"*.

### 4. Idempotência em Subdivisões Temporais (`REORGANIZE_TREE`)
- **O Desafio:** A rotina de subdivisão temporal abortava (`alreadySubdivided = true`) ao encontrar qualquer bloco filho preexistente. Se o mês já tivesse uma Semana 1 criada, as Semanas 2, 3 e 4 nunca eram geradas.
- **A Solução:**
  - Alteração da lógica para verificar a completude da grade (`order >= 4`).
  - Caso existam semanas parciais, o use case preserva a Semana 1 intacta (com seus IDs, metodologias e metadados) e instancia apenas as semanas faltantes necessárias para completar a grade de 4 semanas.

### 5. Paginação e Distribuição Visual de Blocos Pai (`apps/web`)
- **O Desafio:** Metadados associados aos blocos pai (ex.: temas gerais do mês) não eram considerados no cálculo de altura estática da tabela no frontend (`paginatePlanning.ts`), ocasionando corte visual e saltos de página desalinhados.
- **A Solução:**
  - Atualização do componente `SectionDivider` no frontend para renderizar metadados customizados do bloco pai.
  - Ajuste no orçamento vertical de páginas para computar a altura das divisórias pai dinamicamente.

---

## 📋 Checklist para Futuras Features & Issues

Ao lidar com hierarquias de planejamento e integração com LLM:

- [ ] **Nós folha vs. Nós agregadores:** Ao criar use cases de preenchimento, certifique-se de diferenciar nós folha de nós intermediários.
- [ ] **Constraint XOR:** Verifique sempre se novas tabelas dinâmicas respeitam a exclusividade mútua entre escopo macro e escopo de bloco.
- [ ] **Alinhamento Prompt-Schema:** Sempre que um novo comando ou campo for adicionado ao Zod, atualize os exemplos práticos em `patch-protocol.system.ts`.
- [ ] **Idempotência em Operações em Lote:** Use cases de reorganização e subdivisão de árvore devem ser capazes de rodar sobre árvores parciais sem apagar nem duplicar registros.
- [ ] **Testes de Regressão Unitários:** Mantenha testes de concorrência e hierarquia de 3 níveis cobrindo casos de colisão de `order` e `date`.
