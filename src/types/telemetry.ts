export type FatigueStatus = 'NORMAL' | 'WASPADA' | 'KRITIS' | 'DATA_TIDAK_VALID';

export type HapticMode = 'MATI' | 'GETAR_LEMBUT' | 'GETAR_KUAT';

export type ViewTab = 'live' | 'history' | 'alarms' | 'connection';

export type OperatingMode = 'live' | 'simulation';

export type ThemeMode = 'light' | 'dark';

export interface DriverBaseline {
  hrBpm: number;
  rmssdMs: number;
  sdnnMs: number;
  spo2Pct: number;
}

export interface TelemetryPacket {
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  deviceId: string;
  timestamp: string;
  status: FatigueStatus;
  fatigueIndex: number;
  t1: number;
  t2: number;
  hrBpm: number | null;
  rmssdMs: number | null;
  sdnnMs: number | null;
  lfHfRatio: number | null;
  spo2Pct: number | null;
  sqiPct: number;
  imuRmsG: number | null;
  hapticMode: HapticMode;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  batteryPct: number | null;
  baseline: DriverBaseline;
  isSimulated?: boolean;
}

export interface AlarmEvent {
  id: string;
  vehicleId: string;
  driverName: string;
  severity: 'WASPADA' | 'KRITIS';
  triggerReason: string;
  fatigueIndex: number | null;
  spo2Pct: number | null;
  hapticMode: HapticMode;
  lat: number | null;
  lng: number | null;
  qos: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgeNote?: string;
  acknowledgedAt?: string;
  triggeredAt: string;
  isSimulated?: boolean;
}

export interface MqttConnectionConfig {
  url: string;
  username: string;
  password: string;
  topicPrefix: string;
}

export type MqttConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface RawMqttMessageLog {
  id: string;
  receivedAt: string;
  topic: string;
  qos: number;
  payloadPreview: string;
  valid: boolean;
}

export interface ApiHealthResponse {
  ok: boolean;
  php_version?: string;
  database_connected?: boolean;
  tables?: Record<string, boolean>;
  server_time_utc?: string;
  message?: string;
  error?: string;
}
