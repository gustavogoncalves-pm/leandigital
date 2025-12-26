import { Project, Resource, Vacation, Stage, Phase, ProjectType, BlockType } from '@/types/planning';

export const sampleProjects: Project[] = [];

export const sampleResources: Resource[] = [];

export const sampleVacations: Vacation[] = [];

export const sampleStages: Stage[] = [
  { id: 1, sigla: 'IN', nome: 'Iniciação' },
  { id: 2, sigla: 'ES', nome: 'Especificação' },
  { id: 3, sigla: 'PL', nome: 'Planejamento' },
  { id: 4, sigla: 'DE', nome: 'Desenvolvimento' },
  { id: 5, sigla: 'QA', nome: 'Qualidade' },
  { id: 6, sigla: 'HO', nome: 'Homologação' },
  { id: 7, sigla: 'IM', nome: 'Implantação' },
  { id: 8, sigla: 'OA', nome: 'Operação Assistida' },
  { id: 9, sigla: 'EN', nome: 'Encerramento' },
];
