import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Grid3X3, Info, Building2, Globe, Eye } from 'lucide-react';
import { 
  EngineConfig, Phase, SkillType, PHASES, SKILL_TYPES, SKILL_LABELS, PHASE_NAMES,
  RoleType, ROLE_TYPES, ROLE_LABELS, ProjectType, PROJECT_TYPES, PROJECT_TYPE_LABELS,
  DEFAULT_PHASE_ORDER, getDefaultConfig, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS 
} from '@/types/planning';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RulesMatrixPanelProps {
  config: EngineConfig;
  onConfigChange: (config: EngineConfig) => void;
}

const PROJECT_ICONS: Record<ProjectType, React.ReactNode> = {
  PROPRIO: <Building2 className="w-4 h-4" />,
  TERCEIRO: <Globe className="w-4 h-4" />,
  ACOMPANHAMENTO: <Eye className="w-4 h-4" />,
};

export function RulesMatrixPanel({ config, onConfigChange }: RulesMatrixPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMatrixChange = (tipo: ProjectType, fase: Phase, skill: SkillType, value: RoleType) => {
    const key = `${fase}|${skill}`;
    
    onConfigChange({
      ...config,
      matriz: {
        ...config.matriz,
        [tipo]: {
          ...config.matriz[tipo],
          [key]: value,
        },
      },
    });
  };

  const handlePhaseColorChange = (fase: Phase, color: string) => {
    onConfigChange({
      ...config,
      coresEtapas: {
        ...(config.coresEtapas || DEFAULT_PHASE_COLORS),
        [fase]: color,
      },
    });
  };

  const handlePhaseFontColorChange = (fase: Phase, color: string) => {
    onConfigChange({
      ...config,
      coresFonteEtapas: {
        ...(config.coresFonteEtapas || DEFAULT_PHASE_FONT_COLORS),
        [fase]: color,
      },
    });
  };

  const getPhaseColor = (fase: Phase): string => {
    return config.coresEtapas?.[fase] || DEFAULT_PHASE_COLORS[fase];
  };

  const getPhaseFontColor = (fase: Phase): string => {
    return config.coresFonteEtapas?.[fase] || DEFAULT_PHASE_FONT_COLORS[fase];
  };

  const getMatrixValue = (tipo: ProjectType, fase: Phase, skill: SkillType): RoleType => {
    const key = `${fase}|${skill}`;
    return config.matriz[tipo]?.[key] || 'NAO_PARTICIPA';
  };

  // Armazenar valor temporário do input para permitir digitação livre
  const [phaseInputs, setPhaseInputs] = useState<Record<ProjectType, string>>({
    PROPRIO: config.ordemEtapas.PROPRIO?.join(', ') || '',
    TERCEIRO: config.ordemEtapas.TERCEIRO?.join(', ') || '',
    ACOMPANHAMENTO: config.ordemEtapas.ACOMPANHAMENTO?.join(', ') || '',
  });

  // Sincronizar quando config muda (ex: reset)
  useEffect(() => {
    setPhaseInputs({
      PROPRIO: config.ordemEtapas.PROPRIO?.join(', ') || '',
      TERCEIRO: config.ordemEtapas.TERCEIRO?.join(', ') || '',
      ACOMPANHAMENTO: config.ordemEtapas.ACOMPANHAMENTO?.join(', ') || '',
    });
  }, [config.ordemEtapas]);

  const handlePhaseInputChange = (tipo: ProjectType, value: string) => {
    setPhaseInputs(prev => ({ ...prev, [tipo]: value }));
  };

  const handlePhaseInputBlur = (tipo: ProjectType) => {
    const value = phaseInputs[tipo];
    const fases = value.split(',').map(f => f.trim().toUpperCase()).filter(f => PHASES.includes(f as Phase)) as Phase[];
    if (fases.length > 0) {
      onConfigChange({
        ...config,
        ordemEtapas: {
          ...config.ordemEtapas,
          [tipo]: fases,
        },
      });
      // Atualizar input com valor formatado
      setPhaseInputs(prev => ({ ...prev, [tipo]: fases.join(', ') }));
    }
  };

  const handleReset = () => {
    onConfigChange(getDefaultConfig());
  };

  const getRoleColor = (role: RoleType): string => {
    switch (role) {
      case 'RESPONSAVEL': return 'bg-primary/20 text-primary';
      case 'OBRIGATORIO': return 'bg-orange-500/20 text-orange-700';
      case 'PARTICIPA': return 'bg-green-500/20 text-green-700';
      case 'NAO_PARTICIPA': return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="glass-card p-4 animate-fade-in">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Matriz de Regras</h3>
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4 space-y-6">

        {/* Matriz de Regras por Tipo de Projeto */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-foreground">Matriz de Regras por Tipo de Projeto</h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    <strong>Responsável</strong>: Trava projeto se indisponível<br />
                    <strong>Obrigatório</strong>: Trava projeto se indisponível<br />
                    <strong>Participa</strong>: Opcional (não trava)<br />
                    <strong>Não Participa</strong>: Ignora
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded mb-3 font-medium">
            Responsável/Obrigatório: Trava Etapa | Participa: Opcional (não trava) | Não Participa: Ignora
          </div>

          <Tabs defaultValue="PROPRIO" className="w-full">
            <TabsList className="mb-4">
              {PROJECT_TYPES.map(tipo => (
                <TabsTrigger key={tipo} value={tipo} className="flex items-center gap-2">
                  {PROJECT_ICONS[tipo]}
                  {PROJECT_TYPE_LABELS[tipo]}
                </TabsTrigger>
              ))}
            </TabsList>

            {PROJECT_TYPES.map(tipo => (
              <TabsContent key={tipo} value={tipo} className="space-y-4">
                {/* Fluxo de Etapas */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Fluxo de Etapas ({PROJECT_TYPE_LABELS[tipo]})
                  </Label>
                  <Input
                    value={phaseInputs[tipo]}
                    onChange={(e) => handlePhaseInputChange(tipo, e.target.value)}
                    onBlur={() => handlePhaseInputBlur(tipo)}
                    className="h-9 text-sm font-mono"
                    placeholder="IN, ES, PL, DE, QA, HO, IM, OA, EN"
                  />
                </div>

                {/* Tabela da Matriz */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="bg-muted p-2 text-center font-semibold border border-border w-[50px]">Fundo</th>
                        <th className="bg-muted p-2 text-center font-semibold border border-border w-[50px]">Fonte</th>
                        <th className="bg-muted p-2 text-left font-semibold border border-border">Etapa</th>
                        {SKILL_TYPES.map(skill => (
                          <th key={skill} className="bg-muted p-2 text-center font-semibold border border-border min-w-[120px]">
                            {SKILL_LABELS[skill]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(config.ordemEtapas[tipo] || DEFAULT_PHASE_ORDER[tipo]).map(fase => (
                        <tr key={fase}>
                          <td className="p-1 border border-border text-center">
                            <input
                              type="color"
                              value={getPhaseColor(fase)}
                              onChange={(e) => handlePhaseColorChange(fase, e.target.value)}
                              className="w-8 h-8 cursor-pointer rounded border-0 p-0"
                              title={`Cor de fundo da etapa ${PHASE_NAMES[fase]}`}
                            />
                          </td>
                          <td className="p-1 border border-border text-center">
                            <input
                              type="color"
                              value={getPhaseFontColor(fase)}
                              onChange={(e) => handlePhaseFontColorChange(fase, e.target.value)}
                              className="w-8 h-8 cursor-pointer rounded border-0 p-0"
                              title={`Cor da fonte da etapa ${PHASE_NAMES[fase]}`}
                            />
                          </td>
                          <td className="bg-muted p-2 font-semibold border border-border">
                            <span title={PHASE_NAMES[fase]}>{fase}</span>
                          </td>
                          {SKILL_TYPES.map(skill => (
                            <td key={skill} className="p-1 border border-border">
                              <Select
                                value={getMatrixValue(tipo, fase, skill)}
                                onValueChange={(value) => handleMatrixChange(tipo, fase, skill, value as RoleType)}
                              >
                                <SelectTrigger className={`h-8 text-xs ${getRoleColor(getMatrixValue(tipo, fase, skill))}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_TYPES.map(role => (
                                    <SelectItem key={role} value={role} className="text-xs">
                                      {ROLE_LABELS[role]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Restaurar Padrões
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
