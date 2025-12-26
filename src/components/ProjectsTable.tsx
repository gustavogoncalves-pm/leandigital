import React, { useState, useRef } from 'react';
import { Project, Resource, PHASES, PHASE_NAMES, Phase, ProjectType, PROJECT_TYPES, PROJECT_TYPE_LABELS } from '@/types/planning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Download, Upload, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ProjectsTableProps {
  data: Project[];
  resources: Resource[];
  onUpdate: (data: Project[]) => void;
}

// Componente de multi-select para recursos
function ResourcesMultiSelect({
  selectedResources,
  availableResources,
  projectSquad,
  onChange,
}: {
  selectedResources: string[];
  availableResources: Resource[];
  projectSquad: string;
  onChange: (resources: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  
  // Filtrar recursos pela squad do projeto (case insensitive)
  const filteredResources = availableResources.filter(r => {
    if (!r.nome) return false;
    if (!projectSquad) return true; // Sem filtro de squad, mostrar todos
    const squadNorm = projectSquad.toUpperCase().trim();
    const resourceSquad = r.squad?.toUpperCase().trim();
    return resourceSquad === squadNorm;
  });
  
  // Se nenhum recurso filtrado, mostrar todos
  const resourcesToShow = filteredResources.length > 0 ? filteredResources : availableResources.filter(r => r.nome);

  const toggleResource = (resourceName: string) => {
    if (selectedResources.includes(resourceName)) {
      onChange(selectedResources.filter(r => r !== resourceName));
    } else {
      onChange([...selectedResources, resourceName]);
    }
  };

  const displayText = selectedResources.length > 0 
    ? selectedResources.map(r => {
        // Mostrar apenas o primeiro nome para economizar espaço
        const parts = r.split(' ');
        return parts.length > 1 ? `${parts[0]} ${parts[1]?.[0] || ''}.` : parts[0];
      }).join(', ')
    : 'Selecionar recursos...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-full justify-start text-left font-normal text-sm bg-background hover:bg-accent"
        >
          <Users className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">{displayText}</span>
          <ChevronDown className="w-4 h-4 ml-2 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover z-50" align="start">
        <div className="p-2 border-b border-border">
          <p className="text-xs text-muted-foreground">
            {resourcesToShow.length} recurso(s) disponível(is)
          </p>
        </div>
        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
          {resourcesToShow.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Nenhum recurso encontrado
            </p>
          ) : (
            resourcesToShow.map((resource) => (
              <label
                key={resource.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={selectedResources.includes(resource.nome)}
                  onCheckedChange={() => toggleResource(resource.nome)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{resource.nome}</p>
                  <p className="text-xs text-muted-foreground">{resource.cargo} • {resource.skill_recurso}</p>
                </div>
              </label>
            ))
          )}
        </div>
        {selectedResources.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ProjectsTable({ data, resources, onUpdate }: ProjectsTableProps) {
  const [editingData, setEditingData] = useState<Project[]>(data);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const newItem: Project = {
      id: Date.now().toString(),
      nome: '',
      squad: 'ECHO BR',
      prioridade: editingData.length + 1,
      tipo: 'PROPRIO',
      recursos: [],
      duracoes: { IN: 0, ES: 0, PL: 0, DE: 0, QA: 0, HO: 0, IM: 0, OA: 0, EN: 0 },
    };
    setEditingData([...editingData, newItem]);
  };

  const handleDelete = (id: string) => {
    setEditingData(editingData.filter(item => item.id !== id));
  };

  const handleChange = (id: string, field: string, value: any) => {
    setEditingData(editingData.map(item => {
      if (item.id !== id) return item;
      
      if (field.startsWith('duracao_')) {
        const phase = field.replace('duracao_', '') as Phase;
        return { ...item, duracoes: { ...item.duracoes, [phase]: Number(value) || 0 } };
      }
      
      if (field === 'recursos') {
        // Se for array, usar diretamente; se for string, fazer split
        const recursosArray = Array.isArray(value) 
          ? value 
          : value.split(',').map((s: string) => s.trim()).filter(Boolean);
        return { ...item, recursos: recursosArray };
      }
      
      return { ...item, [field]: value };
    }));
  };

  const handleSave = () => {
    onUpdate(editingData);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        nome_projeto: 'Projeto Exemplo',
        tipo_projeto: 'Próprio',
        nome_squad: 'Echo BR',
        prioridade: 1,
        ano_inicio_obrigatorio: '',
        inicio_obrigatorio: '',
        ano_termino_obrigatorio: '',
        termino_obrigatorio: '',
        nome_recurso1: 'Recurso1',
        nome_recurso2: 'Recurso2',
        nome_recurso3: '',
        num_sem_iniciacao: 1,
        num_sem_especificacao: 2,
        num_sem_planejamento: 1,
        num_sem_desenvolvimento: 4,
        num_sem_qa: 2,
        num_sem_homologacao: 1,
        num_sem_implantacao: 1,
        num_sem_operacaoassistida: 1,
        num_sem_encerramento: 1,
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'tab_projetos');
    
    XLSX.writeFile(wb, 'template_projetos.xlsx');
    toast.success('Template baixado com sucesso!');
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().trim() === 'tab_projetos'
        ) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const importedProjects: Project[] = jsonData.map((row: any, index: number) => {
          const getVal = (keys: string[]) => {
            for (const key of keys) {
              const found = Object.keys(row).find(k => k.toLowerCase().trim().replace(/[_\s]/g, '') === key.toLowerCase().replace(/[_\s]/g, ''));
              if (found && row[found] !== undefined && row[found] !== '') return row[found];
            }
            return undefined;
          };
          
          // Coletar recursos de múltiplas colunas
          const recursos: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const rec = getVal([`nome_recurso${i}`, `recurso${i}`, `nomerecurso${i}`]);
            if (rec && String(rec).trim()) recursos.push(String(rec).trim());
          }
          // Fallback para coluna única de recursos
          if (recursos.length === 0) {
            const recursosStr = getVal(['recursos', 'recurso']) || '';
            if (typeof recursosStr === 'string' && recursosStr.trim()) {
              recursos.push(...recursosStr.split(',').map(s => s.trim()).filter(Boolean));
            }
          }

          // Mapear tipo de projeto
          const tipoRaw = String(getVal(['tipo_projeto', 'tipoprojeto', 'tipo']) || 'Próprio').toUpperCase();
          let tipo: ProjectType = 'PROPRIO';
          if (tipoRaw.includes('TERCEIRO')) tipo = 'TERCEIRO';
          else if (tipoRaw.includes('ACOMP')) tipo = 'ACOMPANHAMENTO';
          
          return {
            id: Date.now().toString() + index,
            nome: String(getVal(['nome_projeto', 'nomeprojeto', 'nome', 'projeto', 'name']) || ''),
            squad: String(getVal(['nome_squad', 'nomesquad', 'squad']) || 'ECHO BR').toUpperCase(),
            prioridade: Number(getVal(['prioridade', 'priority'])) || index + 1,
            tipo,
            recursos,
            duracoes: {
              IN: Number(getVal(['num_sem_iniciacao', 'numseminiciacao', 'IN', 'inicia', 'iniciacao'])) || 0,
              ES: Number(getVal(['num_sem_especificacao', 'numsemespecificacao', 'ES', 'especif', 'especificacao'])) || 0,
              PL: Number(getVal(['num_sem_planejamento', 'numsemplanejamento', 'PL', 'planeja', 'planejamento'])) || 0,
              DE: Number(getVal(['num_sem_desenvolvimento', 'numsemdesenvolvimento', 'DE', 'desenvol', 'desenvolvimento'])) || 0,
              QA: Number(getVal(['num_sem_qa', 'numsemqa', 'QA', 'sem_q', 'qualidade'])) || 0,
              HO: Number(getVal(['num_sem_homologacao', 'numsemhomologacao', 'HO', 'homolo', 'homologacao'])) || 0,
              IM: Number(getVal(['num_sem_implantacao', 'numsemimplantacao', 'IM', 'implan', 'implantacao'])) || 0,
              OA: Number(getVal(['num_sem_operacaoassistida', 'numsemoperacaoassistida', 'OA', 'operacao', 'operacaoassistida'])) || 0,
              EN: Number(getVal(['num_sem_encerramento', 'numsemencerramento', 'EN', 'encerra', 'encerramento'])) || 0,
            },
            anoInicioObrigatorio: Number(getVal(['ano_inicio_obrigatorio', 'anoinicioobrigatorio'])) || undefined,
            semanaInicioObrigatorio: Number(getVal(['inicio_obrigatorio', 'inicioobrigatorio'])) || undefined,
            anoTerminoObrigatorio: Number(getVal(['ano_termino_obrigatorio', 'anoterminoobrigatorio'])) || undefined,
            semanaTerminoObrigatorio: Number(getVal(['termino_obrigatorio', 'terminoobrigatorio'])) || undefined,
          };
        }).filter(p => p.nome); // Filtrar linhas vazias
        
        setEditingData(importedProjects);
        toast.success(`${importedProjects.length} projetos importados com sucesso!`);
      } catch (error) {
        console.error('Erro ao importar:', error);
        toast.error('Erro ao importar arquivo. Verifique o formato.');
      }
    };
    
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="gantt-header px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📋 Projetos</h2>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleDownloadTemplate}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Download className="w-4 h-4 mr-1" /> Template
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Upload className="w-4 h-4 mr-1" /> Importar
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleAdd}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleSave}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Save className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-10 px-2 py-2 border-b border-border"></th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border min-w-[200px]">Nome</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-20">Prio</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-32">Tipo</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-24">Squad</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border min-w-[250px]">Recursos</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border w-28">Saving (R$)</th>
              <th className="w-16 px-4 py-2 border-b border-border"></th>
            </tr>
          </thead>
          <tbody>
            {editingData.map((row) => (
              <React.Fragment key={row.id}>
                <tr 
                  className="hover:bg-accent/30 transition-colors cursor-pointer bg-card"
                >
                  <td className="px-2 py-1.5 border-b border-border" onClick={() => toggleExpand(row.id)}>
                    {expandedRows.has(row.id) ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Input
                      value={row.nome}
                      onChange={(e) => handleChange(row.id, 'nome', e.target.value)}
                      className="h-8 text-sm bg-background"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Input
                      type="number"
                      value={row.prioridade}
                      onChange={(e) => handleChange(row.id, 'prioridade', Number(e.target.value))}
                      className="h-8 text-sm bg-background w-16"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Select
                      value={row.tipo || 'PROPRIO'}
                      onValueChange={(value) => handleChange(row.id, 'tipo', value)}
                    >
                      <SelectTrigger className="h-8 text-sm bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {PROJECT_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Input
                      value={row.squad}
                      onChange={(e) => handleChange(row.id, 'squad', e.target.value)}
                      className="h-8 text-sm bg-background"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <ResourcesMultiSelect
                      selectedResources={row.recursos}
                      availableResources={resources}
                      projectSquad={row.squad}
                      onChange={(newResources) => handleChange(row.id, 'recursos', newResources)}
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Input
                      type="number"
                      value={row.saving || ''}
                      onChange={(e) => handleChange(row.id, 'saving', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="0"
                      className="h-8 text-sm bg-background w-24"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
                
                {/* Linha expandida com durações e datas obrigatórias */}
                {expandedRows.has(row.id) && (
                  <tr className="bg-accent/20">
                    <td colSpan={8} className="px-4 py-3 border-b border-border">
                      <div className="space-y-3">
                        {/* Datas Obrigatórias */}
                        <div className="flex flex-wrap gap-4 items-center pb-2 border-b border-border/50">
                          <span className="text-sm font-medium text-muted-foreground">Datas Obrigatórias:</span>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Ano Início:</label>
                            <Input
                              type="number"
                              value={row.anoInicioObrigatorio || ''}
                              onChange={(e) => handleChange(row.id, 'anoInicioObrigatorio', e.target.value ? Number(e.target.value) : undefined)}
                              className="h-7 w-20 text-sm bg-background"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Sem. Início:</label>
                            <Input
                              type="number"
                              value={row.semanaInicioObrigatorio || ''}
                              onChange={(e) => handleChange(row.id, 'semanaInicioObrigatorio', e.target.value ? Number(e.target.value) : undefined)}
                              className="h-7 w-16 text-sm bg-background"
                              min={1}
                              max={53}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Ano Término:</label>
                            <Input
                              type="number"
                              value={row.anoTerminoObrigatorio || ''}
                              onChange={(e) => handleChange(row.id, 'anoTerminoObrigatorio', e.target.value ? Number(e.target.value) : undefined)}
                              className="h-7 w-20 text-sm bg-background"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Sem. Término:</label>
                            <Input
                              type="number"
                              value={row.semanaTerminoObrigatorio || ''}
                              onChange={(e) => handleChange(row.id, 'semanaTerminoObrigatorio', e.target.value ? Number(e.target.value) : undefined)}
                              className="h-7 w-16 text-sm bg-background"
                              min={1}
                              max={53}
                            />
                          </div>
                        </div>
                        
                        {/* Durações */}
                        <div className="flex flex-wrap gap-3 items-center">
                          <span className="text-sm font-medium text-muted-foreground">Duração por fase (semanas):</span>
                          {PHASES.map((phase) => (
                            <div key={phase} className="flex items-center gap-1">
                              <label className="text-xs font-medium text-muted-foreground">{phase}:</label>
                              <Input
                                type="number"
                                value={row.duracoes[phase] || 0}
                                onChange={(e) => handleChange(row.id, `duracao_${phase}`, e.target.value)}
                                className="h-7 w-14 text-sm bg-background"
                                min={0}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
