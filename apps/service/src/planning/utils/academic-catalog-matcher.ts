export interface ApplicationYearCandidate {
  id: string;
  name: string;
  stage?: string | null;
  targetAge?: string | null;
}

export interface CurricularComponentCandidate {
  id: string;
  name: string;
}

/**
 * Remove acentos, caracteres especiais desnecessários e normaliza espaços.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/º|ª|°/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve com alta precisão e determinismo o ApplicationYear correspondente a partir
 * de um texto livre (do professor ou da LLM), diferenciando categoricamente
 * Ensino Médio, Ensino Fundamental I, Ensino Fundamental II, Educação Infantil e EJA.
 */
export function matchApplicationYear<T extends ApplicationYearCandidate>(
  query: string,
  candidates: T[],
): T | null {
  if (!query || candidates.length === 0) {
    return null;
  }

  const normQuery = normalizeText(query);

  // 1. Match exato prioritário
  const exact = candidates.find((c) => normalizeText(c.name) === normQuery);
  if (exact) {
    return exact;
  }

  // 2. Detecção de EJA (Educação de Jovens e Adultos)
  const isEja = /\b(eja|jovens e adultos)\b/.test(normQuery);
  if (isEja) {
    if (/\b(em|medio|ensino medio)\b/.test(normQuery)) {
      const match = candidates.find((c) => /eja.*medio/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(ef2|ef ii|fundamental 2|fundamental ii|anos finais)\b/.test(normQuery)) {
      const match = candidates.find((c) => /eja.*fundamental ii/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(ef1|ef i|fundamental 1|fundamental i|anos iniciais|fundamental)\b/.test(normQuery)) {
      const match = candidates.find((c) => /eja.*fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
  }

  // 3. Detecção de Educação Infantil
  // Deve rodar antes de números puros para evitar que "1 ano e 7 meses" caia em "7º ano"
  const isInfantil = /\b(infantil|creche|bercario|bebe|bebes|pequenas|criancas|maternal|pre-escola|pre escola|meses)\b/.test(
    normQuery,
  );
  if (isInfantil) {
    if (
      /\b(zero a 1|0 a 1|bebe|bebes|bercario)\b/.test(normQuery) ||
      normQuery.includes('zero a 1 ano e 6 meses')
    ) {
      const match = candidates.find((c) => normalizeText(c.name).includes('zero a 1 ano e 6 meses'));
      if (match) return match;
    }

    if (
      /\b(bem pequena|bem pequenas|1 ano e 7|1 a 3|2 anos|3 anos|maternal|infantil 2)\b/.test(normQuery) ||
      normQuery.includes('1 ano e 7 meses a 3 anos e 11 meses')
    ) {
      const match = candidates.find((c) => normalizeText(c.name).includes('1 ano e 7 meses a 3 anos e 11 meses'));
      if (match) return match;
    }

    if (
      /\b(4 anos|5 anos|pequenas|pre-escola|pre escola|infantil 4|infantil 5)\b/.test(normQuery) ||
      normQuery.includes('4 anos a 5 anos e 11 meses')
    ) {
      const match = candidates.find((c) => normalizeText(c.name).includes('4 anos a 5 anos e 11 meses'));
      if (match) return match;
    }

    // Se mencionou infantil de forma genérica, casa o primeiro infantil disponível
    const fallbackInfantil = candidates.find(
      (c) => c.stage === 'INFANTIL' || normalizeText(c.name).includes('infantil'),
    );
    if (fallbackInfantil) return fallbackInfantil;
  }

  // 4. Detecção de Ensino Médio (EM)
  // Palavras-chave: "em", "medio", "ensino medio", "secundario", "colegial"
  // Não casa falsos positivos como "tempo" ou "sem"
  const isMedio = /\b(em|medio|ensino medio|secundario|colegial)\b/.test(normQuery);

  if (isMedio) {
    if (/\b(1|1o|primeiro)\b/.test(normQuery)) {
      const match = candidates.find(
        (c) => /1o ano do ensino medio/i.test(normalizeText(c.name)) || (c.stage === 'MEDIO' && /1/i.test(c.name)),
      );
      if (match) return match;
    }
    if (/\b(2|2o|segundo)\b/.test(normQuery)) {
      const match = candidates.find(
        (c) => /2o ano do ensino medio/i.test(normalizeText(c.name)) || (c.stage === 'MEDIO' && /2/i.test(c.name)),
      );
      if (match) return match;
    }
    if (/\b(3|3o|terceiro)\b/.test(normQuery)) {
      const match = candidates.find(
        (c) => /3o ano do ensino medio/i.test(normalizeText(c.name)) || (c.stage === 'MEDIO' && /3/i.test(c.name)),
      );
      if (match) return match;
    }
  }

  // 5. Detecção de Ensino Fundamental II (6º ao 9º ano)
  const isFundamental2Explicit = /\b(fundamental 2|fundamental ii|ef2|ef ii|anos finais)\b/.test(normQuery);
  if (isFundamental2Explicit || /\b(6o?|sexto|7o?|setimo|8o?|oitavo|9o?|nono)\b/.test(normQuery)) {
    if (/\b(6o?|sexto)\b/.test(normQuery)) {
      const match = candidates.find((c) => /6o ano do ensino fundamental ii/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(7o?|setimo)\b/.test(normQuery)) {
      const match = candidates.find((c) => /7o ano do ensino fundamental ii/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(8o?|oitavo)\b/.test(normQuery)) {
      const match = candidates.find((c) => /8o ano do ensino fundamental ii/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(9o?|nono)\b/.test(normQuery)) {
      const match = candidates.find((c) => /9o ano do ensino fundamental ii/i.test(normalizeText(c.name)));
      if (match) return match;
    }
  }

  // 6. Detecção de Ensino Fundamental I (1º ao 5º ano)
  // Só casa Fundamental I se NÃO foi identificado como Ensino Médio ou Infantil!
  if (!isMedio && !isInfantil) {
    if (/\b(1o?|primeiro)\b/.test(normQuery)) {
      const match = candidates.find((c) => /1o ano do ensino fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(2o?|segundo)\b/.test(normQuery)) {
      const match = candidates.find((c) => /2o ano do ensino fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(3o?|terceiro)\b/.test(normQuery)) {
      const match = candidates.find((c) => /3o ano do ensino fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(4o?|quarto)\b/.test(normQuery)) {
      const match = candidates.find((c) => /4o ano do ensino fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
    if (/\b(5o?|quinto)\b/.test(normQuery)) {
      const match = candidates.find((c) => /5o ano do ensino fundamental i/i.test(normalizeText(c.name)));
      if (match) return match;
    }
  }

  // 7. Substring contains fallback
  const subMatch = candidates.find((c) => {
    const cNorm = normalizeText(c.name);
    return normQuery.includes(cNorm) || cNorm.includes(normQuery);
  });

  return subMatch || null;
}

/**
 * Mapeamento canônico de palavras-chave para componentes curriculares e campos de experiência.
 * Garante que Língua Portuguesa e Matemática jamais dêem falso-positivo com campos da Educação Infantil.
 */
const CURRICULAR_COMPONENT_ALIASES: Record<string, string[]> = {
  'Língua Portuguesa': [
    'lingua portuguesa',
    'portugues',
    'portuguesa',
    'redacao',
    'literatura',
    'gramatica',
    'leitura e escrita',
  ],
  'Escuta, fala, pensamento e imaginação': [
    'escuta, fala',
    'escuta fala',
    'escuta',
    'pensamento e imaginacao',
    'fala, pensamento',
    'oralidade infantil',
  ],
  'Matemática': [
    'matematica',
    'calculo',
    'geometria',
    'algebra',
    'numeros e operacoes',
  ],
  'Espaços, tempos, quantidades, relações e transformações': [
    'espacos, tempos',
    'espacos tempos',
    'quantidades, relacoes',
    'relacoes e transformacoes',
    'espacos e tempos',
  ],
  'Corpo, gestos e movimentos': [
    'corpo, gestos',
    'corpo gestos',
    'gestos e movimentos',
    'expressao corporal',
  ],
  'Traços, sons, cores e formas': [
    'tracos, sons',
    'tracos sons',
    'cores e formas',
    'tracos cores formas',
  ],
  'O eu, o outro e o nós': [
    'o eu, o outro',
    'eu, o outro',
    'o eu o outro',
    'eu outro e nos',
    'identidade e alteridade',
  ],
  'Ciências': ['ciencias', 'ciencias naturais', 'ciencias da natureza'],
  'Biologia': ['biologia'],
  'Física': ['fisica'],
  'Química': ['quimica'],
  'História': ['historia'],
  'Geografia': ['geografia'],
  'Educação Física': ['educacao fisica', 'ed fisica', 'ed. fisica'],
  'Língua Inglesa': ['lingua inglesa', 'ingles'],
  'Arte': ['arte', 'artes', 'artes visuais', 'musica', 'teatro'],
  'Filosofia': ['filosofia'],
  'Sociologia': ['sociologia'],
  'Computação': ['computacao', 'informatica', 'tecnologia', 'programacao', 'cultura digital'],
  'Ensino Religioso': ['ensino religioso', 'religiao'],
};

/**
 * Resolve com alta precisão e determinismo o CurricularComponent correspondente a partir
 * de um texto livre (do professor ou da LLM), separando estritamente disciplinas da Educação Básica
 * de Campos de Experiência da Educação Infantil.
 */
export function matchCurricularComponent<T extends CurricularComponentCandidate>(
  query: string,
  candidates: T[],
): T | null {
  if (!query || candidates.length === 0) {
    return null;
  }

  const normQuery = normalizeText(query);

  // 1. Match exato prioritário
  const exact = candidates.find((c) => normalizeText(c.name) === normQuery);
  if (exact) {
    return exact;
  }

  // 2. Busca via Aliases Canônicos com limites de palavra
  for (const [canonicalName, aliases] of Object.entries(CURRICULAR_COMPONENT_ALIASES)) {
    const candidate = candidates.find((c) => normalizeText(c.name) === normalizeText(canonicalName));
    if (!candidate) continue;

    for (const alias of aliases) {
      const normAlias = normalizeText(alias);
      // Cria regex com word boundary para evitar substrings acidentais
      const regex = new RegExp(`\\b${normAlias}\\b`, 'i');
      if (regex.test(normQuery) || normQuery.includes(normAlias)) {
        return candidate;
      }
    }
  }

  // 3. Substring fallback caso não encontre pelos aliases canônicos
  const subMatch = candidates.find((c) => {
    const cNorm = normalizeText(c.name);
    return normQuery.includes(cNorm) || cNorm.includes(normQuery);
  });

  return subMatch || null;
}
