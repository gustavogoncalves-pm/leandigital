export type Phase = 'IN' | 'ES' | 'PL' | 'DE' | 'QA' | 'HO' | 'IM' | 'OA' | 'EN';

export const PHASES: Phase[] = ['IN', 'ES', 'PL', 'DE', 'QA', 'HO', 'IM', 'OA', 'EN'];

export const PHASE_NAMES: Record<Phase, string> = {
  IN: 'Iniciação',
  ES: 'Especificação',
  PL: 'Planejamento',
  DE: 'Desenvolvimento',
  QA: 'Qualidade',
  HO: 'Homologação',
  IM: 'Implantação',
  OA: 'Operação Assistida',
  EN: 'Encerramento',
};

export const PHASE_DURATIONS: Record<Phase, string> = {
  IN: 'inicia',
  ES: 'especif',
  PL: 'planeja',
  DE: 'desenvol',
  QA: 'sem_q',
  HO: 'homolo',
  IM: 'implan',
  OA: 'operacao',
  EN: 'encerra',
};

// ==============================================================================
// TIPOS DE SKILL/CARGO PARAMETRIZÁVEIS
// ==============================================================================
export type SkillType = 'NEGOCIOS' | 'FULLSTACK' | 'BACKEND' | 'FRONTEND';

export const SKILL_TYPES: SkillType[] = ['NEGOCIOS', 'FULLSTACK', 'BACKEND', 'FRONTEND'];

export const SKILL_LABELS: Record<SkillType, string> = {
  NEGOCIOS: 'Negócios',
  FULLSTACK: 'Fullstack',
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
};

// ==============================================================================
// TIPO DE PROJETO (V48)
// ==============================================================================
export type ProjectType = 'PROPRIO' | 'TERCEIRO' | 'ACOMPANHAMENTO';

export const PROJECT_TYPES: ProjectType[] = ['PROPRIO', 'TERCEIRO', 'ACOMPANHAMENTO'];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  PROPRIO: 'Completo',
  TERCEIRO: 'Desenvolvimento',
  ACOMPANHAMENTO: 'Acompanhamento',
};

// Fluxos padrão de etapas por tipo de projeto
export const DEFAULT_PHASE_ORDER: Record<ProjectType, Phase[]> = {
  PROPRIO: ['IN', 'ES', 'PL', 'DE', 'QA', 'HO', 'IM', 'OA', 'EN'],
  TERCEIRO: ['IN', 'PL', 'HO', 'IM', 'EN'],
  ACOMPANHAMENTO: ['IN', 'PL', 'IM', 'OA', 'EN'],
};

// ==============================================================================
// PAPÉIS NA MATRIZ (V48)
// ==============================================================================
export type RoleType = 'RESPONSAVEL' | 'OBRIGATORIO' | 'PARTICIPA' | 'NAO_PARTICIPA';

export const ROLE_TYPES: RoleType[] = ['RESPONSAVEL', 'OBRIGATORIO', 'PARTICIPA', 'NAO_PARTICIPA'];

export const ROLE_LABELS: Record<RoleType, string> = {
  RESPONSAVEL: 'Responsável',
  OBRIGATORIO: 'Obrigatório',
  PARTICIPA: 'Participa',
  NAO_PARTICIPA: 'Não Participa',
};

// ==============================================================================
// MATRIZ DE REGRAS V48 (Etapa x Recurso -> Papel)
// ==============================================================================
export type RulesMatrix = Record<string, RoleType>; // key = "FASE|SKILL"

// ==============================================================================
// CAPACIDADE POR PERÍODO
// ==============================================================================
export interface CapacidadePeriodo {
  id: string;
  semanaInicio: number;
  anoInicio: number;
  semanaFim: number;
  anoFim: number;
  capacidade: number;
}

export interface CapacidadeConfig {
  padrao: number;
  periodos: CapacidadePeriodo[];
}

