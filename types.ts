
export enum AppMode {
  GENERAL = 'General',
  RETAIL = 'Retail/Inventory',
  ACCESSIBILITY = 'Accessibility',
  SECURITY = 'Security/Surveillance',
  EDUCATIONAL = 'Educational'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface Detection {
  label: string;
  confidence: number;
  box_2d: BoundingBox;
  count?: number;
  status?: 'ok' | 'low-stock' | 'suspicious' | 'normal';
}

export interface DetectionResult {
  detections: Detection[];
  summary: string;
  reasoning?: string;
  timestamp: number;
}

export interface PerformanceMetrics {
  latency: number;
  fps: number;
  detectionsCount: number;
}

export interface AppSettings {
  confidenceThreshold: number;
  autoScan: boolean;
  scanInterval: number;
  voiceAnnounce: boolean;
}
