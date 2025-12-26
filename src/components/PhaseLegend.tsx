import { PHASES, PHASE_NAMES, Phase, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS } from '@/types/planning';
import { PhaseBadge } from './PhaseBadge';
import { Clock, Gauge, CheckCircle2, Umbrella, Users, LogOut, HelpCircle, Circle, Lock } from 'lucide-react';

interface PhaseLegendProps {
  phaseColors?: Record<Phase, string>;
  phaseFontColors?: Record<Phase, string>;
}

export function PhaseLegend({ phaseColors, phaseFontColors }: PhaseLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-border overflow-hidden">
      <span className="text-xs font-medium text-muted-foreground mr-2">Legenda Etapas:</span>
      {PHASES.map((phase) => (
        <div key={phase} className="flex items-center gap-1.5">
          <PhaseBadge phase={phase} className="w-8" phaseColors={phaseColors} phaseFontColors={phaseFontColors} />
          <span className="text-xs text-muted-foreground">{PHASE_NAMES[phase]}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
        <div className="phase-cell bg-blue-500/20 w-8 flex items-center justify-center">
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
        <span className="text-xs text-muted-foreground">Aguardando</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-red-500/20 w-8 flex items-center justify-center">
          <Gauge className="w-4 h-4 text-red-400" />
        </div>
        <span className="text-xs text-muted-foreground">Capacidade</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-amber-500/20 w-8 flex items-center justify-center">
          <Umbrella className="w-4 h-4 text-amber-500" />
        </div>
        <span className="text-xs text-muted-foreground">Férias</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-purple-500/20 w-8 flex items-center justify-center">
          <Users className="w-4 h-4 text-purple-500" />
        </div>
        <span className="text-xs text-muted-foreground">Outra Squad</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-gray-500/20 w-8 flex items-center justify-center">
          <LogOut className="w-4 h-4 text-gray-500" />
        </div>
        <span className="text-xs text-muted-foreground">Saída</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-emerald-500/20 w-8 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <span className="text-xs text-muted-foreground">Concluído</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-green-500/20 w-8 flex items-center justify-center">
          <span className="text-sm">🟢</span>
        </div>
        <span className="text-xs text-muted-foreground">Disponível</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="phase-cell bg-orange-500/20 w-8 flex items-center justify-center">
          <Lock className="w-4 h-4 text-orange-500" />
        </div>
        <span className="text-xs text-muted-foreground">Reservado (Smart Flow)</span>
      </div>
      
      {/* Legenda Status Recurso */}
      <div className="w-full mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground mr-2">Status Recurso:</span>
        <div className="flex items-center gap-1.5">
          <Circle className="w-4 h-4 text-red-500 fill-current" />
          <span className="text-xs text-muted-foreground">Totalmente Alocado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="w-4 h-4 text-blue-500 fill-current" />
          <span className="text-xs text-muted-foreground">Parcialmente Alocado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="w-4 h-4 text-green-500 fill-current" />
          <span className="text-xs text-muted-foreground">Livre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle className="w-4 h-4 text-purple-500 fill-current" />
          <span className="text-xs text-muted-foreground">Bloqueado</span>
        </div>
      </div>
    </div>
  );
}