// ==============================================================================
// CONFIGURAÇÃO GLOBAL DO ENGINE V48
// ==============================================================================
export interface EngineConfig {
  capacidade: Record<SkillType, number>;
  capacidadePorPeriodo?: Record<SkillType, CapacidadeConfig>;
  ordemEtapas: Record<ProjectType, Phase[]>;
  matriz: Record<ProjectType, RulesMatrix>;
  coresEtapas?: Record<Phase, string>;
  coresFonteEtapas?: Record<Phase, string>;
  bufferSeguranca?: number; // Buffer de semanas para cálculo JIT (padrão: 2)
}

// Cores padrão das etapas (fundo)
export const DEFAULT_PHASE_COLORS: Record<Phase, string> = {
  IN: '#3b82f6', // blue
  ES: '#8b5cf6', // violet
  PL: '#6366f1', // indigo
  DE: '#f59e0b', // amber
  QA: '#10b981', // emerald
  HO: '#f97316', // orange
  IM: '#ec4899', // pink
  OA: '#14b8a6', // teal
  EN: '#22c55e', // green
};

// Cores padrão das fontes (texto)
export const DEFAULT_PHASE_FONT_COLORS: Record<Phase, string> = {
  IN: '#ffffff',
  ES: '#ffffff',
  PL: '#ffffff',
  DE: '#ffffff',
  QA: '#ffffff',
  HO: '#ffffff',
  IM: '#ffffff',
  OA: '#ffffff',
  EN: '#ffffff',
};

// Matriz padrão por tipo de projeto (baseada no script Python V48)
export function getDefaultMatrix(): Record<ProjectType, RulesMatrix> {
  const result: Record<ProjectType, RulesMatrix> = {
    PROPRIO: {},
    TERCEIRO: {},
    ACOMPANHAMENTO: {},
  };
  
  // Função auxiliar para criar regras
  const criarRegra = (tipo: ProjectType, fase: Phase, skill: SkillType, papel: RoleType) => {
    const key = `${fase}|${skill}`;
    result[tipo][key] = papel;
  };
  
  // PRÓPRIO: IN, ES, PL, DE, QA, HO, IM, OA, EN
  for (const fase of DEFAULT_PHASE_ORDER.PROPRIO) {
    for (const skill of SKILL_TYPES) {
      if (skill === 'NEGOCIOS') {
        if (['IN', 'ES', 'PL', 'QA', 'IM', 'HO', 'OA', 'EN'].includes(fase)) {
          criarRegra('PROPRIO', fase, skill, 'RESPONSAVEL');
        } else if (fase === 'DE') {
          criarRegra('PROPRIO', fase, skill, 'PARTICIPA');
        } else {
          criarRegra('PROPRIO', fase, skill, 'NAO_PARTICIPA');
        }
      } else {
        // DEVs (Fullstack, Backend, Frontend)
        if (fase === 'DE') {
          criarRegra('PROPRIO', fase, skill, 'RESPONSAVEL');
        } else if (['PL', 'QA', 'HO', 'IM', 'OA'].includes(fase)) {
          criarRegra('PROPRIO', fase, skill, 'OBRIGATORIO');
        } else {
          criarRegra('PROPRIO', fase, skill, 'NAO_PARTICIPA');
        }
      }
    }
  }
  
  // TERCEIRO: IN, PL, HO, IM, EN
  for (const fase of DEFAULT_PHASE_ORDER.TERCEIRO) {
    for (const skill of SKILL_TYPES) {
      if (skill === 'NEGOCIOS') {
        criarRegra('TERCEIRO', fase, skill, 'RESPONSAVEL');
      } else {
        if (['PL', 'HO', 'IM'].includes(fase)) {
          criarRegra('TERCEIRO', fase, skill, 'OBRIGATORIO');
        } else {
          criarRegra('TERCEIRO', fase, skill, 'NAO_PARTICIPA');
        }
      }
    }
  }
  
  // ACOMPANHAMENTO: IN, PL, IM, OA, EN
  for (const fase of DEFAULT_PHASE_ORDER.ACOMPANHAMENTO) {
    for (const skill of SKILL_TYPES) {
      if (skill === 'NEGOCIOS') {
        criarRegra('ACOMPANHAMENTO', fase, skill, 'RESPONSAVEL');
      } else {
        if (['PL', 'IM', 'OA'].includes(fase)) {
          criarRegra('ACOMPANHAMENTO', fase, skill, 'OBRIGATORIO');
        } else {
          criarRegra('ACOMPANHAMENTO', fase, skill, 'NAO_PARTICIPA');
        }
      }
    }
  }
  
  return result;
}

