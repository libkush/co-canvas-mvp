export interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  width: number;
  height: number;
}

export interface StagePosition {
  x: number;
  y: number;
}

export interface Cursor {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

export interface ClusterLabel {
  name: string;
  x: number;
  y: number;
  noteIds: string[];
}

export interface ClusterResult {
  name: string;
  noteIds: string[];
}

export interface TidyResponse {
  clusters: ClusterResult[];
}

export const STICKY_NOTE_COLORS = [
  '#fef08a', // yellow
  '#fca5a5', // red
  '#86efac', // green
  '#93c5fd', // blue
  '#c4b5fd', // purple
  '#fdba74', // orange
  '#f9a8d4', // pink
] as const;

export const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
] as const;

export const DEFAULT_NOTE_WIDTH = 200;
export const DEFAULT_NOTE_HEIGHT = 150;
