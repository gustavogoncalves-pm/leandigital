import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CapacidadeConfig, CapacidadePeriodo, SkillType, SKILL_LABELS, SKILL_TYPES, EngineConfig } from '@/types/planning';
import { Plus, Trash2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CapacityPeriodsPanelProps {
  engineConfig: EngineConfig;
  onConfigChange: (config: EngineConfig) => void;
}

export function CapacityPeriodsPanel({ engineConfig, onConfigChange }: CapacityPeriodsPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType>('NEGOCIOS');
  
  // Formulário para novo período
  const [novoAnoInicio, setNovoAnoInicio] = useState(2026);
  const [novaSemanaInicio, setNovaSemanaInicio] = useState(1);
  const [novoAnoFim, setNovoAnoFim] = useState(2026);
  const [novaSemanaFim, setNovaSemanaFim] = useState(5);
  const [novaCapacidade, setNovaCapacidade] = useState(3);

  // Obter configuração atual do skill selecionado
  const getSkillConfig = (skill: SkillType): CapacidadeConfig => {
    if (engineConfig.capacidadePorPeriodo && engineConfig.capacidadePorPeriodo[skill]) {
      return engineConfig.capacidadePorPeriodo[skill];
    }
    return {
      padrao: engineConfig.capacidade[skill] || 2,
      periodos: []
    };
  };

  const skillConfig = getSkillConfig(selectedSkill);

  const handleAdicionarPeriodo = () => {
    if (novaSemanaInicio < 1 || novaSemanaInicio > 53 || novaSemanaFim < 1 || novaSemanaFim > 53) {
      toast({ title: "Erro", description: "Semanas devem ser entre 1 e 53", variant: "destructive" });
      return;
    }
    
    const inicioKey = novoAnoInicio * 100 + novaSemanaInicio;
    const fimKey = novoAnoFim * 100 + novaSemanaFim;
    
    if (fimKey < inicioKey) {
      toast({ title: "Erro", description: "Data fim deve ser posterior à data início", variant: "destructive" });
      return;
    }

    const novoPeriodo: CapacidadePeriodo = {
      id: Date.now().toString(),
      semanaInicio: novaSemanaInicio,
      anoInicio: novoAnoInicio,
      semanaFim: novaSemanaFim,
      anoFim: novoAnoFim,
      capacidade: novaCapacidade,
    };

    const novaConfig: EngineConfig = {
      ...engineConfig,
      capacidadePorPeriodo: {
        ...engineConfig.capacidadePorPeriodo,
        [selectedSkill]: {
          padrao: skillConfig.padrao,
          periodos: [...skillConfig.periodos, novoPeriodo]
        }
      }
    };

    onConfigChange(novaConfig);
    toast({ title: "Sucesso", description: `Período adicionado para ${SKILL_LABELS[selectedSkill]}` });
  };

  const handleRemoverPeriodo = (periodoId: string) => {
    const novaConfig: EngineConfig = {
      ...engineConfig,
      capacidadePorPeriodo: {
        ...engineConfig.capacidadePorPeriodo,
        [selectedSkill]: {
          padrao: skillConfig.padrao,
          periodos: skillConfig.periodos.filter(p => p.id !== periodoId)
        }
      }
    };

    onConfigChange(novaConfig);
    toast({ title: "Período removido" });
  };

  const handleAlterarPadrao = (valor: number) => {
    const novaConfig: EngineConfig = {
      ...engineConfig,
      capacidadePorPeriodo: {
        ...engineConfig.capacidadePorPeriodo,
        [selectedSkill]: {
          ...skillConfig,
          padrao: valor
        }
      }
    };

    onConfigChange(novaConfig);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="glass-card p-4 animate-fade-in">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Capacidade Máxima dos Recursos</h3>
          </div>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4 space-y-6">
        {/* Seletor de Skill */}
        <div className="flex items-center gap-4">
          <Label>Tipo de Recurso:</Label>
          <Select value={selectedSkill} onValueChange={(v) => setSelectedSkill(v as SkillType)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_TYPES.map(skill => (
                <SelectItem key={skill} value={skill}>{SKILL_LABELS[skill]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Capacidade padrão */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <Label className="whitespace-nowrap">Capacidade Padrão (quando não há período específico):</Label>
          <Input 
            type="number" 
            min={1} 
            max={10}
            className="w-20"
            value={skillConfig.padrao}
            onChange={(e) => handleAlterarPadrao(parseInt(e.target.value) || 1)}
          />
          <span className="text-sm text-muted-foreground">projetos simultâneos</span>
        </div>

        {/* Formulário para adicionar período */}
        <div className="border border-dashed border-border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Adicionar Período Especial</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <Label className="text-xs">Ano Início</Label>
              <Input 
                type="number" 
                value={novoAnoInicio}
                onChange={(e) => setNovoAnoInicio(parseInt(e.target.value) || 2026)}
              />
            </div>
            <div>
              <Label className="text-xs">Semana Início</Label>
              <Input 
                type="number" 
                min={1}
                max={53}
                value={novaSemanaInicio}
                onChange={(e) => setNovaSemanaInicio(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label className="text-xs">Ano Fim</Label>
              <Input 
                type="number" 
                value={novoAnoFim}
                onChange={(e) => setNovoAnoFim(parseInt(e.target.value) || 2026)}
              />
            </div>
            <div>
              <Label className="text-xs">Semana Fim</Label>
              <Input 
                type="number" 
                min={1}
                max={53}
                value={novaSemanaFim}
                onChange={(e) => setNovaSemanaFim(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label className="text-xs">Capacidade</Label>
              <Input 
                type="number" 
                min={1}
                max={10}
                value={novaCapacidade}
                onChange={(e) => setNovaCapacidade(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          <Button onClick={handleAdicionarPeriodo} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Período
          </Button>
        </div>

        {/* Lista de períodos configurados */}
        {skillConfig.periodos.length > 0 ? (
          <div>
            <h4 className="font-medium mb-2">Períodos Configurados para {SKILL_LABELS[selectedSkill]}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skillConfig.periodos
                  .sort((a, b) => (a.anoInicio * 100 + a.semanaInicio) - (b.anoInicio * 100 + b.semanaInicio))
                  .map(periodo => (
                  <TableRow key={periodo.id}>
                    <TableCell>
                      S{periodo.semanaInicio.toString().padStart(2, '0')}/{periodo.anoInicio} até S{periodo.semanaFim.toString().padStart(2, '0')}/{periodo.anoFim}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{periodo.capacidade}</span> projetos
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemoverPeriodo(periodo.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum período especial configurado para {SKILL_LABELS[selectedSkill]}. 
            A capacidade padrão será usada em todas as semanas.
          </p>
        )}

        {/* Resumo de todos os skills configurados */}
        <div className="border-t border-border pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Resumo de Configurações por Tipo de Recurso</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SKILL_TYPES.map(skill => {
              const cfg = getSkillConfig(skill);
              const temPeriodos = cfg.periodos.length > 0;
              return (
                <div 
                  key={skill}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSkill === skill 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedSkill(skill)}
                >
                  <div className="font-medium text-sm">{SKILL_LABELS[skill]}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Padrão: {cfg.padrao} proj.
                  </div>
                  {temPeriodos && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                      {cfg.periodos.length} período(s) especial(is)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
