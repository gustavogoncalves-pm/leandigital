import { TimelineRow, Resource, EngineConfig, SkillType, Phase, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS } from '@/types/planning';
import { getWeeksFromAllocation } from '@/lib/allocation-engine';
import { PhaseBadge } from './PhaseBadge';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Circle } from 'lucide-react';

interface AllocationViewProps {
  allocation: TimelineRow[];
  resources: Resource[];
  engineConfig: EngineConfig;
}

interface WeeksByYear {
  ano: string;
  semanas: string[];
}

type AllocationStatus = 'LIVRE' | 'PARCIAL' | 'TOTAL' | 'BLOQUEADO';

export function AllocationView({ allocation, resources, engineConfig }: AllocationViewProps) {
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());

  const weeks = useMemo(() => getWeeksFromAllocation(allocation), [allocation]);

  // Agrupar semanas por ano
  const weeksByYear = useMemo(() => {
    const grouped: WeeksByYear[] = [];
    let currentYear = '';
    let currentWeeks: string[] = [];

    weeks.forEach(week => {
      const [ano] = week.split('-');
      if (ano !== currentYear) {
        if (currentWeeks.length > 0) {
          grouped.push({ ano: currentYear, semanas: currentWeeks });
        }
        currentYear = ano;
        currentWeeks = [week];
      } else {
        currentWeeks.push(week);
      }
    });

    if (currentWeeks.length > 0) {
      grouped.push({ ano: currentYear, semanas: currentWeeks });
    }

    return grouped;
  }, [weeks]);

  // Agrupar por recurso
  const groupedByResource = useMemo(() => {
    const grouped: Record<string, TimelineRow[]> = {};
    allocation.forEach((row) => {
      if (!grouped[row.recurso]) {
        grouped[row.recurso] = [];
      }
      grouped[row.recurso].push(row);
    });
    return grouped;
  }, [allocation]);

  // Mapa de recurso para dados completos (normalizado para case-insensitive)
  const resourceDataMap = useMemo(() => {
    const map: Record<string, Resource> = {};
    resources.forEach(r => {
      map[r.nome.toUpperCase().trim()] = r;
    });
    return map;
  }, [resources]);

  // Mapa de recurso para skill (normalizado para case-insensitive)
  const resourceSkillMap = useMemo(() => {
    const map: Record<string, SkillType> = {};
    resources.forEach(r => {
      map[r.nome.toUpperCase().trim()] = r.skill_recurso;
    });
    return map;
  }, [resources]);

  // Função para obter skill de um recurso (case-insensitive)
  const getResourceSkill = (recurso: string): SkillType | undefined => {
    return resourceSkillMap[recurso.toUpperCase().trim()];
  };

  // Calcular status de alocação por recurso por semana
  const getResourceWeekStatus = (recurso: string, rows: TimelineRow[], week: string): AllocationStatus => {
    const skill = getResourceSkill(recurso);
    const capacity = skill ? engineConfig.capacidade[skill] : 1;
    
    let activeProjects = 0;
    let hasPersonalBlock = false;
    
    rows.forEach(row => {
      const cell = row.semanas[week];
      if (!cell) return;
      
      const status = cell.status || '';
      const blocked = cell.blocked || '';
      
      // Verificar se há bloqueio PESSOAL do recurso (férias, saída, outra squad)
      // ATENÇÃO: "⛔ Aguarda ..." é trava do projeto (espera por outro recurso), não bloqueio do recurso.
      const blockedNormalized = blocked.replace(/\uFE0F/g, '');
      const isProjectWait = blockedNormalized.includes('Aguarda');
      const isVacation = blockedNormalized.includes('🏖') || blockedNormalized.includes('☀');
      const isPersonalStop = blockedNormalized.includes('⛔') && !isProjectWait;
      if (isVacation || isPersonalStop) {
        hasPersonalBlock = true;
      }
      
      // Contar projetos ativos: fases reais de trabalho (não inclui aguardando, bloqueio, concluído, etc.)
      // Um projeto está ativo se tem uma fase real (IN, ES, PL, DE, QA, HO, IM, OA, EN)
      const normalizedStatus = status.replace(/^🔥\s*/, '');
      const isRealPhase = /^(IN|ES|PL|DE|QA|HO|IM|OA|EN)$/.test(normalizedStatus);
      if (isRealPhase) {
        activeProjects++;
      }
    });

    // Se há projetos ativos (trabalhando em fases reais), usar lógica de capacidade
    if (activeProjects > 0) {
      if (activeProjects >= capacity) return 'TOTAL';
      return 'PARCIAL';
    }
    
    // Se não há projetos ativos E há bloqueio pessoal (férias, saída, etc.), está bloqueado
    if (hasPersonalBlock) return 'BLOQUEADO';
    
    // Senão, está livre (inclui "Aguardando" que é apenas espera)
    return 'LIVRE';
  };

  // Contar recursos e projetos únicos
  const resourceCount = Object.keys(groupedByResource).length;
  const projectCount = new Set(allocation.map(r => r.projeto)).size;

  // Extrair número da semana do formato "2025-S01"
  const getWeekNumber = (week: string) => {
    const match = week.match(/S(\d+)/);
    return match ? match[1] : week;
  };

  const toggleResource = (recurso: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(recurso)) {
        next.delete(recurso);
      } else {
        next.add(recurso);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedResources(new Set(Object.keys(groupedByResource)));
  };

  const collapseAll = () => {
    setExpandedResources(new Set());
  };

  const getStatusColor = (status: AllocationStatus) => {
    switch (status) {
      case 'TOTAL': return 'text-red-500';
      case 'PARCIAL': return 'text-blue-500';
      case 'LIVRE': return 'text-green-500';
      case 'BLOQUEADO': return 'text-purple-500';
    }
  };

  const getStatusTooltip = (status: AllocationStatus, recurso: string, rows: TimelineRow[], week: string) => {
    if (status === 'BLOQUEADO') {
      // Encontrar o motivo do bloqueio PESSOAL (string com emoji)
      const blockedRow = rows.find(row => {
        const cell = row.semanas[week];
        if (!cell?.blocked) return false;
        const blocked = cell.blocked.replace(/\uFE0F/g, '');
        const isProjectWait = blocked.includes('Aguarda');
        const isVacation = blocked.includes('🏖') || blocked.includes('☀');
        const isPersonalStop = blocked.includes('⛔') && !isProjectWait;
        return isVacation || isPersonalStop;
      });
      const blockReason = blockedRow?.semanas[week]?.blocked || 'Bloqueado';
      return blockReason;
    }
    
    const skill = getResourceSkill(recurso);
    const capacity = skill ? engineConfig.capacidade[skill] : 1;
    let activeProjects = 0;
    rows.forEach(row => {
      const cell = row.semanas[week];
      const status = cell?.status || '';
      const normalizedStatus = status.replace(/^🔥\s*/, '');
      const isRealPhase = /^(IN|ES|PL|DE|QA|HO|IM|OA|EN)$/.test(normalizedStatus);
      if (isRealPhase) {
        activeProjects++;
      }
    });
    
    const statusLabel = status === 'TOTAL' ? 'Totalmente alocado' : status === 'PARCIAL' ? 'Parcialmente alocado' : 'Livre';
    return `${statusLabel} (${activeProjects}/${capacity} projetos)`;
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="gantt-header px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">👥 Alocação de Recursos</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-2 py-1 rounded bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground transition-colors"
            >
              Expandir todos
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-2 py-1 rounded bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground/80 transition-colors"
            >
              Minimizar todos
            </button>
          </div>
          <span className="text-sm opacity-80">
            {resourceCount} recursos • {projectCount} projetos • {weeks.length} semanas
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse min-w-max">
          <thead>
            {/* Linha do ano */}
            <tr className="bg-muted/70">
              <th className="sticky left-0 z-30 bg-muted text-left px-4 py-1 text-sm font-semibold text-foreground border-b border-border w-[500px] min-w-[500px] max-w-[500px]">
                
              </th>
              {weeksByYear.map(({ ano, semanas }) => (
                <th 
                  key={ano}
                  colSpan={semanas.length}
                  className="px-1 py-1 text-xs font-bold text-primary border-b border-border text-center bg-primary/10"
                >
                  {ano}
                </th>
              ))}
            </tr>
            {/* Linha das semanas */}
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-30 bg-muted text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-[500px] min-w-[500px] max-w-[500px]">
                Recurso / Projeto
              </th>
              {weeks.map((week) => (
                <th 
                  key={week} 
                  className="px-0.5 py-2 text-xs font-medium text-muted-foreground border-b border-border text-center w-[36px] min-w-[36px] max-w-[36px]"
                >
                  {getWeekNumber(week)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedByResource).map(([recurso, rows]) => {
              const isExpanded = expandedResources.has(recurso);
              
              return (
                <>
                  {/* Header do recurso */}
                  <tr 
                    key={`header-${recurso}`} 
                    className="bg-accent/50 cursor-pointer hover:bg-accent/70 transition-colors"
                    onClick={() => toggleResource(recurso)}
                  >
                    <td 
                      className="sticky left-0 z-30 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground border-b border-border transition-colors w-[500px] min-w-[500px] max-w-[500px] hover:bg-accent/90"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        {resourceDataMap[recurso.toUpperCase().trim()]?.foto ? (
                          <img 
                            src={resourceDataMap[recurso.toUpperCase().trim()].foto} 
                            alt={recurso}
                            className="w-8 h-8 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {recurso.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        )}
                        <div>
                          <div>{recurso}</div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {rows[0]?.cargo || '-'} • {rows.length} projeto{rows.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Indicadores de status por semana */}
                    {weeks.map((week) => {
                      const status = getResourceWeekStatus(recurso, rows, week);
                      return (
                        <td 
                          key={week} 
                          className="px-0.5 py-1 border-b border-border w-[36px] min-w-[36px] max-w-[36px] text-center"
                          title={getStatusTooltip(status, recurso, rows, week)}
                        >
                          <Circle className={`w-3 h-3 mx-auto ${getStatusColor(status)} fill-current`} />
                        </td>
                      );
                    })}
                  </tr>
                  
                  {/* Projetos do recurso */}
                  {isExpanded && rows.map((row) => (
                    <tr 
                      key={`${recurso}-${row.projeto}`} 
                      className="hover:bg-accent/30 transition-colors bg-card"
                    >
                      <td className="sticky left-0 z-30 pl-14 pr-4 py-1.5 text-sm text-foreground border-b border-border w-[500px] min-w-[500px] max-w-[500px] bg-card h-[44px] align-middle" title={row.projeto}>
                        <span className="text-muted-foreground mr-2">P{row.prioridade}</span>
                        {row.projeto}
                      </td>
                      {weeks.map((week) => {
                        const cell = row.semanas[week];
                        // Mostrar status (fase) se existir, senão mostrar blocked (motivo de bloqueio)
                        const displayValue = cell?.status || cell?.blocked || '';
                        return (
                          <td key={week} className="px-0.5 py-1 border-b border-border w-[36px] min-w-[36px] max-w-[36px]">
                            {displayValue && (
                              <PhaseBadge phase={displayValue} phaseColors={engineConfig.coresEtapas || DEFAULT_PHASE_COLORS} phaseFontColors={engineConfig.coresFonteEtapas || DEFAULT_PHASE_FONT_COLORS} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
