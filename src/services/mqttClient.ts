import mqtt, { type MqttClient } from 'mqtt';
import type {
  AlarmEvent,
  FatigueStatus,
  HapticMode,
  MqttConnectionConfig,
  MqttConnectionStatus,
  RawMqttMessageLog,
  TelemetryPacket,
} from '../types/telemetry';

export interface MqttClientCallbacks {
  onStatusChange: (status: MqttConnectionStatus, errorMessage?: string) => void;
  onTelemetry: (packet: TelemetryPacket) => void;
  onAlarm: (alarm: AlarmEvent) => void;
  onRawLog: (entry: RawMqttMessageLog) => void;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeStatus(raw: unknown): FatigueStatus {
  const normalized = String(raw ?? 'NORMAL')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (
    normalized === 'NORMAL' ||
    normalized === 'WASPADA' ||
    normalized === 'KRITIS' ||
    normalized === 'DATA_TIDAK_VALID'
  ) {
    return normalized;
  }
  return 'NORMAL';
}

function normalizeHaptic(raw: unknown, status: FatigueStatus): HapticMode {
  const val = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (val === 'MATI' || val === 'GETAR_LEMBUT' || val === 'GETAR_KUAT') {
    return val;
  }
  if (status === 'KRITIS') return 'GETAR_KUAT';
  if (status === 'WASPADA') return 'GETAR_LEMBUT';
  return 'MATI';
}

function normalizeTimestamp(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw > 9999999999 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

export function normalizeTelemetryPayload(
  raw: Record<string, unknown>,
  topic = ''
): TelemetryPacket | null {
  const topicParts = topic.split('/');
  const fallbackVehicle = topicParts.length >= 2 ? topicParts[1] : '';
  const vehicleId = String(raw.vehicle_id ?? raw.vehicleId ?? fallbackVehicle).trim();
  if (!vehicleId) return null;

  const status = normalizeStatus(raw.status);
  const fatigueRaw = Number(raw.fatigue_index ?? raw.fatigueIndex ?? 0);
  const fatigueIndex = Number.isFinite(fatigueRaw)
    ? Math.max(0, Math.min(1, fatigueRaw))
    : 0;

  const rawBaseline =
    typeof raw.baseline === 'object' && raw.baseline !== null
      ? (raw.baseline as Record<string, unknown>)
      : {};

  return {
    vehicleId,
    plateNumber: String(raw.plate_number ?? raw.plateNumber ?? vehicleId).trim(),
    driverName: String(raw.driver_name ?? raw.driverName ?? 'Pengemudi').trim(),
    deviceId: String(raw.device_id ?? raw.deviceId ?? 'ESP32-C3').trim(),
    timestamp: normalizeTimestamp(raw.timestamp ?? raw.recorded_at),
    status,
    fatigueIndex,
    t1: toNumberOrNull(raw.t1) ?? 0.45,
    t2: toNumberOrNull(raw.t2) ?? 0.75,
    hrBpm: toNumberOrNull(raw.hr_bpm ?? raw.hrBpm),
    rmssdMs: toNumberOrNull(raw.rmssd_ms ?? raw.rmssdMs),
    sdnnMs: toNumberOrNull(raw.sdnn_ms ?? raw.sdnnMs),
    lfHfRatio: toNumberOrNull(raw.lf_hf_ratio ?? raw.lfHfRatio),
    spo2Pct: toNumberOrNull(raw.spo2_pct ?? raw.spo2Pct),
    sqiPct: Math.max(0, Math.min(100, Math.round(Number(raw.sqi_pct ?? raw.sqiPct ?? 0)))),
    imuRmsG: toNumberOrNull(raw.imu_rms_g ?? raw.imuRmsG),
    hapticMode: normalizeHaptic(raw.haptic_mode ?? raw.hapticMode, status),
    lat: toNumberOrNull(raw.lat),
    lng: toNumberOrNull(raw.lng),
    speedKmh: toNumberOrNull(raw.speed_kmh ?? raw.speedKmh),
    batteryPct: toNumberOrNull(raw.battery_pct ?? raw.batteryPct),
    baseline: {
      hrBpm: toNumberOrNull(rawBaseline.hr_bpm ?? rawBaseline.hrBpm) ?? 72,
      rmssdMs: toNumberOrNull(rawBaseline.rmssd_ms ?? rawBaseline.rmssdMs) ?? 42,
      sdnnMs: toNumberOrNull(rawBaseline.sdnn_ms ?? rawBaseline.sdnnMs) ?? 52,
      spo2Pct: toNumberOrNull(rawBaseline.spo2_pct ?? rawBaseline.spo2Pct) ?? 98,
    },
    isSimulated: false,
  };
}

export class SdmsMqttService {
  private client: MqttClient | null = null;
  private callbacks: MqttClientCallbacks;

  constructor(callbacks: MqttClientCallbacks) {
    this.callbacks = callbacks;
  }

  connect(config: MqttConnectionConfig): void {
    this.disconnect();

    const cleanUrl = config.url.trim();
    if (!cleanUrl) {
      this.callbacks.onStatusChange('error', 'URL Broker WSS wajib diisi.');
      return;
    }

    const prefix = config.topicPrefix.trim().replace(/\/+$/, '') || 'sdms';
    this.callbacks.onStatusChange('connecting');

    // Tangani variasi export default/named antara mode dev dan bundle produksi Vite.
    const mqttLib = mqtt as unknown as {
      connect?: typeof mqtt.connect;
      default?: { connect: typeof mqtt.connect };
    };
    const connectFn = mqttLib.connect ?? mqttLib.default?.connect;
    if (typeof connectFn !== 'function') {
      this.callbacks.onStatusChange('error', 'Modul MQTT browser gagal dimuat.');
      return;
    }

    const client = connectFn(cleanUrl, {
      username: config.username.trim() || undefined,
      password: config.password || undefined,
      clean: true,
      reconnectPeriod: 4000,
      connectTimeout: 8000,
      clientId: `sdms-web-${Math.random().toString(16).slice(2, 8)}`,
    });

    this.client = client;

    client.on('connect', () => {
      this.callbacks.onStatusChange('connected');
      client.subscribe(`${prefix}/+/telemetry`, { qos: 0 });
      client.subscribe(`${prefix}/+/alarm`, { qos: 1 });
    });

    client.on('reconnect', () => {
      this.callbacks.onStatusChange('reconnecting');
    });

    client.on('close', () => {
      if (this.client) {
        this.callbacks.onStatusChange('disconnected');
      }
    });

    client.on('error', (err) => {
      this.callbacks.onStatusChange(
        'error',
        err instanceof Error ? err.message : 'Koneksi ke EMQX Cloud gagal.'
      );
    });

    client.on('message', (topic, messageBuffer, packetMeta) => {
      const rawText = messageBuffer.toString();
      const receivedAt = new Date().toISOString();
      let parsed: Record<string, unknown> | null = null;

      try {
        const candidate = JSON.parse(rawText);
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
          parsed = candidate as Record<string, unknown>;
        }
      } catch {
        parsed = null;
      }

      const normalized = parsed ? normalizeTelemetryPayload(parsed, topic) : null;

      this.callbacks.onRawLog({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        receivedAt,
        topic,
        qos: packetMeta?.qos ?? 0,
        payloadPreview: rawText.slice(0, 260),
        valid: normalized !== null,
      });

      if (!normalized || !parsed) return;

      this.callbacks.onTelemetry(normalized);

      if (topic.endsWith('/alarm') || normalized.status === 'KRITIS') {
        const triggerReason = String(
          parsed.trigger_reason ??
            parsed.triggerReason ??
            (normalized.spo2Pct !== null && normalized.spo2Pct < 92
              ? `SpO2 ${normalized.spo2Pct.toFixed(1)}% di bawah ambang 92%`
              : `Indeks Kelelahan ${normalized.fatigueIndex.toFixed(2)} melampaui T2 (${normalized.t2.toFixed(2)})`)
        );

        this.callbacks.onAlarm({
          id: `mqtt-${normalized.vehicleId}-${Date.now()}`,
          vehicleId: normalized.vehicleId,
          driverName: normalized.driverName,
          severity: normalized.status === 'WASPADA' ? 'WASPADA' : 'KRITIS',
          triggerReason,
          fatigueIndex: normalized.fatigueIndex,
          spo2Pct: normalized.spo2Pct,
          hapticMode: normalized.hapticMode,
          lat: normalized.lat,
          lng: normalized.lng,
          qos: packetMeta?.qos ?? 1,
          acknowledged: false,
          triggeredAt: normalized.timestamp,
          isSimulated: false,
        });
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      const active = this.client;
      this.client = null;
      active.removeAllListeners();
      active.end(true);
    }
    this.callbacks.onStatusChange('disconnected');
  }
}
