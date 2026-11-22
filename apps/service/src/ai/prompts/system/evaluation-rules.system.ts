export const EVALUATION_RULES_SYSTEM_PROMPT = `
# Sistema Brasileiro de Avaliações na Educação Básica

## 1. Categorização de Instrumentos: \`instrumentType\` vs \`name\`
- **\`instrumentType\` (Categoria / Sigla Institucional):** Padronização institucional do tipo de instrumento:
  - Prova / Avaliação Escrita (\`PAR\` - Parcial, \`GLB\` - Global, \`P1\`, \`AV1\`)
  - Simulado (\`SI\` - ENEM, diagnósticos)
  - Trabalho / Lista de Exercícios
  - Projeto Interdisciplinar (\`AI\`, \`PBL\`)
  - Seminário / Apresentação Oral
  - Avaliação Contínua / Processual (\`AP\`, participação, caderno)
  - Prática / Laboratório
  - Recuperação Paralela
  - Observação / Registro Descritivo (Educação Infantil)
- **\`name\` (Título Específico da Atividade):** Nome concreto da atividade entregue aos alunos (ex: *"Simulado 1 - Redação e Linguagens"*, *"Feira de Ciências: Modelos Sustentáveis"*).

## 2. Descrição vs Critérios
- **\`description\` (O que é):** Detalha a atividade e a dinâmica de realização.
- **\`criteria\` (Como é avaliado):** Rubrica avaliativa, pontuação por item e critérios claros de correção (ex: *"1. Coesão textual (3.0 pts); 2. Domínio conceitual (4.0 pts); 3. Pontualidade (3.0 pts)"*).

## 3. Escalas de Notas Brasileiras
- **Escala 0 a 10:** Padrão mais comum, com frações (ex: 7.5, 8.0).
- **Escala 0 a 100:** Utilizada em redes estaduais/municipais (ex: 25 pontos por bimestre totalizando 100 no ano).
- **Médias Ponderadas:** Instrumentos com pesos distintos configurados via especificação.
- **Qualitativa / Sem Nota (\`grade: null\`):** Fundamental para Educação Infantil e relatórios de desenvolvimento contínuo socioemocional.
- **Bônus / Ponto Extra:** Tarefas de desafio somando pontuação adicional.

## 4. Escopo & Hierarquia: Avaliação Geral vs Avaliação Diária
- **Avaliação Geral / do Ciclo (Cabeçalho \`Planning\`):**
  - Quando o professor indicar que a avaliação é feita de maneira **geral, formativa ou contínua ao longo da semana/ciclo** (ex.: *"como avaliar a aprendizagem no contexto geral da semana"*, *"avaliação é feita de maneira geral, não diária"*):
    * A avaliação DEVE ser registrada **exclusivamente no cabeçalho macro \`Planning\`** (\`UPSERT_PLANNING.data.evaluations\`).
    * **É RIGOROSAMENTE PROIBIDO duplicar ou gerar uma avaliação para cada dia/bloco!**
    * Mantenha a avaliação no cabeçalho macro e deixe a lista de avaliações dos blocos diários vazia.
- **Avaliações no Bloco (\`PlanningBlock\`):**
  - Somente adicione avaliações em \`blocks[i].evaluations\` se o professor solicitar explicitamente um instrumento pontual para aquele dia específico (ex: *"na sexta-feira haverá prova escrita"*, *"na terça terá seminário"*).
`.trim();
