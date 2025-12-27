import { 
  Project, Resource, Vacation, Phase, PHASES, TimelineRow, RoadmapRow, AllocationCell,
  EngineConfig, SkillType, SKILL_TYPES, getDefaultConfig, RoleType, ProjectType, BlockType,
  CapacidadeConfig
} from '@/types/planning';
import { addWeeks, eachWeekOfInterval, getISOWeek, getISOWeekYear, parse, startOfISOWeekYear, startOfWeek, getYear } from 'date-fns';

// ==============================================================================
// FUNÇÃO PARA OBTER CAPACIDADE POR PERÍODO
// ==============================================================================
function getCapacidadeParaSemana(
  config: EngineConfig,
  skill: SkillType,
  ano: number,
  semana: number
): number {
  if (!config.capacidadePorPeriodo || !config.capacidadePorPeriodo[skill]) {
    return config.capacidade[skill] || 99;
  }
  
  const configSkill = config.capacidadePorPeriodo[skill];
  
  for (const periodo of configSkill.periodos) {
    const inicioKey = periodo.anoInicio * 100 + periodo.semanaInicio;
    const fimKey = periodo.anoFim * 100 + periodo.semanaFim;
    const atualKey = ano * 100 + semana;
    
    if (atualKey >= inicioKey && atualKey <= fimKey) {
      return periodo.capacidade;
    }
  }
  
  return configSkill.padrao;
}

// ==============================================================================
// CONSTANTES DE TEXTO
// ==============================================================================
const TEXTO_OCIOSIDADE = "⏳ Aguardando";
const TEXTO_CONCLUIDO = "✅ Concluído";
const TEXTO_NAO_PARTICIPA = "---";
const TEXTO_TRAVADO_TEMPLATE = "⛔ Aguarda"; // Usado para startsWith
const TEXTO_AGUARDA_DATA = "📅 Aguarda Data";
const TEXTO_AGUARDA_JIT = "💤 Aguardando Início Otimizado";
const TEXTO_RESERVADO = "🔒 Reservado (Fluxo)"; // Recurso livre mas segurado para não quebrar fluxo
const TEXTO_NC = "❓ N/Cad";

// Constantes de papel
const OP_RESPONSAVEL: RoleType = 'RESPONSAVEL';
const OP_OBRIGATORIO: RoleType = 'OBRIGATORIO';
const OP_PARTICIPA: RoleType = 'PARTICIPA';
const OP_NAO_PARTICIPA: RoleType = 'NAO_PARTICIPA';

// ==============================================================================
// TIPOS AUXILIARES
// ==============================================================================

interface ProjectMetadata {
  termino_abs: number; // Semana absoluta de término (ano * 52 + semana)
  duracao_teorica: number; // Duração total do projeto em semanas
}

interface ProjectState {
  idx: number; // Índice da etapa atual na lista de fases
  rest: number; // Semanas restantes na etapa atual
  fim: boolean; // Se o projeto terminou
  em_andamento: boolean; // Se a etapa atual JÁ começou (flag de atomicidade)
  travado_por?: string; // Nome do recurso travando (para debug)
  inicio_obrigatorio_abs: number; // Data de início hard constraint (Ano * 52 + Sem)
  inicio_jit_abs: number; // Data de início sugerida pelo JIT (0 = não calculado)
  data_abs_efetiva: number; // max(inicio_obrigatorio_abs, inicio_jit_abs)
  tem_restricao_inicio: boolean;
  gap_counter: number; // Quantas semanas o projeto está parado esperando recurso
  ordem_fases: Phase[]; // Ordem de fases para este projeto
  recursos_proj: string[]; // Recursos do projeto (normalizados)
}

// Mapa de Bloqueios: Chave = "NOME_RECURSO|ANO|SEMANA", Valor = Motivo
type BlockMap = Map<string, { tipo: BlockType, motivo: string }>;

// Status individual de um recurso
interface StatusIndividual {
  status: 'OK' | 'FERIAS' | 'CHEIO' | 'NC' | 'OUTRA_SQUAD' | 'SAIU' | 'RESERVADO' | 'OUTROS';
  motivo: string;
  papel: RoleType;
  skill?: SkillType;
}

// ==============================================================================
// FUNÇÕES AUXILIARES
// ==============================================================================

