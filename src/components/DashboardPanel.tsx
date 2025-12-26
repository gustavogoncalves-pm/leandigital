import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Project, Resource, TimelineRow, Phase, PHASE_NAMES, SKILL_LABELS, SkillType } from '@/types/planning';
import { Briefcase, Users, TrendingUp, Clock, Filter, BarChart3, PieChart, Calendar } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface DashboardPanelProps {
  projects: Project[];
  resources: Resource[];
  allocation: TimelineRow[];
  semanaInicio: number;
  anoInicio: number;
}

// Helper to get quarter from week number
function getQuarterFromWeek(week: number): number {
  if (week <= 13) return 1;
  if (week <= 26) return 2;
  if (week <= 39) return 3;
  return 4;
}

// Parse week string like "2026-S01" to { year, week }
function parseWeekString(weekStr: string): { year: number; week: number } | null {
  const match = weekStr.match(/(\d{4})-S(\d{1,2})/);
  if (!match) return null;
  return { year: parseInt(match[1]), week: parseInt(match[2]) };
}

export function DashboardPanel({ projects, resources, allocation, semanaInicio, anoInicio }: DashboardPanelProps) {
  const [selectedSquad, setSelectedSquad] = useState<string>('');

  // Extract unique squads
  const availableSquads = useMemo(() => {
    const squads = new Set<string>();
    projects.forEach(p => {
      if (p.squad) squads.add(p.squad.toUpperCase().trim());
    });
    return Array.from(squads).sort();
  }, [projects]);

  // Filter by squad
  const filteredProjects = useMemo(() => {
    if (!selectedSquad) return projects;
    return projects.filter(p => p.squad?.toUpperCase().trim() === selectedSquad);
  }, [projects, selectedSquad]);

  const filteredResources = useMemo(() => {
    if (!selectedSquad) return resources;
    return resources.filter(r => r.squad?.toUpperCase().trim() === selectedSquad);
  }, [resources, selectedSquad]);

  const filteredAllocation = useMemo(() => {
    if (!selectedSquad) return allocation;
    return allocation.filter(row => {
      const project = projects.find(p => p.nome === row.projeto);
      return project?.squad?.toUpperCase().trim() === selectedSquad;
    });
  }, [allocation, selectedSquad, projects]);

  // KPIs
  const totalProjects = filteredProjects.length;
  const totalResources = filteredResources.length;

  // Team composition by skill
  const teamComposition = useMemo(() => {
    const composition: Record<SkillType, number> = {
      NEGOCIOS: 0,
      FULLSTACK: 0,
      BACKEND: 0,
      FRONTEND: 0,
    };
    filteredResources.forEach(r => {
      if (r.skill_recurso) {
        composition[r.skill_recurso]++;
      }
    });
    return composition;
  }, [filteredResources]);

  const teamCompositionData = useMemo(() => {
    const total = Object.values(teamComposition).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(teamComposition).map(([skill, count]) => ({
      name: SKILL_LABELS[skill as SkillType],
      value: count,
      percentage: ((count / total) * 100).toFixed(1),
    }));
  }, [teamComposition]);

  // Lead time calculation (total weeks per project)
  const leadTimeData = useMemo(() => {
    return filteredProjects.map(p => {
      const totalWeeks = Object.values(p.duracoes).reduce((a, b) => a + b, 0);
      return {
        name: p.nome.length > 20 ? p.nome.substring(0, 20) + '...' : p.nome,
        fullName: p.nome,
        leadTime: totalWeeks,
      };
    }).sort((a, b) => b.leadTime - a.leadTime);
  }, [filteredProjects]);

  const avgLeadTime = useMemo(() => {
    if (leadTimeData.length === 0) return 0;
    const total = leadTimeData.reduce((a, b) => a + b.leadTime, 0);
    return (total / leadTimeData.length).toFixed(1);
  }, [leadTimeData]);

  // Average time per phase
  const phaseAverages = useMemo(() => {
    const phases: Phase[] = ['IN', 'ES', 'PL', 'DE', 'QA', 'HO', 'IM', 'OA', 'EN'];
    const result: { phase: string; name: string; avgWeeks: number }[] = [];
    
    phases.forEach(phase => {
      const durations = filteredProjects.map(p => p.duracoes[phase]).filter(d => d > 0);
      if (durations.length > 0) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        result.push({
          phase,
          name: PHASE_NAMES[phase],
          avgWeeks: parseFloat(avg.toFixed(1)),
        });
      }
    });
    
    return result;
  }, [filteredProjects]);

  // Projects by quarter (based on end date from allocation)
  const projectsByQuarter = useMemo(() => {
    const quarterMap: Record<string, { projects: string[]; count: number }> = {};
    
    // Get the last week for each project from allocation
    const projectEndWeeks: Record<string, string> = {};
    
    filteredAllocation.filter(row => row.projeto !== '📅 Disponibilidade').forEach(row => {
      const weeks = Object.keys(row.semanas).filter(w => {
        const cell = row.semanas[w];
        return cell && cell.status && !cell.blocked;
      });
      
      if (weeks.length > 0) {
        // Sort weeks to find the last one
        weeks.sort((a, b) => {
          const pa = parseWeekString(a);
          const pb = parseWeekString(b);
          if (!pa || !pb) return 0;
          if (pa.year !== pb.year) return pa.year - pb.year;
          return pa.week - pb.week;
        });
        
        const lastWeek = weeks[weeks.length - 1];
        const currentEnd = projectEndWeeks[row.projeto];
        
        if (!currentEnd) {
          projectEndWeeks[row.projeto] = lastWeek;
        } else {
          const parsedCurrent = parseWeekString(currentEnd);
          const parsedNew = parseWeekString(lastWeek);
          if (parsedCurrent && parsedNew) {
            if (parsedNew.year > parsedCurrent.year || 
                (parsedNew.year === parsedCurrent.year && parsedNew.week > parsedCurrent.week)) {
              projectEndWeeks[row.projeto] = lastWeek;
            }
          }
        }
      }
    });
    
    // Group by quarter
    Object.entries(projectEndWeeks).forEach(([projectName, endWeek]) => {
      const parsed = parseWeekString(endWeek);
      if (parsed) {
        const quarter = getQuarterFromWeek(parsed.week);
        const key = `${parsed.year} Q${quarter}`;
        
        if (!quarterMap[key]) {
          quarterMap[key] = { projects: [], count: 0 };
        }
        quarterMap[key].projects.push(projectName);
        quarterMap[key].count++;
      }
    });
    
    // Convert to array and sort
    return Object.entries(quarterMap)
      .map(([quarter, data]) => ({
        quarter,
        count: data.count,
        projects: data.projects,
      }))
      .sort((a, b) => {
        const [yearA, qA] = a.quarter.split(' ');
        const [yearB, qB] = b.quarter.split(' ');
        if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
        return qA.localeCompare(qB);
      });
  }, [filteredAllocation]);

  // Saving by quarter (based on project end dates and saving values)
  const savingByQuarter = useMemo(() => {
    const quarterMap: Record<string, { saving: number; projects: { name: string; saving: number }[] }> = {};
    
    // Get the last week for each project from allocation
    const projectEndWeeks: Record<string, string> = {};
    
    filteredAllocation.filter(row => row.projeto !== '📅 Disponibilidade').forEach(row => {
      const weeks = Object.keys(row.semanas).filter(w => {
        const cell = row.semanas[w];
        return cell && cell.status && !cell.blocked;
      });
      
      if (weeks.length > 0) {
        weeks.sort((a, b) => {
          const pa = parseWeekString(a);
          const pb = parseWeekString(b);
          if (!pa || !pb) return 0;
          if (pa.year !== pb.year) return pa.year - pb.year;
          return pa.week - pb.week;
        });
        
        const lastWeek = weeks[weeks.length - 1];
        const currentEnd = projectEndWeeks[row.projeto];
        
        if (!currentEnd) {
          projectEndWeeks[row.projeto] = lastWeek;
        } else {
          const parsedCurrent = parseWeekString(currentEnd);
          const parsedNew = parseWeekString(lastWeek);
          if (parsedCurrent && parsedNew) {
            if (parsedNew.year > parsedCurrent.year || 
                (parsedNew.year === parsedCurrent.year && parsedNew.week > parsedCurrent.week)) {
              projectEndWeeks[row.projeto] = lastWeek;
            }
          }
        }
      }
    });
    
    // Group saving by quarter
    Object.entries(projectEndWeeks).forEach(([projectName, endWeek]) => {
      const parsed = parseWeekString(endWeek);
      const project = filteredProjects.find(p => p.nome === projectName);
      const saving = project?.saving || 0;
      
      if (parsed) {
        const quarter = getQuarterFromWeek(parsed.week);
        const key = `${parsed.year} Q${quarter}`;
        
        if (!quarterMap[key]) {
          quarterMap[key] = { saving: 0, projects: [] };
        }
        quarterMap[key].saving += saving;
        if (saving > 0) {
          quarterMap[key].projects.push({ name: projectName, saving });
        }
      }
    });
    
    return Object.entries(quarterMap)
      .map(([quarter, data]) => ({
        quarter,
        saving: data.saving,
        projects: data.projects,
      }))
      .sort((a, b) => {
        const [yearA, qA] = a.quarter.split(' ');
        const [yearB, qB] = b.quarter.split(' ');
        if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
        return qA.localeCompare(qB);
      });
  }, [filteredAllocation, filteredProjects]);

  // Total saving
  const totalSaving = useMemo(() => {
    return savingByQuarter.reduce((acc, q) => acc + q.saving, 0);
  }, [savingByQuarter]);

  // Colors for charts
  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
  const QUARTER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Squad Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por Squad:</span>
          <Select value={selectedSquad || '__ALL__'} onValueChange={(v) => setSelectedSquad(v === '__ALL__' ? '' : v)}>
            <SelectTrigger className="w-[200px] h-8 bg-background">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {selectedSquad ? `na squad ${selectedSquad}` : 'em todas as squads'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Recursos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalResources}</div>
            <p className="text-xs text-muted-foreground">
              profissionais alocados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Time Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgLeadTime}</div>
            <p className="text-xs text-muted-foreground">
              semanas por projeto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saving da Squad</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">-</div>
            <p className="text-xs text-muted-foreground">
              campo não configurado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Composition */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Composição do Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamCompositionData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={teamCompositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {teamCompositionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} (${teamCompositionData.find(d => d.name === name)?.percentage}%)`, name]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {teamCompositionData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{item.name}: {item.value} ({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Nenhum recurso encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase Averages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tempo Médio por Etapa (semanas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phaseAverages.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={phaseAverages} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value} semanas`, 'Média']} />
                    <Bar dataKey="avgWeeks" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Nenhum projeto com durações configuradas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects by Quarter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Entregas por Trimestre
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectsByQuarter.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projectsByQuarter.map((quarter, idx) => (
                <div 
                  key={quarter.quarter}
                  className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{quarter.quarter}</h4>
                    <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                      {quarter.count} projeto{quarter.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {quarter.projects.map((project, pIdx) => (
                      <li 
                        key={pIdx} 
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate flex items-center gap-2"
                        title={project}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        {project}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma alocação encontrada para calcular entregas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saving by Quarter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Saving Entregue por Trimestre
            {totalSaving > 0 && (
              <span className="ml-auto text-sm font-normal text-green-600 dark:text-green-400">
                Total: R$ {totalSaving.toLocaleString('pt-BR')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savingByQuarter.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {savingByQuarter.map((quarter) => (
                <div 
                  key={quarter.quarter}
                  className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{quarter.quarter}</h4>
                    <span className={`text-sm font-bold ${quarter.saving > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      R$ {quarter.saving.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {quarter.projects.length > 0 ? (
                    <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                      {quarter.projects.map((p, pIdx) => (
                        <li 
                          key={pIdx} 
                          className="text-sm text-muted-foreground truncate flex items-center justify-between gap-2"
                          title={p.name}
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                            R$ {p.saving.toLocaleString('pt-BR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum saving cadastrado</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhum saving encontrado. Adicione valores de saving aos projetos.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Time per Project */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lead Time por Projeto (semanas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadTimeData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimeData.slice(0, 15)} layout="vertical">
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150} 
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value} semanas`, 'Lead Time']}
                    labelFormatter={(label) => {
                      const item = leadTimeData.find(d => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="leadTime" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhum projeto encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Lista de Projetos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProjects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Projeto</th>
                    <th className="text-left py-2 px-3 font-medium">Squad</th>
                    <th className="text-left py-2 px-3 font-medium">Tipo</th>
                    <th className="text-center py-2 px-3 font-medium">Prioridade</th>
                    <th className="text-center py-2 px-3 font-medium">Lead Time</th>
                    <th className="text-center py-2 px-3 font-medium">Recursos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const leadTime = Object.values(project.duracoes).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={project.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">{project.nome}</td>
                        <td className="py-2 px-3">{project.squad}</td>
                        <td className="py-2 px-3">{project.tipo || 'PROPRIO'}</td>
                        <td className="text-center py-2 px-3">{project.prioridade}</td>
                        <td className="text-center py-2 px-3">{leadTime} sem</td>
                        <td className="text-center py-2 px-3">{project.recursos.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhum projeto encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
