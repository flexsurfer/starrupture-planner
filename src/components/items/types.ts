/**
 * Items Package Type Definitions
 */

// Type definitions for corporation data
export interface CorporationComponent {
  id: string;
  points: number;
  cost?: number | null;
}

export interface CorporationLevel {
  level: number;
  components: CorporationComponent[];
  rewards: Array<{ name: string }>;
}

export interface CorporationData {
  id: string;
  levels: CorporationLevel[];
}

export type CorporationsData = Record<string, CorporationData>;

// Corporation usage information
export interface CorporationUsage {
  corporation: string;
  level: number;
}

// Item-related types from the main db
export type { Item } from "../../state/db";