function normalizar(texto: string): string {
  if (!texto) return "";
  return texto.toString().trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getISOWeekStart(isoYear: number, isoWeek: number): Date {
  const yearStart = startOfISOWeekYear(new Date(isoYear, 0, 4));
  return addWeeks(yearStart, isoWeek - 1);
}

function getMatrixKey(fase: Phase, skill: SkillType): string {
  return `${fase}|${skill}`;
}

function obterTipoProjeto(projeto: Project): ProjectType {
  if (projeto.tipo) return projeto.tipo;
  return 'PROPRIO';
}

// ==============================================================================
// PARSE DE DATA DD/MM/YYYY
// ==============================================================================

function parseDataBR(dataStr: string): Date | null {
  if (!dataStr) return null;
  try {
    const parts = dataStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      const fullYear = year < 100 ? 2000 + year : year;
      const date = new Date(fullYear, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }
    const parsed = parse(dataStr, 'M/d/yy', new Date());
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

// ==============================================================================
// MAPEAMENTO DE BLOQUEIOS (FÉRIAS, SAÍDA, ETC)
// ==============================================================================

function mapearBloqueios(vacations: Vacation[]): BlockMap {
  const bloqueios = new Map<string, { tipo: BlockType, motivo: string }>();
  
  for (const v of vacations) {
    const nome = normalizar(v.recurso);
    let tipoRaw = v.tipo || 'FERIAS';
    if ((tipoRaw as string).toUpperCase() === 'RIGIDO') tipoRaw = 'OUTRA_SQUAD';
    const tipo: BlockType = tipoRaw;
    const motivo = v.motivo || 'Férias';
    
    let dataInicio = parseDataBR(v.dataInicio);
    let dataFim = parseDataBR(v.dataFim);
    
    if (!dataInicio) continue;
    
    // Para tipo SAIDA, bloquear por 2 anos
    if (tipo === 'SAIDA') {
      dataFim = addWeeks(dataInicio, 100);
    }
    
    if (!dataFim) dataFim = dataInicio;
    
    // Limitar intervalo para evitar loops infinitos
    const minDataInicio = new Date(dataFim);
    minDataInicio.setFullYear(minDataInicio.getFullYear() - 2);
    if (dataInicio < minDataInicio) {
      dataInicio = minDataInicio;
    }
    
    // Correção data invertida
    if (dataInicio > dataFim) { 
      const temp = dataInicio; 
      dataInicio = dataFim; 
      dataFim = temp; 
    }
    
    try {
      const weeks = eachWeekOfInterval(
        { start: dataInicio, end: dataFim },
        { weekStartsOn: 1 }
      );
      
      for (const weekStart of weeks) {
        const ano = getISOWeekYear(weekStart);
        const sem = getISOWeek(weekStart);
        const chave = `${nome}|${ano}|${sem}`;
        
        // Prioriza o mais grave (SAIDA > OUTRA_SQUAD > FERIAS)
        if (!bloqueios.has(chave)) {
          bloqueios.set(chave, { tipo, motivo });
        } else {
          const atual = bloqueios.get(chave)!;
          if (tipo === 'SAIDA') {
            bloqueios.set(chave, { tipo, motivo });
          } else if (tipo === 'OUTRA_SQUAD' && atual.tipo === 'FERIAS') {
            bloqueios.set(chave, { tipo, motivo });
          }
        }
      }
    } catch {
      let current = new Date(dataInicio);
      while (current <= dataFim) {
        const ano = getISOWeekYear(current);
        const sem = getISOWeek(current);
        const chave = `${nome}|${ano}|${sem}`;
        if (!bloqueios.has(chave)) {
          bloqueios.set(chave, { tipo, motivo });
        }
        current.setDate(current.getDate() + 7);
      }
    }
  }
  
  return bloqueios;
}

// ==============================================================================
// FUNÇÃO: VALIDAR RECURSOS NA SEMANA (PORT DO PYTHON)
// ==============================================================================
// Retorna o status de cada recurso e se pelo menos um trabalhou
function validarRecursosNaSemana(
  recursosProj: string[],
  dicSkills: Record<string, SkillType>,
  faseAtual: Phase,
  tipoProjeto: ProjectType,
  ano: number,
  semana: number,
  alocacaoSemana: Record<string, number>,
  mapaBloqueios: BlockMap,
  regrasMatriz: Record<string, RoleType>,
  config: EngineConfig
): { resultadoFinal: Record<string, string>; trabalhou: boolean } {
  
  const statusIndiv: Record<string, StatusIndividual> = {};
  
  // 1. Analisa estado de cada recurso
  for (const rec of recursosProj) {
    if (!dicSkills[rec]) {
      statusIndiv[rec] = { status: 'NC', motivo: TEXTO_NC, papel: OP_NAO_PARTICIPA };
      continue;
    }
    
    const skill = dicSkills[rec];
    
    // Busca Papel (Role) na matriz
    const key = getMatrixKey(faseAtual, skill);
    let papel: RoleType = regrasMatriz[key] || OP_NAO_PARTICIPA;
    
    // Verifica Bloqueio (Blacklist)
    const chaveBlock = `${rec}|${ano}|${semana}`;
    const bloqueio = mapaBloqueios.get(chaveBlock);
    
    let status: StatusIndividual['status'] = 'OK';
    let motivo = faseAtual as string;
    
    if (bloqueio) {
      const t = bloqueio.tipo;
      const m = bloqueio.motivo;
      if (t === 'SAIDA') { 
        status = 'SAIU'; 
        motivo = '⛔ Saiu'; 
      } else if (t === 'OUTRA_SQUAD') { 
        status = 'OUTRA_SQUAD'; 
        motivo = `⛔ ${m.substring(0, 15)}`; 
      } else if (t === 'FERIAS') { 
        status = 'FERIAS'; 
        motivo = `🏖️ ${m.substring(0, 10)}`; 
      } else {
        status = 'OUTROS';
        motivo = `⛔ ${m.substring(0, 15)}`;
      }
    } else {
      // Verifica capacidade
      const capMax = getCapacidadeParaSemana(config, skill, ano, semana);
      const alocado = alocacaoSemana[rec] || 0;
      if (alocado >= capMax) {
        status = 'CHEIO';
        motivo = `Max(${capMax})`;
      }
    }
    
    statusIndiv[rec] = { status, motivo, papel, skill };
  }
  
  // 2. Decide se o projeto trava (verifica papéis críticos)
  let projetoTravado = false;
  let motivoTrava = "";
  
  for (const rec of recursosProj) {
    const dados = statusIndiv[rec];
    const st = dados.status;
    const papel = dados.papel;
    
    if (papel === OP_NAO_PARTICIPA) continue;
    if (st === 'OK') continue;
    
    // Se for Responsável ou Obrigatório e não está OK, trava tudo
    if (papel === OP_RESPONSAVEL || papel === OP_OBRIGATORIO) {
      projetoTravado = true;
      const primeiroNome = rec.split(' ')[0];
      motivoTrava = `⛔ Aguarda ${primeiroNome}`;
      break;
    }
  }
  
  // 3. Gera resultado final e determina se alguém trabalhou
  const resultadoFinal: Record<string, string> = {};
  let trabalhou = false;
  
  for (const rec of recursosProj) {
    const dados = statusIndiv[rec];
    const st = dados.status;
    const papel = dados.papel;
    
    // Se tem bloqueio (férias, saiu, outra squad), mostra o motivo (exceto se não participa)
    if (['SAIU', 'OUTRA_SQUAD', 'FERIAS', 'OUTROS'].includes(st)) {
      if (papel !== OP_NAO_PARTICIPA) {
        resultadoFinal[rec] = dados.motivo;
        continue;
      }
    }
    
    // Se não participa da fase
    if (papel === OP_NAO_PARTICIPA) {
      resultadoFinal[rec] = TEXTO_NAO_PARTICIPA;
      continue;
    }
    
    // Se projeto está travado
    if (projetoTravado) {
      if (st === 'OK') {
        resultadoFinal[rec] = motivoTrava;
      } else {
        resultadoFinal[rec] = dados.motivo;
      }
    } else {
      // Projeto pode andar
      if (st === 'OK') {
        resultadoFinal[rec] = `🔥 ${faseAtual}`;
        alocacaoSemana[rec] = (alocacaoSemana[rec] || 0) + 1;
        trabalhou = true;
      } else {
        resultadoFinal[rec] = dados.motivo;
      }
    }
  }
  
  return { resultadoFinal, trabalhou };
}

// ==============================================================================
// MOTOR DE SIMULAÇÃO (EXTRAÍDO PARA REUTILIZAÇÃO)
// ==============================================================================
function rodarMotorSimulacao(
  projects: Project[],
  resources: Resource[],
  vacations: Vacation[],
  semanaInicio: number,
  anoInicio: number,
  config: EngineConfig,
  mapaBloqueiosPreCalculado?: BlockMap,
  constraintsInicioJIT?: Record<string, number> // Map<projectId, semanaAbsoluta>
): { timeline: TimelineRow[]; metadados: Record<string, ProjectMetadata> } {
  
  const blockMap = mapaBloqueiosPreCalculado || mapearBloqueios(vacations);
  
  const dicSkills: Record<string, SkillType> = {};
  const dicCargos: Record<string, string> = {};
  
  resources.forEach(r => {
    const nome = normalizar(r.nome);
    dicSkills[nome] = r.skill_recurso;
    dicCargos[nome] = r.cargo;
  });

  const projectDurations = new Map<string, Record<Phase, number>>();

  const projetosOrdenados = [...projects].sort((a, b) => {
    const dataA = (a.anoInicioObrigatorio || 9999) * 100 + (a.semanaInicioObrigatorio || 99);
    const dataB = (b.anoInicioObrigatorio || 9999) * 100 + (b.semanaInicioObrigatorio || 99);
    if (dataA !== dataB) return dataA - dataB;
    return a.prioridade - b.prioridade;
  });

  const estado: Record<string, ProjectState> = {};
  const baseWeekStart = getISOWeekStart(anoInicio, semanaInicio);
  const absHoje = (anoInicio * 52) + semanaInicio;

  for (const p of projetosOrdenados) {
    const tipo = obterTipoProjeto(p);
    const ordemFases = config.ordemEtapas[tipo] || config.ordemEtapas.PROPRIO;
    
    const duracoes: Record<Phase, number> = {} as Record<Phase, number>;
    let duracaoTotalProjeto = 0;
    for (const fase of PHASES) {
      const dur = p.duracoes[fase] || 0;
      duracoes[fase] = dur;
      duracaoTotalProjeto += dur;
    }
    projectDurations.set(p.id, duracoes);

    let idx = 0;
    let durAtual = 0;
    while (idx < ordemFases.length) {
      durAtual = duracoes[ordemFases[idx]];
      if (durAtual > 0) break;
      idx++;
    }

    // Data obrigatória do Excel
    const dataObrig = (p.anoInicioObrigatorio && p.semanaInicioObrigatorio) 
      ? (p.anoInicioObrigatorio * 52 + p.semanaInicioObrigatorio) 
      : 0;

    // Data JIT (se fornecida)
    const dataJIT = constraintsInicioJIT?.[p.id] || 0;

    // Data efetiva: Se tem JIT, usa o MÁXIMO entre JIT e obrigatória
    let dataAbsEfetiva = 0;
    if (dataJIT > 0) {
      // Tem JIT: usa o máximo (JIT pode ser mais tarde, mas obrigatória é sagrada)
      dataAbsEfetiva = Math.max(dataJIT, dataObrig);
      // Debug: log quando há conflito entre JIT e obrigatória
      if (dataObrig > 0 && dataObrig !== dataJIT) {
        const usado = dataAbsEfetiva;
        const origem = dataObrig > dataJIT ? 'OBRIGATÓRIA' : 'JIT';
        console.log(`   ⚠️ Projeto ${p.nome.substring(0, 20)}: JIT=${dataJIT} vs Obrig=${dataObrig} → Usando ${usado} (${origem})`);
      }
    } else {
      // Não tem JIT: usa apenas obrigatória
      dataAbsEfetiva = dataObrig;
    }

    let recursosProj = p.recursos
      .map(r => normalizar(r))
      .filter(r => r && r !== 'NAN' && r !== 'NONE' && r !== '');

    if (recursosProj.length === 0) recursosProj = ['SEM RECURSO'];

    estado[p.id] = {
      idx: idx,
      rest: durAtual,
      fim: idx >= ordemFases.length,
      em_andamento: false,
      inicio_obrigatorio_abs: dataObrig,
      inicio_jit_abs: dataJIT,
      data_abs_efetiva: dataAbsEfetiva,
      tem_restricao_inicio: dataAbsEfetiva > 0,
      gap_counter: 0,
      ordem_fases: ordemFases,
      recursos_proj: recursosProj
    };
  }

  const timeline: Array<{
    recurso: string;
    cargo: string;
    skill: string;
    prioridade: number;
    projeto: string;
    tipo: ProjectType;
    ano: number;
    semana: number;
    semanaLabel: string;
    status: string;
  }> = [];

  const metadados: Record<string, ProjectMetadata> = {};
  
  let iteracao = 0;
  const maxIteracoes = 300;
  const projetosComConclusaoRegistrada = new Set<string>();

  while (true) {
    const todosFim = Object.values(estado).every(st => st.fim);
    const todosConclusaoRegistrada = projetosOrdenados.every(p => 
      !estado[p.id].fim || projetosComConclusaoRegistrada.has(p.id)
    );
    
    if ((todosFim && todosConclusaoRegistrada) || iteracao > maxIteracoes) break;

    const currentWeekStart = addWeeks(baseWeekStart, iteracao);
    const anoAtual = getISOWeekYear(currentWeekStart);
    const semAtual = getISOWeek(currentWeekStart);
    const simulacaoAbs = (anoAtual * 52) + semAtual;
    
    const lblSemana = `S${semAtual.toString().padStart(2, '0')}`;
    const semanaKey = `${anoAtual}-${lblSemana}`;
    
    const alocacaoSemana: Record<string, number> = {};

    // FILA DE PRIORIDADE DINÂMICA
    const lista = projetosOrdenados.map(p => {
      const st = estado[p.id];
      if (st.fim && projetosComConclusaoRegistrada.has(p.id)) {
        return { p, st, peso: 999999, esperaData: false };
      }

      let peso = p.prioridade;
      
      // Atomicidade suprema: projetos em andamento têm prioridade máxima
      if (st.em_andamento) peso -= 100000;
      
      // Se a data de início (JIT ou Excel) ainda não chegou, joga pro fim
      const esperaData = st.tem_restricao_inicio && simulacaoAbs < st.data_abs_efetiva;
      if (esperaData) peso += 9999999;

      return { p, st, peso, esperaData };
    }).sort((a, b) => a.peso - b.peso);

    // ALOCAÇÃO
    for (const item of lista) {
      const { p, st, esperaData } = item;
      const tipo = obterTipoProjeto(p);
      const ordemFases = st.ordem_fases;
      const recursosProj = st.recursos_proj;
      const regrasMatriz = config.matriz[tipo] || config.matriz.PROPRIO;
      
      if (st.fim && projetosComConclusaoRegistrada.has(p.id)) {
        continue;
      }
      
      if (st.fim && !projetosComConclusaoRegistrada.has(p.id)) {
        for (const rec of recursosProj) {
          const skill = dicSkills[rec] || '-';
          timeline.push({
            recurso: rec, 
            skill: String(skill), 
            cargo: dicCargos[rec] || '-',
            projeto: p.nome, 
            prioridade: p.prioridade, 
            tipo,
            ano: anoAtual,
            semana: semAtual,
            semanaLabel: semanaKey, 
            status: TEXTO_CONCLUIDO
          });
        }
        projetosComConclusaoRegistrada.add(p.id);
        continue;
      }

      // Se aguardando data de início
      if (esperaData) {
        for (const rec of recursosProj) {
          const skill = dicSkills[rec] || '-';
          const msg = constraintsInicioJIT ? TEXTO_AGUARDA_JIT : TEXTO_AGUARDA_DATA;
          timeline.push({
            recurso: rec, 
            skill: String(skill), 
            cargo: dicCargos[rec] || '-',
            projeto: p.nome, 
            prioridade: p.prioridade, 
            tipo,
            ano: anoAtual,
            semana: semAtual,
            semanaLabel: semanaKey, 
            status: msg
          });
        }
        continue;
      }

      const faseAtual = ordemFases[st.idx];
      
      const { resultadoFinal, trabalhou } = validarRecursosNaSemana(
        recursosProj,
        dicSkills,
        faseAtual,
        tipo,
        anoAtual,
        semAtual,
        alocacaoSemana,
        blockMap,
        regrasMatriz,
        config
      );
      
      for (const rec of recursosProj) {
        const skill = dicSkills[rec] || '-';
        timeline.push({
          recurso: rec, 
          skill: String(skill),
          cargo: dicCargos[rec] || '-',
          projeto: p.nome, 
          prioridade: p.prioridade, 
          tipo,
          ano: anoAtual,
          semana: semAtual,
          semanaLabel: semanaKey, 
          status: resultadoFinal[rec] || "Erro"
        });
      }

      if (trabalhou) {
        st.gap_counter = 0;
        st.em_andamento = true;
        st.rest -= 1;
        
        if (st.rest <= 0) {
          st.em_andamento = false;
          
          let novoIdx = st.idx + 1;
          while (novoIdx < ordemFases.length) {
            const proxFase = ordemFases[novoIdx];
            const dur = projectDurations.get(p.id)?.[proxFase] || 0;
            if (dur > 0) {
              st.idx = novoIdx;
              st.rest = dur;
              break;
            }
            novoIdx++;
          }
          
          if (novoIdx >= ordemFases.length) {
            st.fim = true;
            // Registrar metadados quando projeto termina
            // FIX: Soma apenas a duração teórica das fases que o projeto realmente possui
            const duracaoTeorica = st.ordem_fases.reduce((sum, fase) => {
              return sum + (projectDurations.get(p.id)?.[fase] || 0);
            }, 0);
            
            metadados[p.id] = {
              termino_abs: simulacaoAbs,
              duracao_teorica: duracaoTeorica
            };
          }
        }
      } else {
        st.gap_counter++;
      }
    }

    iteracao++;
  }

  // Adicionar timeline de disponibilidade apenas na segunda passada (JIT)
  if (constraintsInicioJIT) {
    const todasSemanas: string[] = [];
    for (let i = 0; i < iteracao; i++) {
      const weekStart = addWeeks(baseWeekStart, i);
      const ano = getISOWeekYear(weekStart);
      const sem = getISOWeek(weekStart);
      const lblSemana = `S${sem.toString().padStart(2, '0')}`;
      todasSemanas.push(`${ano}-${lblSemana}`);
    }

    for (const recurso of resources) {
      const nomeRec = normalizar(recurso.nome);
      
      for (const semanaKey of todasSemanas) {
        const [anoStr, semLabel] = semanaKey.split('-');
        const anoAtual = parseInt(anoStr);
        const numSemana = parseInt(semLabel.replace('S', ''));
        
        const chaveBlock = `${nomeRec}|${anoAtual}|${numSemana}`;
        const blockInfo = blockMap.get(chaveBlock);
        
        if (blockInfo) {
          let statusDisp = '';
          const tipo = blockInfo.tipo;
          if (tipo === 'SAIDA') {
            statusDisp = '⛔ Saiu';
          } else if (tipo === 'OUTRA_SQUAD') {
            statusDisp = `⛔ ${blockInfo.motivo.substring(0, 15)}`;
          } else if (tipo === 'OUTROS') {
            statusDisp = `⛔ ${blockInfo.motivo.substring(0, 15)}`;
          } else {
            statusDisp = `🏖️ ${blockInfo.motivo.substring(0, 10)}`;
          }
          
          timeline.push({
            recurso: nomeRec,
            cargo: dicCargos[nomeRec] || recurso.cargo,
            skill: dicSkills[nomeRec] || '-',
            prioridade: 0,
            projeto: '📅 Disponibilidade',
            tipo: 'PROPRIO' as ProjectType,
            ano: anoAtual,
            semana: numSemana,
            semanaLabel: semanaKey,
            status: statusDisp,
          });
        } else {
          timeline.push({
            recurso: nomeRec,
            cargo: dicCargos[nomeRec] || recurso.cargo,
            skill: dicSkills[nomeRec] || '-',
            prioridade: 0,
            projeto: '📅 Disponibilidade',
            tipo: 'PROPRIO' as ProjectType,
            ano: anoAtual,
            semana: numSemana,
            semanaLabel: semanaKey,
            status: '🟢',
          });
        }
      }
    }
  }

  // Agrupar timeline
  const grouped: Record<string, TimelineRow> = {};

  for (const item of timeline) {
    const key = `${item.recurso}|${item.prioridade}|${item.projeto}`;
    if (!grouped[key]) {
      grouped[key] = {
        recurso: item.recurso,
        cargo: item.cargo,
        prioridade: item.prioridade,
        projeto: item.projeto,
        tipo: item.tipo,
        semanas: {},
      };
    }
    
    const isBlocked = item.status.startsWith('⛔') || 
                      item.status.startsWith('🏖️') ||
                      item.status === TEXTO_OCIOSIDADE || 
                      item.status === TEXTO_AGUARDA_DATA ||
                      item.status === TEXTO_AGUARDA_JIT ||
                      item.status === TEXTO_RESERVADO ||
                      item.status.startsWith('🔒') ||
                      item.status.startsWith('Max(') ||
                      item.status === TEXTO_NC;
    
    grouped[key].semanas[item.semanaLabel] = {
      status: item.status,
      blocked: isBlocked ? item.status : undefined,
    };
  }

  const timelineFinal = Object.values(grouped).sort((a, b) => {
    if (a.recurso !== b.recurso) return a.recurso.localeCompare(b.recurso);
    return a.prioridade - b.prioridade;
  });

  return { timeline: timelineFinal, metadados };
}

// ==============================================================================
// MOTOR PRINCIPAL COM LÓGICA JIT
// ==============================================================================
export function generateAllocation(
  projects: Project[],
  resources: Resource[],
  vacations: Vacation[],
  semanaInicio: number,
  anoInicio: number,
  config?: EngineConfig
): TimelineRow[] {
  
  console.log("🚀 INICIANDO OTIMIZADOR DE FLUXO (JIT BUFFER DINAMICO)...");

  const cfg = config || getDefaultConfig();
  const absHoje = (anoInicio * 52) + semanaInicio;
  
  // 0. PRE-CALCULAR BLOQUEIOS GLOBALMENTE
  const blockMapGlobal = mapearBloqueios(vacations);

  // 1. SIMULAÇÃO BASE (ASAP)
  console.log("🔄 [Passo 1/2] Rodando Simulação Base (ASAP) para medir datas de término...");
  const { timeline: timelineBase, metadados: metaBase } = rodarMotorSimulacao(
    projects,
    resources,
    vacations,
    semanaInicio,
    anoInicio,
    cfg,
    blockMapGlobal, // Passa o mapa calculado
    undefined 
  );

  // 2. CÁLCULO JIT (BUFFER DINAMICO)
  const bufferSeguranca = cfg.bufferSeguranca ?? 2; 

  console.log(`🧠 [Otimizador] Calculando JIT (Buffer ${bufferSeguranca} Semanas)...`);
  const jitConstraints: Record<string, number> = {};

  for (const [pid, meta] of Object.entries(metaBase)) {
    const terminoReal = meta.termino_abs || 0;
    if (terminoReal === 0) continue;
    
    const duracaoTeorica = meta.duracao_teorica || 1;
    
    // 2.1 Cálculo inicial JIT
    let inicioTardioAbs = terminoReal - duracaoTeorica - bufferSeguranca;
    
    // 2.2 SCAN DE BLOQUEIOS (LOOK-AHEAD)
    // Se o cálculo matemático (inicioTardioAbs) colocar o projeto em colisão imediata com férias,
    // devemos antecipar o início para garantir que o trabalho seja feito *antes* ou desviado.
    
    // Apenas verificamos os recursos ALOCADOS ao projeto
    const projeto = projects.find(p => p.id === pid);
    const recursosDoProjeto = projeto?.recursos.map(r => normalizar(r)) || [];
    
    let semanasBloqueadasNoPeriodo = 0;
    
    // Varre as primeiras 4 semanas a partir do inicio calculado (Horizonte Curto)
    // Se logo no início já tiver bloqueio, temos que antecipar.
    const horizonteAnalise = 4; // Olha 1 mês pra frente
    
    for (let i = 0; i < horizonteAnalise; i++) {
       const semanaAbsAtual = inicioTardioAbs + i;
       
       // Não precisamos verificar se passa do término real, queremos apenas saber se o "arranque" é limpo
       // Converte semana absoluta para dados de calendário
       const dataDaSemana = addWeeks(getISOWeekStart(anoInicio, semanaInicio), semanaAbsAtual - absHoje);
       const anoIso = getISOWeekYear(dataDaSemana);
       const semIso = getISOWeek(dataDaSemana);

       let temBloqueioCritico = false;
       for (const rec of recursosDoProjeto) {
          const chave = `${rec}|${anoIso}|${semIso}`;
          if (blockMapGlobal.has(chave)) {
             const info = blockMapGlobal.get(chave);
             // Bloqueios que impedem trabalho: Férias, Saída, Outra Squad
             if (info && ['FERIAS', 'SAIDA', 'OUTRA_SQUAD'].includes(info.tipo)) {
                temBloqueioCritico = true;
                break;
             }
          }
       }
       
       if (temBloqueioCritico) {
          semanasBloqueadasNoPeriodo++;
       }
    }

    // Se encontrou bloqueios no horizonte imediato de início, antecipa o projeto
    // Isso evita que o Buffer 0 comece exatamente numa semana morta
    if (semanasBloqueadasNoPeriodo > 0) {
       console.log(`   🛡️ Projeto ${projeto?.nome.substring(0,15)}: Bloqueio detectado no arranque. Antecipando ${semanasBloqueadasNoPeriodo} semanas.`);
       inicioTardioAbs -= semanasBloqueadasNoPeriodo;
    }

    // 2.3 Validações Finais
    const dataObrigProj = (projeto?.anoInicioObrigatorio && projeto?.semanaInicioObrigatorio) 
      ? (projeto.anoInicioObrigatorio * 52 + projeto.semanaInicioObrigatorio) 
      : 0;
    
    if (inicioTardioAbs < absHoje) {
      console.log(`   ⚠️ JIT calculado (${inicioTardioAbs}) está no passado (hoje=${absHoje}), limitando para hoje`);
      inicioTardioAbs = absHoje;
    }
    
    if (dataObrigProj > 0 && dataObrigProj < inicioTardioAbs) {
      console.log(`   ℹ️ Projeto tem data obrigatória (${dataObrigProj}) menor que JIT (${inicioTardioAbs}), JIT será usado`);
    } else if (dataObrigProj > 0 && dataObrigProj > inicioTardioAbs) {
      console.log(`   ⚠️ Projeto tem data obrigatória (${dataObrigProj}) maior que JIT (${inicioTardioAbs}), obrigatória será usada`);
    }
    
    jitConstraints[pid] = inicioTardioAbs;
    
    const nomeProj = projeto?.nome || pid;
    console.log(`   Proj: ${nomeProj.substring(0, 20)}... | Fim: ${terminoReal} | Teórica: ${duracaoTeorica} | Antecipação: ${semanasBloqueadasNoPeriodo} | Buffer: ${bufferSeguranca} | JIT Final: ${inicioTardioAbs}`);
  }

  // 3. SIMULAÇÃO OTIMIZADA (JIT)
  console.log("🔄 [Passo 2/2] Rodando Simulação Otimizada (Smart Squeeze)...");
  const { timeline: timelineOtimizada } = rodarMotorSimulacao(
    projects,
    resources,
    vacations,
    semanaInicio,
    anoInicio,
    cfg,
    blockMapGlobal, 
    jitConstraints
  );

  return timelineOtimizada;
}

// ==============================================================================
// GERADOR DE ROADMAP
// ==============================================================================

export function generateRoadmapFromAllocation(
  allocation: TimelineRow[],
  projects: Project[],
  weeks: string[]
): RoadmapRow[] {
  const roadmap: RoadmapRow[] = [];

  const alocacoesPorProjeto: Record<string, TimelineRow[]> = {};
  
  for (const row of allocation) {
    if (!alocacoesPorProjeto[row.projeto]) {
      alocacoesPorProjeto[row.projeto] = [];
    }
    alocacoesPorProjeto[row.projeto].push(row);
  }

  for (const projeto of projects) {
    const row: RoadmapRow = {
      projeto: projeto.nome,
      semanas: {},
    };

    const alocacoesProj = alocacoesPorProjeto[projeto.nome] || [];

    for (const week of weeks) {
      let faseAtiva: Phase | '' = '';
      
      for (const aloc of alocacoesProj) {
        const cell = aloc.semanas[week];
        if (cell) {
          const status = cell.status;
          const statusLimpo = status.replace('🔥 ', '');
          if (statusLimpo && !statusLimpo.startsWith('⛔') && 
              statusLimpo !== TEXTO_OCIOSIDADE && 
              statusLimpo !== TEXTO_NAO_PARTICIPA && 
              statusLimpo !== TEXTO_AGUARDA_DATA && 
              statusLimpo !== TEXTO_AGUARDA_JIT &&
              statusLimpo !== TEXTO_RESERVADO &&
              !statusLimpo.startsWith('🔒')) {
            if (PHASES.includes(statusLimpo as Phase)) {
              faseAtiva = statusLimpo as Phase;
              break;
            }
          }
        }
      }

      row.semanas[week] = faseAtiva;
    }

    roadmap.push(row);
  }

  return roadmap;
}

// ==============================================================================
// FUNÇÕES AUXILIARES EXPORTADAS
// ==============================================================================

export function getWeeksFromAllocation(allocation: TimelineRow[]): string[] {
  const weeksSet = new Set<string>();
  allocation.forEach(row => {
    Object.keys(row.semanas).forEach(week => weeksSet.add(week));
  });
  
  return Array.from(weeksSet).sort((a, b) => {
    const [anoA, semA] = a.split('-');
    const [anoB, semB] = b.split('-');
    if (anoA !== anoB) return anoA.localeCompare(anoB);
    return semA.localeCompare(semB);
  });
}

export function getWeeksInRange(semanaInicio: number, horizonte: number): string[] {
  const weeks: string[] = [];
  for (let i = semanaInicio; i < semanaInicio + horizonte; i++) {
    weeks.push(`S${i}`);
  }
  return weeks;
}