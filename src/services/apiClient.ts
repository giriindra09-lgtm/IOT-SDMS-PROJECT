import type {
  AlarmEvent,
  ApiHealthResponse,
  FatigueStatus,
  HapticMode,
  TelemetryPacket,
} from '../types/telemetry';

function cleanBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim() || '/api';
  return trimmed.replace(/\/+$/, '');
}

async function fetchJsonWithTimeout<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Respons dari ${url} bukan JSON valid (HTTP ${response.status}). Pastikan endpoint PHP aktif di server cPanel.`
      );
    }

    if (!response.ok) {
      const msg = typeof parsed.error === 'string' ? parsed.error : `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Permintaan ke ${url} habis waktu (timeout 8 detik).`);
    }
    throw err instanceof Error ? err : new Error('Gagal menghubungi API cPanel.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkApiHealth(baseUrl: string): Promise<ApiHealthResponse> {
  const base = cleanBaseUrl(baseUrl);
  return fetchJsonWithTimeout<ApiHealthResponse>(`${base}/health.php`);
}

interface RawHistoryRow {
  id: number;
  vehicle_id: string;
  status: FatigueStatus;
  fatigue_index: string | number;
  hr_bpm: string | number | null;
  rmssd_ms: string | number | null;
  sdnn_ms: string | number | null;
  lf_hf_ratio: string | number | null;
  spo2_pct: string | number | null;
  sqi_pct: string | number;
  imu_rms_g: string | number | null;
  haptic_mode: HapticMode;
  lat: string | number | null;
  lng: string | number | null;
  speed_kmh: string | number | null;
  battery_pct: string | number | null;
  recorded_at: string;
}

function toOptNumber(val: string | number | null): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function fetchApiHistory(
  baseUrl: string,
  vehicleId: string,
  limit = 120
): Promise<TelemetryPacket[]> {
  const base = cleanBaseUrl(baseUrl);
  const params = new URLSearchParams({ limit: String(limit) });
  if (vehicleId) params.set('vehicle_id', vehicleId);

  const data = await fetchJsonWithTimeout<{ ok: boolean; records?: RawHistoryRow[] }>(
    `${base}/history.php?${params.toString()}`
  );

  const rows = data.records ?? [];
  return rows.map((row) => ({
    vehicleId: row.vehicle_id,
    plateNumber: row.vehicle_id,
    driverName: 'Arsip MySQL',
    deviceId: 'Gateway LTE',
    timestamp: row.recorded_at.includes('T')
      ? row.recorded_at
      : `${row.recorded_at.replace(' ', 'T')}Z`,
    status: row.status,
    fatigueIndex: Number(row.fatigue_index ?? 0),
    t1: 0.45,
    t2: 0.75,
    hrBpm: toOptNumber(row.hr_bpm),
    rmssdMs: toOptNumber(row.rmssd_ms),
    sdnnMs: toOptNumber(row.sdnn_ms),
    lfHfRatio: toOptNumber(row.lf_hf_ratio),
    spo2Pct: toOptNumber(row.spo2_pct),
    sqiPct: Number(row.sqi_pct ?? 0),
    imuRmsG: toOptNumber(row.imu_rms_g),
    hapticMode: row.haptic_mode,
    lat: toOptNumber(row.lat),
    lng: toOptNumber(row.lng),
    speedKmh: toOptNumber(row.speed_kmh),
    batteryPct: toOptNumber(row.battery_pct),
    baseline: { hrBpm: 72, rmssdMs: 42, sdnnMs: 52, spo2Pct: 98 },
    isSimulated: false,
  }));
}

interface RawAlarmRow {
  id: number | string;
  vehicle_id: string;
  driver_name: string;
  severity: 'WASPADA' | 'KRITIS';
  trigger_reason: string;
  fatigue_index: string | number | null;
  spo2_pct: string | number | null;
  haptic_mode: HapticMode;
  lat: string | number | null;
  lng: string | number | null;
  qos: number;
  acknowledged: number | boolean;
  acknowledged_by?: string | null;
  acknowledge_note?: string | null;
  acknowledged_at?: string | null;
  triggered_at: string;
}

export async function fetchApiAlarms(baseUrl: string): Promise<AlarmEvent[]> {
  const base = cleanBaseUrl(baseUrl);
  const data = await fetchJsonWithTimeout<{ ok: boolean; alarms?: RawAlarmRow[] }>(
    `${base}/alarms.php`
  );

  return (data.alarms ?? []).map((row) => ({
    id: String(row.id),
    vehicleId: row.vehicle_id,
    driverName: row.driver_name,
    severity: row.severity,
    triggerReason: row.trigger_reason,
    fatigueIndex: toOptNumber(row.fatigue_index),
    spo2Pct: toOptNumber(row.spo2_pct),
    hapticMode: row.haptic_mode,
    lat: toOptNumber(row.lat),
    lng: toOptNumber(row.lng),
    qos: Number(row.qos ?? 1),
    acknowledged: Boolean(Number(row.acknowledged)),
    acknowledgedBy: row.acknowledged_by ?? undefined,
    acknowledgeNote: row.acknowledge_note ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    triggeredAt: row.triggered_at.includes('T')
      ? row.triggered_at
      : `${row.triggered_at.replace(' ', 'T')}Z`,
    isSimulated: false,
  }));
}

export async function acknowledgeApiAlarm(
  baseUrl: string,
  alarmId: string,
  operatorName: string,
  note: string
): Promise<void> {
  const base = cleanBaseUrl(baseUrl);
  await fetchJsonWithTimeout(`${base}/alarms.php`, {
    method: 'POST',
    body: JSON.stringify({
      id: Number(alarmId),
      acknowledged_by: operatorName,
      acknowledge_note: note,
    }),
  });
}
