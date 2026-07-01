
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
  voiceAnnounce: boolean;
  maxDetections: number;
  speechRate: number; // voice rate (e.g. 1.0)
  videoSource: 'webcam' | 'cctv';
  cctvUrl: string;
}

export interface EventLog {
  time: string;
  label: string;
  confidence: number;
  status?: string;
  mode: string;
}
