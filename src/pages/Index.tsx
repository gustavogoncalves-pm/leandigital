import { useState, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Project, Resource, Vacation, TimelineRow, EngineConfig, getDefaultConfig, getEmptyConfig, SKILL_TYPES, SKILL_LABELS, BlockType, PROJECT_TYPE_LABELS, ROLE_LABELS, PHASE_NAMES, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS } from '@/types/planning';
import { sampleProjects, sampleResources, sampleVacations } from '@/data/sample-data';
import { RoadmapView } from '@/components/RoadmapView';
import { AllocationView } from '@/components/AllocationView';
import { ProjectsTable } from '@/components/ProjectsTable';
import { DataTable } from '@/components/DataTable';
import { PhaseLegend } from '@/components/PhaseLegend';
import { ConfigPanel } from '@/components/ConfigPanel';
import { RulesMatrixPanel } from '@/components/RulesMatrixPanel';
import { CapacityPeriodsPanel } from '@/components/CapacityPeriodsPanel';
import { generateAllocation, getWeeksFromAllocation } from '@/lib/allocation-engine';
import { PDFExportDialog } from '@/components/PDFExportDialog';
import { exportRoadmapPDF } from '@/lib/pdf-export';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Users, Briefcase, Palmtree, Eye, Download, Upload, FileSpreadsheet, Trash2, FileText, Filter, LayoutDashboard, Bug } from 'lucide-react';
import { DashboardPanel } from '@/components/DashboardPanel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

