import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';

interface PDFExportDialogProps {
  availableWeeks: string[];
  onExport: (startWeek: string, endWeek: string) => void;
}

export function PDFExportDialog({ availableWeeks, onExport }: PDFExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startWeek, setStartWeek] = useState<string>('');
  const [endWeek, setEndWeek] = useState<string>('');

  // Extrair anos e semanas disponíveis
  const weeksByYear = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    availableWeeks.forEach(week => {
      const [ano] = week.split('-');
      if (!grouped[ano]) grouped[ano] = [];
      grouped[ano].push(week);
    });
    return grouped;
  }, [availableWeeks]);

  const years = useMemo(() => Object.keys(weeksByYear).sort(), [weeksByYear]);

  // Parse semana para exibição
  const parseWeek = (week: string) => {
    const match = week.match(/(\d{4})-S(\d+)/);
    if (match) return { year: match[1], week: match[2] };
    return { year: '', week: '' };
  };

  const handleExport = () => {
    const start = startWeek || availableWeeks[0];
    const end = endWeek || availableWeeks[availableWeeks.length - 1];
    onExport(start, end);
    setOpen(false);
  };

  const formatWeekLabel = (week: string) => {
    const { year, week: weekNum } = parseWeek(week);
    return `Semana ${weekNum} de ${year}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center w-full px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm">
          <FileText className="w-4 h-4 mr-2" />
          Roadmap (PDF)
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar PDF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Período Início</Label>
            <Select value={startWeek} onValueChange={setStartWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a semana inicial" />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-popover">
                {availableWeeks.map(week => (
                  <SelectItem key={week} value={week}>
                    {formatWeekLabel(week)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período Fim</Label>
            <Select value={endWeek} onValueChange={setEndWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a semana final" />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-popover">
                {availableWeeks.map(week => (
                  <SelectItem key={week} value={week}>
                    {formatWeekLabel(week)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            {!startWeek && !endWeek 
              ? `Por padrão, exportará todas as ${availableWeeks.length} semanas.`
              : `Exportará de ${startWeek ? formatWeekLabel(startWeek) : 'início'} até ${endWeek ? formatWeekLabel(endWeek) : 'fim'}.`
            }
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>
            Exportar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
