import { describe, expect, it } from 'vitest';
import { DualOutputStreamTransformer } from './dual-output-stream-transformer.js';

describe('DualOutputStreamTransformer', () => {
  it('deve extrair texto visual limpo e validar o envelope de patch emitido em bloco único', () => {
    const transformer = new DualOutputStreamTransformer();
    const visualChunks: string[] = [];

    const fullMessage = `Olá professor! Estruturei a primeira semana de Ciências.

<!--PLANNING_PATCH:
{
  "operation": "UPDATE_BLOCK_BY_DATE",
  "data": {
    "date": "2026-03-02",
    "metodologia": "Experimento prático sobre misturas homogêneas"
  }
}
-->`;

    transformer.processChunk(fullMessage, (chunk) => visualChunks.push(chunk));
    const result = transformer.finalize();

    const emittedVisual = visualChunks.join('');
    expect(emittedVisual).toContain('Olá professor! Estruturei a primeira semana de Ciências.');
    expect(emittedVisual).not.toContain('PLANNING_PATCH');
    expect(emittedVisual).not.toContain('UPDATE_BLOCK_BY_DATE');

    expect(result.cleanText).toBe('Olá professor! Estruturei a primeira semana de Ciências.');
    expect(result.patch).toEqual({
      operation: 'UPDATE_BLOCK_BY_DATE',
      data: {
        date: '2026-03-02',
        metodologia: 'Experimento prático sobre misturas homogêneas',
      },
    });
  });

  it('deve reter e suprimir delimitadores mesmo quando fracionados entre múltiplos chunks', () => {
    const transformer = new DualOutputStreamTransformer();
    const visualChunks: string[] = [];

    // Chunks intencionalmente partidos na borda do marcador <!--PLANNING_PATCH:
    const chunks = [
      'Ótima sugestão! Vamos ajustar o planejamento. ',
      '<!-',
      '-PLAN',
      'NING_PATCH: ',
      '{"operation": "RESET_PLANNING", "data": {}}',
      ' -->',
    ];

    for (const chunk of chunks) {
      transformer.processChunk(chunk, (c) => visualChunks.push(c));
    }

    const result = transformer.finalize();
    const emittedVisual = visualChunks.join('');

    // Garante que absolutamente nenhum pedaço do marcador vazou
    expect(emittedVisual).toBe('Ótima sugestão! Vamos ajustar o planejamento. ');
    expect(emittedVisual).not.toContain('<!-');
    expect(emittedVisual).not.toContain('PLANNING_PATCH');

    expect(result.cleanText).toBe('Ótima sugestão! Vamos ajustar o planejamento.');
    expect(result.patch).toEqual({
      operation: 'RESET_PLANNING',
      data: {},
    });
  });

  it('não deve engolir tags HTML legítimas que não formam o marcador de patch', () => {
    const transformer = new DualOutputStreamTransformer();
    const visualChunks: string[] = [];

    const chunks = [
      'Este é um texto com ',
      '<strong>',
      'destaque pedagógico',
      '</strong>',
      ' e nada mais.',
    ];

    for (const chunk of chunks) {
      transformer.processChunk(chunk, (c) => visualChunks.push(c));
    }

    const result = transformer.finalize();
    const emittedVisual = visualChunks.join('');

    expect(emittedVisual).toBe('Este é um texto com <strong>destaque pedagógico</strong> e nada mais.');
    expect(result.cleanText).toBe('Este é um texto com <strong>destaque pedagógico</strong> e nada mais.');
    expect(result.patch).toBeNull();
  });

  it('deve retornar erro em caso de JSON malformado sem quebrar o texto visual limpo', () => {
    const transformer = new DualOutputStreamTransformer();
    const visualChunks: string[] = [];

    const brokenMessage = `Texto visual explicativo.
<!--PLANNING_PATCH:
{ "operation": "READ_ONLY", brokenJson: true,
-->`;

    transformer.processChunk(brokenMessage, (c) => visualChunks.push(c));
    const result = transformer.finalize();

    expect(visualChunks.join('')).toBe('Texto visual explicativo.\n');
    expect(result.cleanText).toBe('Texto visual explicativo.');
    expect(result.patch).toBeNull();
    expect(result.error).toContain('JSON malformado');
  });

  it('deve retornar patch nulo graciosamente quando a mensagem não contém envelope', () => {
    const transformer = new DualOutputStreamTransformer();
    const visualChunks: string[] = [];

    const pureText = 'Apenas uma resposta reflexiva sem mutação ou envelope estruturado.';
    transformer.processChunk(pureText, (c) => visualChunks.push(c));
    const result = transformer.finalize();

    expect(visualChunks.join('')).toBe(pureText);
    expect(result.cleanText).toBe(pureText);
    expect(result.patch).toBeNull();
    expect(result.error).toBeUndefined();
  });
});
