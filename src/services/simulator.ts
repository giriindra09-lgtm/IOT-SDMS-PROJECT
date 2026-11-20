import type {
  AlarmEvent,
  DriverBaseline,
  FatigueStatus,
  HapticMode,
  TelemetryPacket,
} from '../types/telemetry';

export type SimulationTargetState = 'NORMAL' | 'WASPADA' | 'KRITIS' | 'DATA_TIDAK_VALID';

interface SimVehicleConfig {
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  deviceId: string;
  route: [number, number][];
  baseline: DriverBaseline;
  initialPhase: number;
}

interface SimVehicleRuntime {
  config: SimVehicleConfig;
  step: number;
  fatigueIndex: number;
  spo2Pct: number;
  sqiPct: number;
  imuRmsG: number;
  batteryPct: number;
  forcedTarget: SimulationTargetState | null;
  lastStatus: FatigueStatus;
}

const SIM_CONFIGS: SimVehicleConfig[] = [
  {
    vehicleId: 'SIM-01',
    plateNumber: 'H 9104 SD (Simulasi)',
    driverName: 'Unit Simulasi A',
    deviceId: 'ESP32C3-SIM-01',
    route: [
      [-7.0521, 110.4354], // Sekitar kampus Tembalang
      [-7.0642, 110.4228],
      [-7.0815, 110.4139],
      [-7.1038, 110.4092],
      [-7.1294, 110.4055],
      [-7.1526, 110.4081],
    ],
    baseline: { hrBpm: 74, rmssdMs: 41.0, sdnnMs: 53.0, spo2Pct: 98.1 },
    initialPhase: 10,
  },
  {
    vehicleId: 'SIM-02',
    plateNumber: 'H 8421 KL (Simulasi)',
    driverName: 'Unit Simulasi B',
    deviceId: 'ESP32C3-SIM-02',
    route: [
      [-6.9522, 110.4221], // Koridor utara Pelabuhan -> Kendal
      [-6.9614, 110.3912],
      [-6.9698, 110.3595],
      [-6.9765, 110.3268],
      [-6.9652, 110.2961],
    ],
    baseline: { hrBpm: 71, rmssdMs: 44.5, sdnnMs: 56.0, spo2Pct: 97.9 },
    initialPhase: 3,
  },
  {
    vehicleId: 'SIM-03',
    plateNumber: 'K 1739 BM (Simulasi)',
    driverName: 'Unit Simulasi C',
    deviceId: 'ESP32C3-SIM-03',
    route: [
      [-7.0981, 110.4125], // Banyumanik -> Bawen
      [-7.1312, 110.4168],
      [-7.1684, 110.4215],
      [-7.2041, 110.4272],
      [-7.2412, 110.4321],
    ],
    baseline: { hrBpm: 76, rmssdMs: 38.0, sdnnMs: 49.5, spo2Pct: 97.6 },
    initialPhase: 1,
  },
];

const T1 = 0.45;
const T2 = 0.75;
const HYSTERESIS = 0.03;

function interpolateRoute(route: [number, number][], step: number): [number, number] {
  const totalSegments = route.length - 1;
  const cycle = step % (totalSegments * 12);
  const segIdx = Math.floor(cycle / 12);
  const frac = (cycle % 12) / 12;
  const [latA, lngA] = route[segIdx];
  const [latB, lngB] = route[segIdx + 1];
  return [
    Number((latA + (latB - latA) * frac).toFixed(6)),
    Number((lngA + (lngB - lngA) * frac).toFixed(6)),
  ];
}

// Terapkan mesin status pada Gambar 5 proposal: cek SQI dulu, lalu histeresis T1/T2 dan SpO2 < 92%.
function evaluateStateMachine(
  prevStatus: FatigueStatus,
  fatigueIndex: number,
  spo2Pct: number,
  sqiPct: number
): { status: FatigueStatus; hapticMode: HapticMode } {
  if (sqiPct < 50) {
    return { status: 'DATA_TIDAK_VALID', hapticMode: 'MATI' };
  }

  let nextStatus: FatigueStatus = prevStatus === 'DATA_TIDAK_VALID' ? 'NORMAL' : prevStatus;

  if (fatigueIndex >= T2 || spo2Pct < 92) {
    nextStatus = 'KRITIS';
  } else if (prevStatus === 'KRITIS') {
    if (fatigueIndex < T2 - HYSTERESIS && spo2Pct >= 92.5) {
      nextStatus = fatigueIndex >= T1 ? 'WASPADA' : 'NORMAL';
    } else {
      nextStatus = 'KRITIS';
    }
  } else if (fatigueIndex >= T1) {
    nextStatus = 'WASPADA';
  } else if (prevStatus === 'WASPADA') {
    nextStatus = fatigueIndex < T1 - HYSTERESIS ? 'NORMAL' : 'WASPADA';
  } else {
    nextStatus = 'NORMAL';
  }

  const hapticMode: HapticMode =
    nextStatus === 'KRITIS'
      ? 'GETAR_KUAT'
      : nextStatus === 'WASPADA'
        ? 'GETAR_LEMBUT'
        : 'MATI';

  return { status: nextStatus, hapticMode };
}

