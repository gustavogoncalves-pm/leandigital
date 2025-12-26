import { Project, TimelineRow, Phase, Resource, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS } from '@/types/planning';
import { generateRoadmapFromAllocation, getWeeksFromAllocation } from '@/lib/allocation-engine';
import { PhaseBadge } from './PhaseBadge';
import { useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RoadmapViewProps {
  projects: Project[];
  allocation: TimelineRow[];
  resources: Resource[];
  phaseColors?: Record<Phase, string>;
  phaseFontColors?: Record<Phase, string>;
}

interface WeeksByYear {
  ano: string;
  semanas: string[];
}

export function RoadmapView({ projects, allocation, resources, phaseColors, phaseFontColors }: RoadmapViewProps) {
  const weeks = useMemo(() => getWeeksFromAllocation(allocation), [allocation]);
  const roadmap = useMemo(() => generateRoadmapFromAllocation(allocation, projects, weeks), [allocation, projects, weeks]);

  // Mapa de recurso para dados completos
  const resourceDataMap = useMemo(() => {
    const map: Record<string, Resource> = {};
    resources.forEach(r => {
      map[r.nome.toUpperCase().trim()] = r;
    });
    return map;
  }, [resources]);

  // Mapear recursos alocados por projeto
  const resourcesByProject = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    allocation.forEach(row => {
      if (!map[row.projeto]) {
        map[row.projeto] = new Set();
      }
      map[row.projeto].add(row.recurso);
    });
    return map;
  }, [allocation]);

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

  // Extrair número da semana do formato "2025-S01"
  const getWeekNumber = (week: string) => {
    const match = week.match(/S(\d+)/);
    return match ? match[1] : week;
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="gantt-header px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📊 Roadmap de Projetos</h2>
        <span className="text-sm opacity-80">
          {weeks.length} semanas
        </span>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse min-w-max">
          <thead>
            {/* Linha do ano */}
            <tr className="bg-muted/70">
              <th className="sticky left-0 z-10 bg-muted text-left px-4 py-1 text-sm font-semibold text-foreground border-b border-border w-[400px] min-w-[400px] max-w-[400px]">
                
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
              <th className="sticky left-0 z-10 bg-muted text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-[400px] min-w-[400px] max-w-[400px]">
                Nome do Projeto
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
            {roadmap.map((row) => (
              <tr 
                key={row.projeto} 
                className="hover:bg-accent/30 transition-colors bg-card"
              >
                <td className="sticky left-0 z-20 px-4 py-2 text-sm font-medium text-foreground border-b border-border w-[400px] min-w-[400px] max-w-[400px] bg-card align-middle" title={row.projeto}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 line-clamp-2 leading-tight">{row.projeto}</span>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        {Array.from(resourcesByProject[row.projeto] || []).slice(0, 5).map((recurso) => {
                          const resourceData = resourceDataMap[recurso.toUpperCase().trim()];
                          return (
                            <Tooltip key={recurso}>
                              <TooltipTrigger asChild>
                                <Avatar className="w-6 h-6 border-2 border-card">
                                  {resourceData?.foto ? (
                                    <AvatarImage src={resourceData.foto} alt={recurso} />
                                  ) : null}
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {recurso.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{recurso}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {(resourcesByProject[row.projeto]?.size || 0) > 5 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Avatar className="w-6 h-6 border-2 border-card">
                                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                  +{(resourcesByProject[row.projeto]?.size || 0) - 5}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{(resourcesByProject[row.projeto]?.size || 0) - 5} mais recursos</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </div>
                </td>
                {weeks.map((week) => (
                  <td key={week} className="px-0.5 py-1 border-b border-border w-[36px] min-w-[36px] max-w-[36px]">
                    {row.semanas[week] && (
                      <PhaseBadge phase={row.semanas[week]} phaseColors={phaseColors} phaseFontColors={phaseFontColors} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
