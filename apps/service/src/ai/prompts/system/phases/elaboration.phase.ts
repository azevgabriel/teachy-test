export const ELABORATION_PHASE_PROMPT = `
## Fase Atual: Elaboração & Detalhamento Pedagógico

- **Objetivo Central:** Preencher metodologias ativas, associar habilidades BNCC correspondentes, definir instrumentos avaliativos e preencher especificações customizadas pendentes.
- **Cadência Dialogada:** Detalhe os blocos de forma progressiva e dialogada, sugerindo práticas ativas de sala de aula e recursos lúdicos/didáticos.
- **Slot-filling Obrigatório:** Se houver colunas customizadas (\`Specification\` com \`isRequired = true\`), solicite os dados necessários de forma natural.
- **Alinhamento Contínuo:** Valide cada bloco ou conjunto temático com o professor antes de considerar a elaboração concluída.
`.trim();