export class FleetSimulator {
  private runtimes: Map<string, SimVehicleRuntime> = new Map();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.runtimes.clear();
    for (const cfg of SIM_CONFIGS) {
      const initIk = cfg.vehicleId === 'SIM-01' ? 0.52 : cfg.vehicleId === 'SIM-02' ? 0.28 : 0.22;
      const initSpo2 = cfg.vehicleId === 'SIM-01' ? 95.6 : 97.8;
      this.runtimes.set(cfg.vehicleId, {
        config: cfg,
        step: cfg.initialPhase,
        fatigueIndex: initIk,
        spo2Pct: initSpo2,
        sqiPct: 91,
        imuRmsG: 0.09,
        batteryPct: 88,
        forcedTarget: null,
        lastStatus: initIk >= T1 ? 'WASPADA' : 'NORMAL',
      });
    }
  }

  seedInitialState(): {
    packets: TelemetryPacket[];
    historyByVehicle: Record<string, TelemetryPacket[]>;
    alarms: AlarmEvent[];
  } {
    const historyByVehicle: Record<string, TelemetryPacket[]> = {};
    const packets: TelemetryPacket[] = [];
    const alarms: AlarmEvent[] = [];
    const now = Date.now();

    // Bangun 18 titik awal mundur tiap 10 detik untuk mengisi grafik tren simulasi saat mulai.
    for (let i = 17; i >= 0; i--) {
      const ts = new Date(now - i * 10000).toISOString();
      const tickResult = this.stepAll(ts);
      for (const pkt of tickResult.packets) {
        if (!historyByVehicle[pkt.vehicleId]) {
          historyByVehicle[pkt.vehicleId] = [];
        }
        historyByVehicle[pkt.vehicleId].push(pkt);
        if (i === 0) {
          packets.push(pkt);
        }
      }
      alarms.push(...tickResult.alarms);
    }

    return { packets, historyByVehicle, alarms };
  }

  injectScenario(vehicleId: string, target: SimulationTargetState): TelemetryPacket | null {
    const rt = this.runtimes.get(vehicleId);
    if (!rt) return null;
    rt.forcedTarget = target;

    if (target === 'NORMAL') {
      rt.fatigueIndex = 0.26;
      rt.spo2Pct = 97.9;
      rt.sqiPct = 93;
      rt.imuRmsG = 0.08;
    } else if (target === 'WASPADA') {
      rt.fatigueIndex = 0.56;
      rt.spo2Pct = 95.4;
      rt.sqiPct = 87;
      rt.imuRmsG = 0.13;
    } else if (target === 'KRITIS') {
      rt.fatigueIndex = 0.84;
      rt.spo2Pct = 91.2;
      rt.sqiPct = 84;
      rt.imuRmsG = 0.16;
    } else {
      rt.sqiPct = 34;
      rt.imuRmsG = 0.62;
    }

    return this.buildPacket(rt, new Date().toISOString()).packet;
  }

  stepAll(timestampOverride?: string): { packets: TelemetryPacket[]; alarms: AlarmEvent[] } {
    const ts = timestampOverride ?? new Date().toISOString();
    const packets: TelemetryPacket[] = [];
    const alarms: AlarmEvent[] = [];

    for (const rt of this.runtimes.values()) {
      rt.step += 1;
      if (!rt.forcedTarget) {
        if (rt.config.vehicleId === 'SIM-01') {
          const wave = Math.sin(rt.step * 0.25);
          rt.fatigueIndex = Number(Math.max(0.22, Math.min(0.86, 0.54 + wave * 0.28)).toFixed(3));
          rt.spo2Pct = Number((97.2 - rt.fatigueIndex * 6.2).toFixed(1));
          rt.sqiPct = rt.step % 23 === 0 ? 41 : 89;
        } else if (rt.config.vehicleId === 'SIM-02') {
          const wave = Math.sin(rt.step * 0.18 + 1.1);
          rt.fatigueIndex = Number(Math.max(0.18, Math.min(0.62, 0.36 + wave * 0.2)).toFixed(3));
          rt.spo2Pct = Number((98.0 - rt.fatigueIndex * 3.1).toFixed(1));
          rt.sqiPct = 92;
        } else {
          const wave = Math.cos(rt.step * 0.15);
          rt.fatigueIndex = Number(Math.max(0.15, Math.min(0.41, 0.25 + wave * 0.1)).toFixed(3));
          rt.spo2Pct = Number((98.2 - rt.fatigueIndex * 2.0).toFixed(1));
          rt.sqiPct = 94;
        }
        rt.imuRmsG = Number((0.07 + (rt.step % 5) * 0.025).toFixed(3));
      } else {
        // Setelah beberapa langkah di mode injeksi manual, lepas kunci otomatis agar nilai tetap natural.
        rt.imuRmsG = rt.forcedTarget === 'DATA_TIDAK_VALID' ? 0.58 : Number((0.09 + (rt.step % 3) * 0.02).toFixed(3));
      }

      if (rt.step % 15 === 0) {
        rt.batteryPct = Math.max(20, rt.batteryPct - 1);
      }

      const { packet, alarm } = this.buildPacket(rt, ts);
      packets.push(packet);
      if (alarm) alarms.push(alarm);
    }

    return { packets, alarms };
  }

  private buildPacket(
    rt: SimVehicleRuntime,
    ts: string
  ): { packet: TelemetryPacket; alarm: AlarmEvent | null } {
    const prevStatus = rt.lastStatus;
    const { status, hapticMode } = evaluateStateMachine(
      prevStatus,
      rt.fatigueIndex,
      rt.spo2Pct,
      rt.sqiPct
    );
    rt.lastStatus = status;

    const [lat, lng] = interpolateRoute(rt.config.route, rt.step);
    const base = rt.config.baseline;
    const isInvalid = status === 'DATA_TIDAK_VALID';

    const hrBpm = isInvalid
      ? null
      : Number((base.hrBpm - rt.fatigueIndex * 10 + Math.sin(rt.step * 0.4) * 1.4).toFixed(1));
    const rmssdMs = isInvalid
      ? null
      : Number((base.rmssdMs + rt.fatigueIndex * 17 + Math.cos(rt.step * 0.3) * 1.5).toFixed(1));
    const sdnnMs = isInvalid
      ? null
      : Number((base.sdnnMs + rt.fatigueIndex * 14).toFixed(1));
    const lfHfRatio = isInvalid
      ? null
      : Number(Math.max(0.45, 2.05 - rt.fatigueIndex * 1.1).toFixed(2));
    const spo2Pct = isInvalid ? null : rt.spo2Pct;

    const packet: TelemetryPacket = {
      vehicleId: rt.config.vehicleId,
      plateNumber: rt.config.plateNumber,
      driverName: rt.config.driverName,
      deviceId: rt.config.deviceId,
      timestamp: ts,
      status,
      fatigueIndex: rt.fatigueIndex,
      t1: T1,
      t2: T2,
      hrBpm,
      rmssdMs,
      sdnnMs,
      lfHfRatio,
      spo2Pct,
      sqiPct: rt.sqiPct,
      imuRmsG: rt.imuRmsG,
      hapticMode,
      lat,
      lng,
      speedKmh: Number((58 - rt.fatigueIndex * 14 + (rt.step % 4)).toFixed(1)),
      batteryPct: rt.batteryPct,
      baseline: base,
      isSimulated: true,
    };

    let alarm: AlarmEvent | null = null;
    if (status === 'KRITIS' && prevStatus !== 'KRITIS') {
      const reason =
        rt.spo2Pct < 92
          ? `SpO2 turun ke ${rt.spo2Pct.toFixed(1)}% (< 92%) dan IK ${rt.fatigueIndex.toFixed(2)}`
          : `Indeks Kelelahan ${rt.fatigueIndex.toFixed(2)} melewati ambang T2 (0.75)`;

      alarm = {
        id: `sim-${rt.config.vehicleId}-${Date.now()}-${rt.step}`,
        vehicleId: rt.config.vehicleId,
        driverName: rt.config.driverName,
        severity: 'KRITIS',
        triggerReason: reason,
        fatigueIndex: rt.fatigueIndex,
        spo2Pct: rt.spo2Pct,
        hapticMode: 'GETAR_KUAT',
        lat,
        lng,
        qos: 1,
        acknowledged: false,
        triggeredAt: ts,
        isSimulated: true,
      };
    }

    return { packet, alarm };
  }
}
