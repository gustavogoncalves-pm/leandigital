import { Phase, PHASE_NAMES, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS } from '@/types/planning';
import { cn } from '@/lib/utils';
import { Ban, CheckCircle2, Umbrella, Users, LogOut, HelpCircle, Clock, Gauge } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PhaseBadgeProps {
  phase: Phase | string;
  showLabel?: boolean;
  className?: string;
  customColor?: string;
  phaseColors?: Record<Phase, string>;
  phaseFontColors?: Record<Phase, string>;
}

export function PhaseBadge({ phase, showLabel = false, className, customColor, phaseColors, phaseFontColors }: PhaseBadgeProps) {
  // Remover prefixo de foguinho (projetos com datas obrigatórias) para extrair a fase real
  const cleanPhase = phase.replace(/^🔥\s*/, '');
  const upperPhase = cleanPhase.toUpperCase();
  
  const isCompleted = upperPhase.includes('CONCLUÍDO') || upperPhase.includes('✅');
  const isVacation = upperPhase.includes('🏖️') || upperPhase === 'FÉRIAS';
  const isOutraSquad = upperPhase.includes('SQUAD') || (upperPhase.startsWith('⛔') && !upperPhase.includes('AGUARDA') && !upperPhase.includes('SAIU'));
  const isSaiu = upperPhase.includes('SAIU');
  const isAguardaRecurso = upperPhase.includes('AGUARDA');
  const isCapacidadeMax = upperPhase.includes('MAX(');
  const isNC = upperPhase.includes('N/CAD') || upperPhase.includes('❓');
  const isWaiting = upperPhase.includes('AGUARDANDO') || upperPhase === '⏳ AGUARDANDO';
  const isNotParticipating = upperPhase === '---';

  if (isCompleted) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-emerald-500/20 flex items-center justify-center', className)}>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Concluído</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isVacation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-amber-500/20 flex items-center justify-center', className)}>
              <Umbrella className="w-4 h-4 text-amber-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Férias</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isOutraSquad) {
    let motivo = phase.replace('⛔', '').trim();
    if (!motivo) motivo = 'Outra Squad';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-purple-500/20 flex items-center justify-center', className)}>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{motivo}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isSaiu) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-gray-500/20 flex items-center justify-center', className)}>
              <LogOut className="w-4 h-4 text-gray-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Saiu da empresa</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isNC) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-orange-500/20 flex items-center justify-center', className)}>
              <HelpCircle className="w-4 h-4 text-orange-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Recurso não cadastrado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isAguardaRecurso) {
    let motivo = phase.replace('⛔', '').trim();
    if (!motivo) motivo = 'Aguardando recurso';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-blue-500/20 flex items-center justify-center', className)}>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{motivo}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isCapacidadeMax) {
    let motivo = phase.replace('⛔', '').trim();
    if (!motivo) motivo = 'Capacidade máxima';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('phase-cell bg-red-500/20 flex items-center justify-center', className)}>
              <Gauge className="w-4 h-4 text-red-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{motivo}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Retorna null (célula em branco) quando não há alocação
  if (isNotParticipating || isWaiting || !phase) {
    return null;
  }

  const phaseKey = upperPhase as Phase;
  
  // Usar cores customizadas se fornecidas
  const bgColor = customColor || phaseColors?.[phaseKey] || DEFAULT_PHASE_COLORS[phaseKey];
  const fontColor = phaseFontColors?.[phaseKey] || DEFAULT_PHASE_FONT_COLORS[phaseKey];
  
  if (bgColor) {
    // Renderizar com cores customizadas usando estilo inline
    return (
      <div 
        className={cn('phase-cell', className)} 
        style={{ 
          backgroundColor: bgColor,
          color: fontColor,
          fontWeight: 600,
        }}
        title={PHASE_NAMES[phaseKey] || phase}
      >
        {phaseKey}
      </div>
    );
  }

  const phaseClasses: Record<Phase, string> = {
    IN: 'phase-in',
    ES: 'phase-es',
    PL: 'phase-pl',
    DE: 'phase-de',
    QA: 'phase-qa',
    HO: 'phase-ho',
    IM: 'phase-im',
    OA: 'phase-oa',
    EN: 'phase-en',
  };

  const phaseClass = phaseClasses[phaseKey] || 'phase-wait';

  return (
    <div 
      className={cn('phase-cell', phaseClass, className)} 
      title={PHASE_NAMES[phaseKey] || phase}
    >
      {showLabel ? phaseKey : phaseKey}
    </div>
  );
}