const Index = () => {
  const [projects, setProjects] = useState<Project[]>(sampleProjects);
  const [resources, setResources] = useState<Resource[]>(sampleResources);
  const [vacations, setVacations] = useState<Vacation[]>(sampleVacations);
  const [semanaInicio, setSemanaInicio] = useState(1);
  const [anoInicio, setAnoInicio] = useState(2026);
  const [dataInicio, setDataInicio] = useState('');
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(getEmptyConfig());
  const [selectedSquad, setSelectedSquad] = useState<string>('');
  const importFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const logsRef = useRef<string[]>([]);
  const originalConsoleLogRef = useRef<typeof console.log | null>(null);

  // Interceptar console.log para capturar logs do allocation-engine
  useMemo(() => {
    if (!originalConsoleLogRef.current) {
      originalConsoleLogRef.current = console.log.bind(console);
      
      console.log = (...args: any[]) => {
        // Chamar o console.log original
        originalConsoleLogRef.current!(...args);
        
        // Capturar logs do allocation-engine
        const message = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        
        // Filtrar apenas logs relevantes do allocation-engine
        if (message.includes('INICIANDO OTIMIZADOR') || 
            message.includes('Passo 1/2') || 
            message.includes('Passo 2/2') ||
            message.includes('Otimizador') || 
            message.includes('Calculando JIT') ||
            message.includes('Proj:') || 
            message.includes('⚠️') || 
            message.includes('ℹ️') ||
            message.includes('JIT Calc:') ||
            message.includes('JIT Final:') ||
            message.includes('Buffer:')) {
          const timestamp = new Date().toISOString();
          logsRef.current.push(`[${timestamp}] ${message}`);
          
          // Manter apenas os últimos 2000 logs
          if (logsRef.current.length > 2000) {
            logsRef.current = logsRef.current.slice(-2000);
          }
        }
      };
    }
  }, []);

  // Extrair squads únicas dos projetos
  const availableSquads = useMemo(() => {
    const squads = new Set<string>();
    projects.forEach(p => {
      if (p.squad) squads.add(p.squad.toUpperCase().trim());
    });
    return Array.from(squads).sort();
  }, [projects]);

  // Gerar alocação automaticamente quando parâmetros mudam
  const allocation = useMemo(() => {
    // Limpar logs antigos antes de gerar nova alocação (opcional - comentado para manter histórico)
    // logsRef.current = [];
    return generateAllocation(projects, resources, vacations, semanaInicio, anoInicio, engineConfig);
  }, [projects, resources, vacations, semanaInicio, anoInicio, engineConfig]);

  // Filtrar alocação e projetos pela squad selecionada
  const filteredAllocation = useMemo(() => {
    if (!selectedSquad) return allocation;
    
    // Primeiro, filtrar projetos reais pela squad
    const projectRows = allocation.filter(row => {
      if (row.projeto === '📅 Disponibilidade') return false;
      const project = projects.find(p => p.nome === row.projeto);
      return project?.squad?.toUpperCase().trim() === selectedSquad;
    });
    
    // Recursos que têm projetos na squad selecionada
    const recursosNaSquad = new Set(projectRows.map(r => r.recurso.toUpperCase().trim()));
    
    // Incluir linhas de disponibilidade para recursos que têm projetos na squad
    const availabilityRows = allocation.filter(row => 
      row.projeto === '📅 Disponibilidade' && 
      recursosNaSquad.has(row.recurso.toUpperCase().trim())
    );
    
    return [...projectRows, ...availabilityRows];
  }, [allocation, selectedSquad, projects]);

  const filteredProjects = useMemo(() => {
    if (!selectedSquad) return projects;
    return projects.filter(p => p.squad?.toUpperCase().trim() === selectedSquad);
  }, [projects, selectedSquad]);


  const handleExportSimulationResult = useCallback(() => {
    const weeks = getWeeksFromAllocation(allocation);
    
    const data = allocation.map(row => {
      const rowData: Record<string, string | number> = {
        'Recurso': row.recurso,
        'Cargo': row.cargo,
        'Prioridade': row.prioridade,
        'Projeto': row.projeto,
      };
      
      weeks.forEach(week => {
        const cell = row.semanas[week];
        rowData[week] = cell ? (cell.blocked || cell.status) : '';
      });
      
      return rowData;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    const colWidths = [
      { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 30 },
      ...weeks.map(() => ({ wch: 8 })),
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Resultado_Simulacao');
    
    const fileName = `Resultado_Simulacao_${anoInicio}_S${semanaInicio}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "✅ Excel Exportado", description: `Resultado da simulação exportado.` });
  }, [allocation, semanaInicio, anoInicio, toast]);

  // Semanas disponíveis para exportação PDF
  const availableWeeks = useMemo(() => getWeeksFromAllocation(filteredAllocation), [filteredAllocation]);

  const handleExportPDF = useCallback((startWeek?: string, endWeek?: string) => {
    try {
      exportRoadmapPDF({
        projects: filteredProjects,
        allocation: filteredAllocation,
        resources,
        phaseColors: engineConfig.coresEtapas || DEFAULT_PHASE_COLORS,
        phaseFontColors: engineConfig.coresFonteEtapas || DEFAULT_PHASE_FONT_COLORS,
        anoInicio,
        semanaInicio,
        squadFilter: selectedSquad || undefined,
        engineConfig,
        startWeek,
        endWeek,
      });
      toast({ title: "✅ PDF Exportado", description: `Planejamento exportado em PDF.` });
    } catch (e) {
      console.error(e);
      toast({
        title: "❌ Erro ao gerar PDF",
        description: "O relatório tem muitas semanas para caber em uma página; ajustei para quebrar em várias páginas. Recarregue e tente novamente.",
        variant: "destructive",
      });
    }
  }, [filteredProjects, filteredAllocation, resources, engineConfig, anoInicio, semanaInicio, selectedSquad, toast]);

  const handleExportInputData = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Tab Projetos - estrutura igual ao template
    const projectsData = projects.map((p, idx) => ({
      id_projeto: idx + 1,
      tipo_projeto: PROJECT_TYPE_LABELS[p.tipo || 'PROPRIO'],
      nome_projeto: p.nome,
      nome_squad: p.squad,
      prioridade: p.prioridade,
      ganho_projetado: '',
      tag: '',
      classificacao: '',
      complexidade: '',
      ano_inicio_obrigatorio: p.anoInicioObrigatorio || '',
      inicio_obrigatorio: p.semanaInicioObrigatorio || '',
      ano_termino_obrigatorio: p.anoTerminoObrigatorio || '',
      termino_obrigatorio: p.semanaTerminoObrigatorio || '',
      num_sem_iniciacao: p.duracoes.IN,
      num_sem_especificacao: p.duracoes.ES,
      num_sem_planejamento: p.duracoes.PL,
      num_sem_desenvolvimento: p.duracoes.DE,
      num_sem_qa: p.duracoes.QA,
      num_sem_homologacao: p.duracoes.HO,
      num_sem_implantacao: p.duracoes.IM,
      num_sem_operacaoassistida: p.duracoes.OA,
      num_sem_encerramento: p.duracoes.EN,
      nome_recurso1: p.recursos[0] || '',
      nome_recurso2: p.recursos[1] || '',
      nome_recurso3: p.recursos[2] || '',
      nome_recurso4: p.recursos[3] || '',
      nome_recurso5: p.recursos[4] || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsData), 'tab_projetos');

    // Tab Recursos - estrutura igual ao template
    const resourcesData = resources.map((r, idx) => ({
      id_recurso: idx + 1,
      nome_recurso: r.nome,
      cargo_recurso: r.cargo,
      skill_recurso: r.skill_recurso,
      contrato_recurso: '',
      nome_squad: r.squad || '',
      foto_recurso: '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesData), 'tab_recursos');

    // Tab Disponibilidade - estrutura igual ao template (inicio, termino ao invés de data_inicio, data_fim)
    const vacationsData = vacations.map((v, idx) => ({
      id_ferias: idx + 1,
      nome_recurso: v.recurso,
      inicio: v.dataInicio,
      termino: v.dataFim,
      tipo: v.tipo === 'FERIAS' ? 'Férias' : v.tipo === 'OUTRA_SQUAD' ? 'Outra Squad' : v.tipo === 'SAIDA' ? 'Saída' : 'Outros',
      motivo: v.motivo || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vacationsData), 'tab_disponibilidade');

    // Tab Config - estrutura igual ao template (Parâmetro/Valor)
    const configData = [
      { Parâmetro: 'Squad', Valor: '' },
      { Parâmetro: 'Data de Início', Valor: dataInicio },
      { Parâmetro: 'Semana Calculada', Valor: `${semanaInicio}/${anoInicio}` },
      { Parâmetro: '--- CAPACIDADES ---', Valor: '' },
      { Parâmetro: 'Máx. NEGOCIOS', Valor: engineConfig.capacidade.NEGOCIOS },
      { Parâmetro: 'Máx. FULLSTACK', Valor: engineConfig.capacidade.FULLSTACK },
      { Parâmetro: 'Máx. BACKEND', Valor: engineConfig.capacidade.BACKEND },
      { Parâmetro: 'Máx. FRONTEND', Valor: engineConfig.capacidade.FRONTEND },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configData), 'tab_config');

    // Tab Matriz - formato pivotado igual ao template (Tipo Projeto | Etapa | skills | cores)
    const matrizData: any[] = [];
    (['PROPRIO', 'TERCEIRO', 'ACOMPANHAMENTO'] as const).forEach(tipo => {
      const etapas = engineConfig.ordemEtapas[tipo] || [];
      etapas.forEach((etapa) => {
        const row: any = {
          'Tipo Projeto': PROJECT_TYPE_LABELS[tipo],
          'Etapa': etapa,
        };
        
        // Adicionar papel de cada skill
        ['NEGOCIOS', 'FULLSTACK', 'BACKEND', 'FRONTEND'].forEach(skill => {
          const key = `${etapa}|${skill}`;
          const papel = engineConfig.matriz[tipo]?.[key] || 'NAO_PARTICIPA';
          row[skill] = ROLE_LABELS[papel] || papel;
        });
        
        // Adicionar cores
        row['COR_FUNDO'] = engineConfig.coresEtapas?.[etapa] || '';
        row['COR_FONTE'] = engineConfig.coresFonteEtapas?.[etapa] || '';
        
        matrizData.push(row);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrizData), 'tab_matriz');

    const fileName = `Dados_Simulacao_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "✅ Excel Exportado", description: `Dados de entrada exportados com sucesso.` });
  }, [projects, resources, vacations, semanaInicio, anoInicio, dataInicio, engineConfig, toast]);

  const handleImportData = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Importar Projetos
        const projetosSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('projeto'));
        if (projetosSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[projetosSheet]);
          const importedProjects: Project[] = jsonData.map((row: any, idx: number) => {
            const getVal = (keys: string[]) => {
              for (const key of keys) {
                const found = Object.keys(row).find(k => k.toLowerCase().replace(/[_\s]/g, '') === key.toLowerCase().replace(/[_\s]/g, ''));
                if (found && row[found] !== undefined && row[found] !== '') return row[found];
              }
              return undefined;
            };
            
            const recursos: string[] = [];
            for (let i = 1; i <= 5; i++) {
              const rec = getVal([`nome_recurso${i}`, `recurso${i}`]);
              if (rec && String(rec).trim()) recursos.push(String(rec).trim());
            }

            const tipoRaw = String(getVal(['tipo_projeto', 'tipo']) || 'Completo').toUpperCase();
            let tipo: 'PROPRIO' | 'TERCEIRO' | 'ACOMPANHAMENTO' = 'PROPRIO';
            if (tipoRaw.includes('DESENVOLV') || tipoRaw.includes('TERCEIRO')) tipo = 'TERCEIRO';
            else if (tipoRaw.includes('ACOMP')) tipo = 'ACOMPANHAMENTO';
            else if (tipoRaw.includes('COMPLET') || tipoRaw.includes('PROPRIO')) tipo = 'PROPRIO';
            
            return {
              id: Date.now().toString() + idx,
              nome: String(getVal(['nome_projeto', 'nome']) || ''),
              squad: String(getVal(['nome_squad', 'squad']) || 'ECHO BR').toUpperCase(),
              prioridade: Number(getVal(['prioridade'])) || idx + 1,
              tipo,
              recursos,
              duracoes: {
                IN: Number(getVal(['num_sem_iniciacao'])) || 0,
                ES: Number(getVal(['num_sem_especificacao'])) || 0,
                PL: Number(getVal(['num_sem_planejamento'])) || 0,
                DE: Number(getVal(['num_sem_desenvolvimento'])) || 0,
                QA: Number(getVal(['num_sem_qa'])) || 0,
                HO: Number(getVal(['num_sem_homologacao'])) || 0,
                IM: Number(getVal(['num_sem_implantacao'])) || 0,
                OA: Number(getVal(['num_sem_operacaoassistida'])) || 0,
                EN: Number(getVal(['num_sem_encerramento'])) || 0,
              },
              anoInicioObrigatorio: Number(getVal(['ano_inicio_obrigatorio'])) || undefined,
              semanaInicioObrigatorio: Number(getVal(['inicio_obrigatorio'])) || undefined,
              anoTerminoObrigatorio: Number(getVal(['ano_termino_obrigatorio'])) || undefined,
              semanaTerminoObrigatorio: Number(getVal(['termino_obrigatorio'])) || undefined,
            };
          }).filter(p => p.nome);
          if (importedProjects.length > 0) setProjects(importedProjects);
        }

        // Importar Recursos
        const recursosSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('recurso'));
        if (recursosSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[recursosSheet]);
          // Helper para normalizar acentos
          const normalizeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          const importedResources: Resource[] = jsonData.map((row: any, idx: number) => {
            const getVal = (keys: string[]) => {
              for (const key of keys) {
                const found = Object.keys(row).find(k => k.toLowerCase().replace(/[_\s]/g, '') === key.toLowerCase().replace(/[_\s]/g, ''));
                if (found && row[found] !== undefined && row[found] !== '') return row[found];
              }
              return undefined;
            };
            
            // Normaliza skill removendo acentos (NEGÓCIOS → NEGOCIOS)
            const skillRaw = String(getVal(['skill_recurso', 'skill']) || '');
            const skillNormalized = normalizeAccents(skillRaw).toUpperCase().trim();

            // Fallback: infere skill pelo cargo quando a coluna skill vier vazia/inválida
            const cargoRaw = String(getVal(['cargo_recurso', 'cargo']) || '');
            const cargoNorm = normalizeAccents(cargoRaw).toUpperCase();
            const inferredSkill = cargoNorm.includes('ANALISTA')
              ? 'NEGOCIOS'
              : cargoNorm.includes('FRONT')
                ? 'FRONTEND'
                : cargoNorm.includes('BACK')
                  ? 'BACKEND'
                  : 'FULLSTACK';

            const allowedSkills = ['NEGOCIOS', 'FULLSTACK', 'BACKEND', 'FRONTEND'];
            const finalSkill = allowedSkills.includes(skillNormalized) ? skillNormalized : inferredSkill;
            
            return {
              id: Date.now().toString() + idx,
              nome: String(getVal(['nome_recurso', 'nome']) || ''),
              cargo: String(getVal(['cargo_recurso', 'cargo']) || ''),
              skill_recurso: finalSkill as any || 'FULLSTACK',
              squad: String(getVal(['nome_squad', 'squad']) || ''),
            };
          }).filter(r => r.nome);
          if (importedResources.length > 0) setResources(importedResources);
        }

        // Importar Disponibilidade
        const dispSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('disponibilidade') || n.toLowerCase().includes('ferias'));
        if (dispSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[dispSheet]);
          
          // Helper para normalizar acentos
          const removeAccents = (str: string) => String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          // Helper para formatar datas do Excel para DD/MM/YYYY
          const formatDateVal = (v: any): string => {
            if (v === undefined || v === null || v === '') return '';
            if (v instanceof Date && !Number.isNaN(v.getTime())) {
              const dd = String(v.getDate()).padStart(2, '0');
              const mm = String(v.getMonth() + 1).padStart(2, '0');
              const yyyy = v.getFullYear();
              return `${dd}/${mm}/${yyyy}`;
            }
            if (typeof v === 'number') {
              const dc = XLSX.SSF.parse_date_code(v);
              if (dc?.y && dc?.m && dc?.d) {
                const dd = String(dc.d).padStart(2, '0');
                const mm = String(dc.m).padStart(2, '0');
                return `${dd}/${mm}/${dc.y}`;
              }
            }
            return String(v).trim();
          };
          
          const importedVacations: Vacation[] = jsonData.map((row: any, idx: number) => {
            const getVal = (keys: string[]) => {
              for (const key of keys) {
                const keyNorm = removeAccents(key).toLowerCase().replace(/[_\s]/g, '');
                const found = Object.keys(row).find(k => removeAccents(k).toLowerCase().replace(/[_\s]/g, '') === keyNorm);
                if (found && row[found] !== undefined && row[found] !== '') return row[found];
              }
              return undefined;
            };
            
            // Mapear tipos - normalizar acentos (Férias → FERIAS) e tipos antigos (RIGIDO → OUTRA_SQUAD)
            let tipoRaw = String(getVal(['tipo']) || 'FERIAS');
            let tipoVal = removeAccents(tipoRaw).toUpperCase();
            if (tipoVal === 'RIGIDO') tipoVal = 'OUTRA_SQUAD';
            if (tipoVal === 'OUTROS') tipoVal = 'OUTROS';
            if (tipoVal !== 'FERIAS' && tipoVal !== 'OUTRA_SQUAD' && tipoVal !== 'SAIDA' && tipoVal !== 'OUTROS') {
              tipoVal = 'FERIAS';
            }
            
            return {
              id: Date.now().toString() + idx,
              recurso: String(getVal(['nome_recurso', 'recurso']) || ''),
              dataInicio: formatDateVal(getVal(['inicio', 'data_inicio', 'datainicio'])),
              dataFim: formatDateVal(getVal(['termino', 'data_fim', 'datafim', 'fim'])),
              tipo: tipoVal as any,
              motivo: String(getVal(['motivo']) || ''),
            };
          }).filter(v => v.recurso);
          if (importedVacations.length > 0) setVacations(importedVacations);
        }

        // Helpers globais p/ normalização e leitura robusta de colunas
        const normalizeAccentsGlobal = (str: string) => String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // remove espaços, símbolos e pontuação (ex: "Máx. NEGÓCIOS" -> "maxnegocios")
        const normalizeKey = (str: string) => normalizeAccentsGlobal(str).toLowerCase().replace(/[^a-z0-9]/g, '');

        const getRowVal = (row: any, keys: string[]) => {
          for (const wanted of keys) {
            const wantedN = normalizeKey(wanted);
            const found = Object.keys(row).find((k) => normalizeKey(k) === wantedN);
            if (found && row[found] !== undefined && row[found] !== '') return row[found];
          }
          return undefined;
        };

        const getSheetHeaders = (sheetName: string): string[] => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const headerRow = rows?.[0] || [];
          return headerRow.map((h) => normalizeKey(String(h)));
        };

        const formatExcelDateDDMMYYYY = (v: any): string => {
          if (v === undefined || v === null || v === '') return '';
          if (v instanceof Date && !Number.isNaN(v.getTime())) {
            const dd = String(v.getDate()).padStart(2, '0');
            const mm = String(v.getMonth() + 1).padStart(2, '0');
            const yyyy = v.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
          }
          if (typeof v === 'number') {
            const dc = XLSX.SSF.parse_date_code(v);
            if (dc?.y && dc?.m && dc?.d) {
              const dd = String(dc.d).padStart(2, '0');
              const mm = String(dc.m).padStart(2, '0');
              return `${dd}/${mm}/${dc.y}`;
            }
          }
          return String(v).trim();
        };

        // Importar Config - procura por nome ou por cabeçalho (Parâmetro | Valor)
        const configSheet =
          workbook.SheetNames.find((n) => {
            const name = normalizeKey(n);
            return (
              (name.includes('tabconfig') || name.includes('config') || name.includes('parametro') || name.includes('parametros')) &&
              !name.includes('fluxo') &&
              !name.includes('matriz') &&
              !name.includes('matrix')
            );
          }) ??
          workbook.SheetNames.find((n) => {
            const headers = getSheetHeaders(n);
            return headers.includes('parametro') && headers.includes('valor');
          });

        if (configSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[configSheet]);
          const newCap = { ...engineConfig.capacidade };

          jsonData.forEach((row: any) => {
            const paramRaw = getRowVal(row, ['parametro', 'parâmetro', 'parameter']);
            const val = getRowVal(row, ['valor', 'value']);
            const param = normalizeKey(String(paramRaw ?? ''));
            if (!param) return;

            if (param === 'semanainicio' || param === 'semanacalculada') {
              const valStr = String(val ?? '').trim();
              const wm = valStr.match(/(\d{1,2})\s*\/\s*(\d{4})/);
              if (wm) {
                setSemanaInicio(Number(wm[1]));
                setAnoInicio(Number(wm[2]));
              } else {
                const m = valStr.match(/(\d+)/);
                if (m) setSemanaInicio(Number(m[1]));
              }
            }

            if (param === 'anoinicio') setAnoInicio(Number(val));

            if (param === 'datadeinicio' || param === 'datainicio') {
              const formatted = formatExcelDateDDMMYYYY(val);
              if (formatted) setDataInicio(formatted);
            }

            if (param === 'maxnegocios' || param === 'capacidadenegocios') newCap.NEGOCIOS = Number(val);
            if (param === 'maxfullstack' || param === 'capacidadefullstack') newCap.FULLSTACK = Number(val);
            if (param === 'maxbackend' || param === 'capacidadebackend') newCap.BACKEND = Number(val);
            if (param === 'maxfrontend' || param === 'capacidadefrontend') newCap.FRONTEND = Number(val);
          });

          setEngineConfig((prev) => ({ ...prev, capacidade: newCap }));
        }

        // Importar Fluxo de Etapas
        const fluxoSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('fluxo'));
        if (fluxoSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[fluxoSheet]);
          const novoFluxo: Record<string, string[]> = { PROPRIO: [], TERCEIRO: [], ACOMPANHAMENTO: [] };
          
          jsonData.forEach((row: any) => {
            const tipoRaw = String(row.tipo_projeto || row.tipoprojeto || '').toUpperCase();
            let tipo = 'PROPRIO';
            if (tipoRaw.includes('TERCEIRO')) tipo = 'TERCEIRO';
            else if (tipoRaw.includes('ACOMP')) tipo = 'ACOMPANHAMENTO';
            
            const etapa = String(row.etapa || '').toUpperCase();
            if (etapa && !novoFluxo[tipo].includes(etapa)) {
              novoFluxo[tipo].push(etapa);
            }
          });
          
          setEngineConfig(prev => ({ 
            ...prev, 
            ordemEtapas: novoFluxo as any
          }));
        }

        // Importar Matriz de Regras - suporta formato pivotado (Tipo Projeto | Etapa | Negócios/NEGOCIOS | FullStack | Backend | Frontend)
        // Preferimos detectar pelo cabeçalho (mais confiável) e só depois pelo nome da aba.
        const matrizSheetByHeaders = workbook.SheetNames.find((n) => {
          const headers = getSheetHeaders(n);
          const hasCore = headers.includes('tipoprojeto') && headers.includes('etapa');
          const hasSkills =
            headers.includes('negocios') &&
            (headers.includes('fullstack') || headers.includes('backend') || headers.includes('frontend'));
          return hasCore && hasSkills;
        });

        const matrizSheetByName = workbook.SheetNames.find((n) => {
          const name = normalizeKey(n);
          return (
            name === 'tabmatriz' ||
            name.includes('tabmatriz') ||
            name.includes('matriz') ||
            name.includes('matrix') ||
            name.includes('regra')
          );
        });

        const matrizSheet = matrizSheetByHeaders ?? matrizSheetByName;

        if (matrizSheet) {
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[matrizSheet]);
          const novaMatriz: Record<string, Record<string, string>> = { PROPRIO: {}, TERCEIRO: {}, ACOMPANHAMENTO: {} };
          const novoFluxoFromMatrix: Record<string, string[]> = { PROPRIO: [], TERCEIRO: [], ACOMPANHAMENTO: [] };
          const novasCoresFundo: Record<string, string> = {};
          const novasCoresFonte: Record<string, string> = {};

          // Mapa usando chave NORMALIZADA (normalizeKey), ex: "Responsável" -> "responsavel"
          const papelMap: Record<string, string> = {
            responsavel: 'RESPONSAVEL',
            obrigatorio: 'OBRIGATORIO',
            participa: 'PARTICIPA',
            naoparticipa: 'NAO_PARTICIPA',
          };


          jsonData.forEach((row: any) => {
            // Buscar "Tipo Projeto" de forma robusta
            const tipoRaw = getRowVal(row, ['tipo_projeto', 'tipoprojeto', 'tipo projeto', 'tipo']);
            const tipoNorm = normalizeKey(String(tipoRaw ?? ''));
            let tipo = 'PROPRIO';
            if (tipoNorm.includes('terceiro') || tipoNorm.includes('desenvolv')) tipo = 'TERCEIRO';
            else if (tipoNorm.includes('acomp')) tipo = 'ACOMPANHAMENTO';
            else if (tipoNorm.includes('complet') || tipoNorm.includes('proprio')) tipo = 'PROPRIO';

            // Buscar "Etapa"
            const etapaRaw = getRowVal(row, ['etapa', 'fase', 'phase']);
            const etapa = normalizeAccentsGlobal(String(etapaRaw ?? '')).toUpperCase().trim();
            if (!etapa) return;

            // Registra etapa no fluxo (para manter ordem)
            if (!novoFluxoFromMatrix[tipo].includes(etapa)) {
              novoFluxoFromMatrix[tipo].push(etapa);
            }

            // Lê colunas pivotadas: NEGOCIOS, FULLSTACK, BACKEND, FRONTEND
            const skillColumns = ['NEGOCIOS', 'FULLSTACK', 'BACKEND', 'FRONTEND'];
            for (const skill of skillColumns) {
              // Tenta várias variações da coluna
              const papelRaw = getRowVal(row, [skill, skill.toLowerCase()]);
              if (papelRaw !== undefined) {
                const papelNorm = normalizeKey(String(papelRaw));
                const papel = papelMap[papelNorm] || 'NAO_PARTICIPA';
                const key = `${etapa}|${skill}`;
                novaMatriz[tipo][key] = papel;
              }
            }

            // Lê cores de fundo e fonte por etapa
            const corFundo = getRowVal(row, ['cor_fundo', 'corfundo', 'cor fundo', 'background', 'bg_color']);
            const corFonte = getRowVal(row, ['cor_fonte', 'corfonte', 'cor fonte', 'font_color', 'text_color']);
            
            if (corFundo && String(corFundo).trim()) {
              novasCoresFundo[etapa] = String(corFundo).trim();
            }
            if (corFonte && String(corFonte).trim()) {
              novasCoresFonte[etapa] = String(corFonte).trim();
            }
          });

          // Atualiza matriz se encontrou dados
          const hasData =
            Object.keys(novaMatriz.PROPRIO).length > 0 ||
            Object.keys(novaMatriz.TERCEIRO).length > 0 ||
            Object.keys(novaMatriz.ACOMPANHAMENTO).length > 0;

          if (hasData) {
            setEngineConfig((prev) => ({
              ...prev,
              matriz: novaMatriz as any,
              // Também atualiza o fluxo de etapas com base na ordem da matriz
              ordemEtapas: {
                PROPRIO: novoFluxoFromMatrix.PROPRIO.length > 0 ? novoFluxoFromMatrix.PROPRIO : prev.ordemEtapas.PROPRIO,
                TERCEIRO: novoFluxoFromMatrix.TERCEIRO.length > 0 ? novoFluxoFromMatrix.TERCEIRO : prev.ordemEtapas.TERCEIRO,
                ACOMPANHAMENTO: novoFluxoFromMatrix.ACOMPANHAMENTO.length > 0 ? novoFluxoFromMatrix.ACOMPANHAMENTO : prev.ordemEtapas.ACOMPANHAMENTO,
              } as any,
              // Atualiza cores se encontradas
              coresEtapas: Object.keys(novasCoresFundo).length > 0 
                ? { ...prev.coresEtapas, ...novasCoresFundo } 
                : prev.coresEtapas,
              coresFonteEtapas: Object.keys(novasCoresFonte).length > 0 
                ? { ...prev.coresFonteEtapas, ...novasCoresFonte } 
                : prev.coresFonteEtapas,
            }));
          }
        }

        toast({ title: "✅ Dados Importados", description: "Planilha importada com sucesso!" });
      } catch (error) {
        console.error('Erro ao importar:', error);
        toast({ title: "❌ Erro", description: "Erro ao importar arquivo.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (importFileRef.current) importFileRef.current.value = '';
  }, [toast]);

  const handleClearData = useCallback(() => {
    setProjects([]);
    setResources([]);
    setVacations([]);
    setSemanaInicio(1);
    setAnoInicio(2026);
    setDataInicio('');
    setEngineConfig(getEmptyConfig());
    toast({ title: "🗑️ Dados Limpos", description: "Todos os dados e configurações foram removidos." });
  }, [toast]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gantt-header sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Planejamento de Projetos</h1>
                <p className="text-sm opacity-80">Gestão de cronograma e alocação de recursos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[2400px] mx-auto px-4 py-6">
        <Tabs defaultValue="view_plan" className="space-y-6">
          <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
            <TabsTrigger value="view_plan" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Eye className="w-4 h-4" />
              View Plan
            </TabsTrigger>
            <TabsTrigger value="projetos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Briefcase className="w-4 h-4" />
              Projetos
            </TabsTrigger>
            <TabsTrigger value="recursos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4" />
              Recursos
            </TabsTrigger>
            <TabsTrigger value="ferias" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Palmtree className="w-4 h-4" />
              Disponibilidade
            </TabsTrigger>
            <TabsTrigger value="painel" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutDashboard className="w-4 h-4" />
              Painel
            </TabsTrigger>
          </TabsList>

          {/* View Plan Tab */}
          <TabsContent value="view_plan" className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1 items-end">
                <ConfigPanel
                  dataInicio={dataInicio}
                  semanaInicio={semanaInicio}
                  anoInicio={anoInicio}
                  engineConfig={engineConfig}
                  onDataInicioChange={setDataInicio}
                  onSemanaInicioChange={setSemanaInicio}
                  onAnoInicioChange={setAnoInicio}
                  onEngineConfigChange={setEngineConfig}
                />
                
                {/* Filtro de Squad */}
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Squad:</span>
                  <Select value={selectedSquad || '__ALL__'} onValueChange={(v) => setSelectedSquad(v === '__ALL__' ? '' : v)}>
                    <SelectTrigger className="w-[180px] h-8 bg-background">
                      <SelectValue placeholder="Todas as squads" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="__ALL__">Todas as squads</SelectItem>
                      {availableSquads.map(squad => (
                        <SelectItem key={squad} value={squad}>{squad}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="lg" variant="outline" className="gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Gerar Relatório
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    <DropdownMenuItem asChild disabled={allocation.length === 0}>
                      <PDFExportDialog 
                        availableWeeks={availableWeeks} 
                        onExport={handleExportPDF}
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportSimulationResult} disabled={allocation.length === 0}>
                      <Download className="w-4 h-4 mr-2" />
                      Simulação (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportInputData}>
                      <Download className="w-4 h-4 mr-2" />
                      Dados de Entrada (Excel)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => {
                    const logs = logsRef.current.join('\n');
                    if (logs.length === 0) {
                      toast({
                        title: "Nenhum log disponível",
                        description: "Execute uma simulação primeiro para gerar logs.",
                        variant: "default",
                      });
                      return;
                    }
                    
                    // Adicionar informações do contexto
                    const header = `=== LOGS DE ALOCAÇÃO ===\n` +
                      `Data/Hora: ${new Date().toLocaleString('pt-BR')}\n` +
                      `Buffer JIT: ${engineConfig.bufferSeguranca || 2} semanas\n` +
                      `Semana Início: ${semanaInicio} | Ano: ${anoInicio}\n` +
                      `Total de Projetos: ${projects.length}\n` +
                      `Total de Recursos: ${resources.length}\n` +
                      `\n=== LOGS DETALHADOS ===\n\n`;
                    
                    const fullLogs = header + logs;
                    
                    // Criar arquivo de texto
                    const blob = new Blob([fullLogs], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `logs_alocacao_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    toast({
                      title: "Logs exportados",
                      description: `Arquivo com ${logsRef.current.length} linhas de log baixado com sucesso!`,
                      variant: "default",
                    });
                  }}
                  className="gap-2"
                  title="Exportar logs detalhados da simulação para análise"
                >
                  <Bug className="w-5 h-5" />
                  Exportar Logs
                </Button>

                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => {
                    const logs = logsRef.current.join('\n');
                    if (logs.length === 0) {
                      toast({
                        title: "Nenhum log disponível",
                        description: "Execute uma simulação primeiro para gerar logs.",
                        variant: "default",
                      });
                      return;
                    }
                    
                    // Adicionar informações do contexto
                    const header = `=== LOGS DE ALOCAÇÃO - MASTERPLANEGG ===\n` +
                      `Data/Hora: ${new Date().toLocaleString('pt-BR')}\n` +
                      `Buffer JIT: ${engineConfig.bufferSeguranca || 2} semanas\n` +
                      `Semana Início: ${semanaInicio} | Ano: ${anoInicio}\n` +
                      `Total de Projetos: ${projects.length}\n` +
                      `Total de Recursos: ${resources.length}\n` +
                      `Squad Filtrada: ${selectedSquad || 'Todas'}\n` +
                      `\n=== LOGS DETALHADOS ===\n\n`;
                    
                    const fullLogs = header + logs;
                    
                    // Criar arquivo de texto
                    const blob = new Blob([fullLogs], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `logs_alocacao_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    toast({
                      title: "Logs exportados",
                      description: `Arquivo com ${logsRef.current.length} linhas de log baixado com sucesso!`,
                      variant: "default",
                    });
                  }}
                  className="gap-2"
                >
                  <Bug className="w-5 h-5" />
                  Exportar Logs
                </Button>

                <a 
                  href="/templates/template_importacao.xlsx" 
                  download="template_importacao.xlsx"
                  className="inline-flex"
                >
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="gap-2"
                    type="button"
                  >
                    <Download className="w-5 h-5" />
                    Baixar Template
                  </Button>
                </a>

                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => importFileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Importar Dados
                </Button>
                <input
                  type="file"
                  ref={importFileRef}
                  onChange={handleImportData}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={handleClearData}
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-5 h-5" />
                  Limpar Dados
                </Button>
              </div>
            </div>

            <RulesMatrixPanel
              config={engineConfig}
              onConfigChange={setEngineConfig}
            />

            <CapacityPeriodsPanel
              engineConfig={engineConfig}
              onConfigChange={setEngineConfig}
            />
            
            <PhaseLegend 
              phaseColors={engineConfig.coresEtapas || DEFAULT_PHASE_COLORS} 
              phaseFontColors={engineConfig.coresFonteEtapas || DEFAULT_PHASE_FONT_COLORS} 
            />
            
            <RoadmapView
              projects={filteredProjects}
              allocation={filteredAllocation}
              resources={resources}
              phaseColors={engineConfig.coresEtapas || DEFAULT_PHASE_COLORS}
              phaseFontColors={engineConfig.coresFonteEtapas || DEFAULT_PHASE_FONT_COLORS}
            />
            
            <AllocationView
              allocation={filteredAllocation}
              resources={resources}
              engineConfig={engineConfig}
            />
          </TabsContent>

          {/* Projetos Tab */}
          <TabsContent value="projetos">
            <ProjectsTable
              data={projects}
              resources={resources}
              onUpdate={setProjects}
            />
          </TabsContent>

          {/* Recursos Tab */}
          <TabsContent value="recursos">
            <DataTable<Resource>
              title="Recursos"
              icon="👥"
              data={resources}
              columns={[
                { key: 'foto', label: 'Foto', type: 'image', width: '80px' },
                { key: 'nome', label: 'Nome', width: '25%' },
                { key: 'cargo', label: 'Cargo', width: '20%' },
                { key: 'skill_recurso', label: 'Skill', type: 'select', width: '15%' },
                { key: 'squad', label: 'Squad', width: '15%' },
              ]}
              onUpdate={setResources}
              emptyRow={{ nome: '', cargo: '', skill_recurso: 'FULLSTACK', squad: 'ECHO BR', foto: '' }}
              selectOptions={{ skill_recurso: SKILL_TYPES.map(s => ({ value: s, label: SKILL_LABELS[s] })) }}
            />
          </TabsContent>

          {/* Disponibilidade Tab */}
          <TabsContent value="ferias">
            <DataTable<Vacation>
              title="Disponibilidade"
              icon="📅"
              data={vacations}
              columns={[
                { key: 'recurso', label: 'Recurso', type: 'resource-select', width: '25%' },
                { key: 'dataInicio', label: 'Data Início', width: '15%' },
                { key: 'dataFim', label: 'Data Fim', width: '15%' },
                { key: 'tipo', label: 'Tipo', type: 'select', width: '18%' },
                { key: 'motivo', label: 'Motivo', width: '20%' },
              ]}
              onUpdate={setVacations}
              emptyRow={{ recurso: '', dataInicio: '01/01/2026', dataFim: '07/01/2026', tipo: 'FERIAS', motivo: 'Férias' }}
              selectOptions={{ 
                tipo: [
                  { value: 'FERIAS', label: 'Férias' },
                  { value: 'OUTRA_SQUAD', label: 'Alocado em outra Squad' },
                  { value: 'SAIDA', label: 'Saída' },
                  { value: 'OUTROS', label: 'Outros' },
                ]
              }}
              resourceOptions={resources.map(r => ({ value: r.nome, label: r.nome }))}
            />
          </TabsContent>

          {/* Painel Tab */}
          <TabsContent value="painel">
            <DashboardPanel
              projects={projects}
              resources={resources}
              allocation={allocation}
              semanaInicio={semanaInicio}
              anoInicio={anoInicio}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Sistema de Planejamento de Projetos • Algoritmo de alocação inteligente
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
