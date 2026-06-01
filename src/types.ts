export type ClickTimeUnit = 'ms' | 's' | 'm';
export type ClickType = 'single' | 'double' | 'right';

export interface TargetPoint {
  id: number;
  x: number; // Percent width of simulator container (0-100)
  y: number; // Percent height of simulator container (0-100)
  interval: number; // Duration amount
  unit: ClickTimeUnit;
  clickType: ClickType;
  label?: string;
}

export type AppMode = 'single' | 'multi';
export type SimulationState = 'idle' | 'running' | 'paused';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'click';
  targetId?: number;
}

export interface SwiftFile {
  name: string;
  path: string;
  language: string;
  description: string;
  code: string;
}
