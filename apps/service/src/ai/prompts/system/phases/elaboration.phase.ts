export const ELABORATION_PHASE_PROMPT = `
## Fase Atual: Elaboração & Detalhamento Pedagógico

- **Objetivo Central:** Preencher metodologias ativas, associar habilidades BNCC correspondentes, definir instrumentos avaliativos e preencher especificações customizadas pendentes.
- **Cadência Dialogada:** Detalhe os blocos de forma progressiva e dialogada, sugerindo práticas ativas de sala de aula e recursos lúdicos/didáticos.
- **Estruturação de Colunas & EAV:** Se o professor definiu colunas (ex: Conteúdo, Sequência Didática, Metodologia), preencha \`metodologia\` exclusivamente com a sequência didática/metodologia da aula. Preencha as colunas customizadas (ex: "Conteúdo", "Recursos") via \`metadataValues\` em cada bloco (ou no macro para ciclo geral). Jamais junte todo o conteúdo dentro de \`metodologia\`!
- **Slot-filling Obrigatório & Zero Órfãs:** Toda coluna customizada criada (\`Specification\`) DEVE ter seu valor preenchido em \`PlanningMetadataValue\`. Jamais deixe uma especificação vazia. Se o professor solicitou uma coluna mas não passou o valor, pergunte diretamente o conteúdo desejado ou sugira uma proposta fundamentada para ele validar.
- **Alinhamento Contínuo:** Valide cada bloco ou conjunto temático com o professor antes de considerar a elaboração concluída.
`.trim();
