import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, CalendarIcon } from 'lucide-react';
import { format, getISOWeek, getISOWeekYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { EngineConfig } from '@/types/planning';

interface ConfigPanelProps {
  dataInicio: string;
  semanaInicio: number;
  anoInicio: number;
  engineConfig: EngineConfig;
  onDataInicioChange: (value: string) => void;
  onSemanaInicioChange: (value: number) => void;
  onAnoInicioChange: (value: number) => void;
  onEngineConfigChange: (config: EngineConfig) => void;
}

export function ConfigPanel({ 
  dataInicio,
  semanaInicio,
  anoInicio,
  engineConfig,
  onDataInicioChange,
  onSemanaInicioChange,
  onAnoInicioChange,
  onEngineConfigChange,
}: ConfigPanelProps) {
  const [open, setOpen] = useState(false);
  
  // Converter dataInicio (DD/MM/YYYY) para Date
  const parseDataInicio = (): Date | undefined => {
    if (!dataInicio) return undefined;
    const parts = dataInicio.split('/');
    if (parts.length !== 3) return undefined;
    const [day, month, year] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? undefined : date;
  };
  
  const selectedDate = parseDataInicio();

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'dd/MM/yyyy');
      onDataInicioChange(formatted);
      
      const isoWeek = getISOWeek(date);
      const isoYear = getISOWeekYear(date);
      onSemanaInicioChange(isoWeek);
      onAnoInicioChange(isoYear);
    }
    setOpen(false);
  };

  return (
    <div className="glass-card p-4 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Configurações</h3>
      </div>
      
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="dataInicio" className="text-sm text-muted-foreground whitespace-nowrap">
            Data Início:
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-36 justify-start text-left font-normal h-9",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "DD/MM/AAAA"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded">
          <span>Ano: <strong className="text-foreground">{anoInicio}</strong></span>
          <span>•</span>
          <span>Semana: <strong className="text-foreground">S{semanaInicio.toString().padStart(2, '0')}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="bufferSeguranca" className="text-sm text-muted-foreground whitespace-nowrap">
            Buffer JIT (semanas):
          </Label>
          <Input
            id="bufferSeguranca"
            type="number"
            min="0"
            max="10"
            value={engineConfig.bufferSeguranca ?? 2}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onEngineConfigChange({
                ...engineConfig,
                bufferSeguranca: value,
              });
            }}
            className="w-20 h-9"
          />
        </div>
      </div>
    </div>
  );
}