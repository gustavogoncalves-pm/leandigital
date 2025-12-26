import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Project, Phase, PHASE_NAMES, DEFAULT_PHASE_COLORS, DEFAULT_PHASE_FONT_COLORS, TimelineRow, Resource, EngineConfig, SkillType } from '@/types/planning';
import { generateRoadmapFromAllocation, getWeeksFromAllocation } from './allocation-engine';

interface ExportPDFOptions {
  projects: Project[];
  allocation: TimelineRow[];
  resources: Resource[];
  phaseColors: Record<Phase, string>;
  phaseFontColors: Record<Phase, string>;
  anoInicio: number;
  semanaInicio: number;
  squadFilter?: string;
  engineConfig: EngineConfig;
  startWeek?: string;
  endWeek?: string;
}

type AllocationStatus = 'LIVRE' | 'PARCIAL' | 'TOTAL' | 'BLOQUEADO';

// Status colors RGB
const STATUS_COLORS: Record<AllocationStatus, [number, number, number]> = {
  TOTAL: [239, 68, 68],     // red-500
  PARCIAL: [59, 130, 246],  // blue-500
  LIVRE: [34, 197, 94],     // green-500
  BLOQUEADO: [168, 85, 247] // purple-500
};

// Convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function exportRoadmapPDF(options: ExportPDFOptions) {
  const { projects, allocation, resources, phaseColors, phaseFontColors, anoInicio, semanaInicio, squadFilter, engineConfig, startWeek, endWeek } = options;

  // Filter weeks by range if specified
  let allWeeks = getWeeksFromAllocation(allocation);
  if (startWeek || endWeek) {
    const startIdx = startWeek ? allWeeks.indexOf(startWeek) : 0;
    const endIdx = endWeek ? allWeeks.indexOf(endWeek) : allWeeks.length - 1;
    if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
      allWeeks = allWeeks.slice(startIdx, endIdx + 1);
    }
  }

  // Map resource name to skill
  const resourceSkillMap: Record<string, SkillType> = {};
  resources.forEach(r => {
    resourceSkillMap[r.nome.toUpperCase().trim()] = r.skill_recurso;
  });

  // Calculate allocation status for a resource in a given week
  const getResourceWeekStatus = (recurso: string, rows: TimelineRow[], week: string): AllocationStatus => {
    const skill = resourceSkillMap[recurso.toUpperCase().trim()];
    const capacity = skill ? engineConfig.capacidade[skill] : 1;
    
    let activeProjects = 0;
    let hasPersonalBlock = false;
    
    rows.forEach(row => {
      const cell = row.semanas[week];
      if (!cell) return;
      
      const status = cell.status || '';
      const blocked = cell.blocked || '';
      
      const blockedNormalized = blocked.replace(/\uFE0F/g, '');
      const isProjectWait = blockedNormalized.includes('Aguarda');
      const isVacation = blockedNormalized.includes('🏖') || blockedNormalized.includes('☀');
      const isPersonalStop = blockedNormalized.includes('⛔') && !isProjectWait;
      if (isVacation || isPersonalStop) {
        hasPersonalBlock = true;
      }
      
      const normalizedStatus = status.replace(/^🔥\s*/, '');
      const isRealPhase = /^(IN|ES|PL|DE|QA|HO|IM|OA|EN)$/.test(normalizedStatus);
      if (isRealPhase) {
        activeProjects++;
      }
    });

    if (activeProjects > 0) {
      if (activeProjects >= capacity) return 'TOTAL';
      return 'PARCIAL';
    }
    
    if (hasPersonalBlock) return 'BLOQUEADO';
    
    return 'LIVRE';
  };

  const fullWeeks = getWeeksFromAllocation(allocation);
  const roadmap = generateRoadmapFromAllocation(allocation, projects, fullWeeks);
  const weeks = allWeeks; // Use filtered weeks for PDF columns

  if (roadmap.length === 0 || weeks.length === 0) {
    return;
  }

  // Create PDF in landscape A3
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;

  // ========== HEADER ==========
  const pdfTitle = squadFilter 
    ? `Planejamento Mestre - ${squadFilter}` 
    : `Planejamento Mestre`;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(pdfTitle, margin, margin + 4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, margin, margin + 9);

  // ========== CALCULATE COLUMN WIDTHS ==========
  const labelColWidth = 75; // coluna de projeto/recurso (aumentada)
  const availableWidth = pageWidth - margin * 2 - labelColWidth;
  const weekColWidth = Math.max(3, Math.min(6, availableWidth / weeks.length));
  const weekHeaders = weeks.map((w) => w.replace(/^\d+-S/, ''));

  // ========== GROUP WEEKS BY YEAR (robust rollover detection) ==========
  // Some datasets may carry the same year in the key for weeks after the rollover (e.g. ...-S52, ...-S01).
  // For PDF headers we derive the display year by:
  // 1) trusting the key year when it changes, and
  // 2) incrementing the year when week number rolls over (52 -> 01).
  interface YearGroup { year: string; count: number; }

  const parseWeekKey = (weekKey: string): { keyYear: number; weekNum: number } | null => {
    const m = weekKey.match(/^(\d{4})-S(\d{1,2})$/);
    if (!m) return null;
    return { keyYear: parseInt(m[1], 10), weekNum: parseInt(m[2], 10) };
  };

  const yearGroups: YearGroup[] = [];

  let currentYear: number | null = null;
  let currentCount = 0;
  let prevWeekNum: number | null = null;
  let prevKeyYear: number | null = null;

  weeks.forEach((weekKey) => {
    const parsed = parseWeekKey(weekKey);
    const keyYear = parsed?.keyYear ?? null;
    const weekNum = parsed?.weekNum ?? null;

    // Decide display year for this column
    let displayYear: number;
    if (currentYear === null) {
      displayYear = keyYear ?? 0;
    } else if (keyYear !== null && prevKeyYear !== null && keyYear !== prevKeyYear) {
      // Explicit year change in key
      displayYear = keyYear;
    } else if (weekNum !== null && prevWeekNum !== null && weekNum < prevWeekNum) {
      // Week rollover (e.g. 52 -> 01)
      displayYear = currentYear + 1;
    } else {
      displayYear = currentYear;
    }

    if (currentYear === null || displayYear !== currentYear) {
      if (currentCount > 0 && currentYear !== null) {
        yearGroups.push({ year: String(currentYear), count: currentCount });
      }
      currentYear = displayYear;
      currentCount = 1;
    } else {
      currentCount++;
    }

    prevWeekNum = weekNum;
    prevKeyYear = keyYear;
  });

  if (currentCount > 0 && currentYear !== null) {
    yearGroups.push({ year: String(currentYear), count: currentCount });
  }

  // Build year header row with colSpan simulation and rowSpan for label
  const yearHeaderRow: any[] = [{ content: 'Projeto', rowSpan: 2, styles: { halign: 'left', fontStyle: 'bold', valign: 'middle' } }];
  yearGroups.forEach(({ year, count }) => {
    yearHeaderRow.push({ content: year, colSpan: count, styles: { halign: 'center', fontStyle: 'bold', fillColor: [30, 64, 90], textColor: [255, 255, 255] } });
  });

  // ========== ROADMAP TABLE ==========
  const roadmapWeekHeaders = ['', ...weekHeaders]; // First cell empty due to rowSpan
  const roadmapBody = roadmap.map((row) => {
    const rowData: any[] = [row.projeto];
    weeks.forEach((week) => {
      rowData.push(row.semanas[week] || '');
    });
    return rowData;
  });

  let startY = margin + 12;

  autoTable(doc, {
    startY,
    head: [yearHeaderRow, roadmapWeekHeaders],
    body: roadmapBody,
    theme: 'grid',
    styles: {
      fontSize: 6,
      cellPadding: 1.2,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    headStyles: {
      fillColor: [46, 83, 114],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5,
    },
    columnStyles: {
      0: { cellWidth: labelColWidth, halign: 'left', fontStyle: 'bold', fontSize: 6 },
      ...Object.fromEntries(weeks.map((_, i) => [i + 1, { cellWidth: weekColWidth }])),
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index > 0) {
        const cellValue = String(data.cell.raw || '').toUpperCase() as Phase;
        if (cellValue && phaseColors[cellValue]) {
          const bgColor = hexToRgb(phaseColors[cellValue]);
          const fontColor = hexToRgb(phaseFontColors[cellValue] || '#ffffff');
          data.cell.styles.fillColor = bgColor;
          data.cell.styles.textColor = fontColor;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ========== ALOCAÇÃO TABLE (expanded) ==========
  const roadmapFinalY = (doc as any).lastAutoTable?.finalY || startY + 40;

  // Group allocation by resource
  const groupedByResource: Record<string, TimelineRow[]> = {};
  allocation.forEach((row) => {
    if (!groupedByResource[row.recurso]) {
      groupedByResource[row.recurso] = [];
    }
    groupedByResource[row.recurso].push(row);
  });

  // Build allocation table body
  const allocationBody: any[][] = [];

  Object.entries(groupedByResource).forEach(([recurso, rows]) => {
    // Resource header row with status indicators
    const resourceRow: any[] = [`RECURSO: ${recurso}`];
    weeks.forEach((week) => {
      const status = getResourceWeekStatus(recurso, rows, week);
      // Use short codes: T=Total, P=Parcial, L=Livre, B=Bloqueado
      const statusCode = status === 'TOTAL' ? 'T' : status === 'PARCIAL' ? 'P' : status === 'LIVRE' ? 'L' : 'B';
      resourceRow.push(statusCode);
    });
    allocationBody.push(resourceRow);

    // Project rows for this resource
    rows.forEach((row) => {
      const projectRow: any[] = [`  P${row.prioridade} ${row.projeto.substring(0, 30)}`];
      weeks.forEach((week) => {
        const cell = row.semanas[week];
        const status = cell?.status || '';
        const blocked = cell?.blocked || '';

        const normalizedStatus = status.replace(/^🔥\s*/, '');
        const phaseMatch = normalizedStatus.match(/^(IN|ES|PL|DE|QA|HO|IM|OA|EN)$/);
        if (phaseMatch) {
          projectRow.push(phaseMatch[1]);
          return;
        }

        if (blocked) {
          const b = blocked.replace(/\uFE0F/g, '');
          if (b.includes('🏖') || b.includes('☀')) {
            projectRow.push('FE');
            return;
          }
          if (b.includes('Aguarda')) {
            projectRow.push('AG');
            return;
          }
          if (b.includes('⛔')) {
            projectRow.push('BL');
            return;
          }
        }

        projectRow.push('');
      });
      allocationBody.push(projectRow);
    });
  });

  // Build year header row for allocation table with rowSpan for label
  const allocationYearHeaderRow: any[] = [{ content: 'Recurso / Projeto', rowSpan: 2, styles: { halign: 'left', fontStyle: 'bold', valign: 'middle' } }];
  yearGroups.forEach(({ year, count }) => {
    allocationYearHeaderRow.push({ content: year, colSpan: count, styles: { halign: 'center', fontStyle: 'bold', fillColor: [30, 64, 90], textColor: [255, 255, 255] } });
  });

  const allocationWeekHeaders = ['', ...weekHeaders]; // First cell empty due to rowSpan

  autoTable(doc, {
    startY: roadmapFinalY + 6,
    head: [allocationYearHeaderRow, allocationWeekHeaders],
    body: allocationBody,
    theme: 'grid',
    styles: {
      fontSize: 5,
      cellPadding: 1,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    headStyles: {
      fillColor: [46, 83, 114],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 4.5,
    },
    columnStyles: {
      0: { cellWidth: labelColWidth, halign: 'left', fontSize: 5 },
      ...Object.fromEntries(weeks.map((_, i) => [i + 1, { cellWidth: weekColWidth }])),
    },
    didParseCell: function (data) {
      // Style resource header rows
      if (data.section === 'body' && data.column.index === 0) {
        const cellText = String(data.cell.raw || '');
        if (cellText.startsWith('RECURSO:')) {
          data.cell.styles.fillColor = [230, 240, 250];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 5.5;
        }
      }

      // Style status cells in resource header rows (T, P, L, B)
      if (data.section === 'body' && data.column.index > 0) {
        const cellText = String(data.cell.raw || '');
        
        // Check if this is a status indicator cell
        if (cellText === 'T') {
          data.cell.styles.fillColor = STATUS_COLORS.TOTAL;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          return;
        }
        if (cellText === 'P') {
          data.cell.styles.fillColor = STATUS_COLORS.PARCIAL;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          return;
        }
        if (cellText === 'L') {
          data.cell.styles.fillColor = STATUS_COLORS.LIVRE;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          return;
        }
        if (cellText === 'B') {
          data.cell.styles.fillColor = STATUS_COLORS.BLOQUEADO;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          return;
        }

        // Style phase cells
        const cellValue = cellText.toUpperCase() as Phase;
        if (cellValue && phaseColors[cellValue]) {
          const bgColor = hexToRgb(phaseColors[cellValue]);
          const fontColor = hexToRgb(phaseFontColors[cellValue] || '#ffffff');
          data.cell.styles.fillColor = bgColor;
          data.cell.styles.textColor = fontColor;
          data.cell.styles.fontStyle = 'bold';
          return;
        }

        if (cellText === 'FE') {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellText === 'AG') {
          data.cell.styles.fillColor = [254, 249, 195];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellText === 'BL') {
          data.cell.styles.fillColor = [254, 202, 202];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ========== LEGEND ==========
  const allocationFinalY = (doc as any).lastAutoTable?.finalY || pageHeight - 20;
  let legendY = allocationFinalY + 3;

  if (legendY < pageHeight - 10) {
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Legenda:', margin, legendY);

    let legendX = margin + 12;
    const phases: Phase[] = ['IN', 'ES', 'PL', 'DE', 'QA', 'HO', 'IM', 'OA', 'EN'];

    phases.forEach((phase) => {
      const bgColor = hexToRgb(phaseColors[phase] || DEFAULT_PHASE_COLORS[phase]);
      const fontColor = hexToRgb(phaseFontColors[phase] || DEFAULT_PHASE_FONT_COLORS[phase]);

      doc.setFillColor(...bgColor);
      doc.rect(legendX, legendY - 2, 4, 3, 'F');

      doc.setFontSize(3);
      doc.setTextColor(...fontColor);
      doc.text(phase, legendX + 2, legendY, { align: 'center' });

      doc.setFontSize(4);
      doc.setTextColor(60, 60, 60);
      doc.text(PHASE_NAMES[phase], legendX + 5.5, legendY);

      legendX += 22;
    });

    // Symbols legend
    doc.setFontSize(4);
    doc.text('FE=Férias  AG=Aguardando  BL=Bloqueado', margin + 12, legendY + 4);

    // Status legend
    let statusLegendX = margin + 12;
    const statusLegendY = legendY + 8;
    
    const statusItems: { code: string; label: string; color: [number, number, number] }[] = [
      { code: 'T', label: 'Total', color: STATUS_COLORS.TOTAL },
      { code: 'P', label: 'Parcial', color: STATUS_COLORS.PARCIAL },
      { code: 'L', label: 'Livre', color: STATUS_COLORS.LIVRE },
      { code: 'B', label: 'Bloqueado', color: STATUS_COLORS.BLOQUEADO },
    ];

    doc.setFontSize(4);
    doc.text('Alocação:', margin, statusLegendY);
    
    statusItems.forEach(({ code, label, color }) => {
      doc.setFillColor(...color);
      doc.rect(statusLegendX, statusLegendY - 2, 4, 3, 'F');
      
      doc.setFontSize(3);
      doc.setTextColor(255, 255, 255);
      doc.text(code, statusLegendX + 2, statusLegendY, { align: 'center' });
      
      doc.setFontSize(4);
      doc.setTextColor(60, 60, 60);
      doc.text(label, statusLegendX + 5.5, statusLegendY);
      
      statusLegendX += 18;
    });
  }

  // Save
  const fileName = `Planejamento_${anoInicio}_S${semanaInicio}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

