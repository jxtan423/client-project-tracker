export type ProjectStatus = 'planned' | 'in_progress' | 'completed';

export interface ProjectInput {
  name: string;
  clientName: string;
  status?: ProjectStatus;
  startDate: string;
}

export interface Project extends ProjectInput {
  id: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  // Not returned by the current backend. Never substitute a made-up zero.
  taskCount?: number;
}