export function getDefaultConfig(): EngineConfig {
  return {
    capacidade: {
      NEGOCIOS: 2,
      FULLSTACK: 2,
      BACKEND: 1,
      FRONTEND: 1,
    },
    ordemEtapas: { ...DEFAULT_PHASE_ORDER },
    matriz: getDefaultMatrix(),
    coresEtapas: { ...DEFAULT_PHASE_COLORS },
    coresFonteEtapas: { ...DEFAULT_PHASE_FONT_COLORS },
    bufferSeguranca: 2, // Padrão: 2 semanas
  };
}

export function getEmptyConfig(): EngineConfig {
  return {
    capacidade: {
      NEGOCIOS: 0,
      FULLSTACK: 0,
      BACKEND: 0,
      FRONTEND: 0,
    },
    ordemEtapas: {
      PROPRIO: [],
      TERCEIRO: [],
      ACOMPANHAMENTO: [],
    },
    matriz: {
      PROPRIO: {},
      TERCEIRO: {},
      ACOMPANHAMENTO: {},
    },
    coresEtapas: { ...DEFAULT_PHASE_COLORS },
    coresFonteEtapas: { ...DEFAULT_PHASE_FONT_COLORS },
    bufferSeguranca: 2, // Padrão: 2 semanas
  };
}

// ==============================================================================
// TIPOS EXISTENTES
// ==============================================================================
export interface Project {
  id: string;
  nome: string;
  squad: string;
  prioridade: number;
  recursos: string[];
  duracoes: Record<Phase, number>;
  tipo?: ProjectType;
  // Datas obrigatórias (V48)
  anoInicioObrigatorio?: number;
  semanaInicioObrigatorio?: number;
  anoTerminoObrigatorio?: number;
  semanaTerminoObrigatorio?: number;
  // Saving/Ganho projetado
  saving?: number;
}

export interface Resource {
  id: string;
  nome: string;
  cargo: string;
  skill_recurso: SkillType;
  squad?: string;
  foto?: string; // base64 ou URL da foto
}

// Tipos de bloqueio (V48)
export type BlockType = 'FERIAS' | 'OUTRA_SQUAD' | 'SAIDA' | 'OUTROS';

export const BLOCK_TYPES: BlockType[] = ['FERIAS', 'OUTRA_SQUAD', 'SAIDA', 'OUTROS'];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  FERIAS: 'Férias',
  OUTRA_SQUAD: 'Alocado em outra Squad',
  SAIDA: 'Saída',
  OUTROS: 'Outros',
};

export interface Vacation {
  id: string;
  recurso: string;
  dataInicio: string; // formato DD/MM/YYYY
  dataFim: string;    // formato DD/MM/YYYY
  tipo?: BlockType;
  motivo?: string;
}

export interface Stage {
  id: number;
  sigla: Phase;
  nome: string;
}

export interface AllocationCell {
  status: string;
  blocked?: string;
}

export interface TimelineRow {
  recurso: string;
  cargo: string;
  prioridade: number;
  projeto: string;
  tipo?: ProjectType;
  semanas: Record<string, AllocationCell>;
}

export interface RoadmapRow {
  projeto: string;
  semanas: Record<string, Phase | ''>;
}

export interface PlanningData {
  projects: Project[];
  resources: Resource[];
  vacations: Vacation[];
  stages: Stage[];
}

export interface ViewPlanConfig {
  squad: string;
  semanaInicio: number;
  horizonte: number;
}
