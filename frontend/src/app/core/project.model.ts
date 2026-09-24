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
  createdBy: number | null;
  canDelete: boolean;
  // Use the server count; missing data must not be shown as a made-up zero.
  taskCount?: number;
}
