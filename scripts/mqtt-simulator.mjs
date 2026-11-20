import fs from 'node:fs';
import path from 'node:path';
import mqtt from 'mqtt';

// Baca .env lokal secara ringkas tanpa menambah dependency dotenv.
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadLocalEnv();

const brokerUrl = process.env.MQTT_URL || process.env.VITE_MQTT_URL;
const username = process.env.MQTT_USERNAME || process.env.VITE_MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD || process.env.VITE_MQTT_PASSWORD;
const prefix = process.env.MQTT_TOPIC_PREFIX || process.env.VITE_MQTT_TOPIC_PREFIX || 'sdms';
const vehicleId = process.env.SIM_VEHICLE_ID || 'SIM-01';

if (!brokerUrl) {
  console.error('MQTT_URL belum diatur. Salin .env.example menjadi .env lalu isi kredensial EMQX Cloud.');
  process.exit(1);
}

console.log(`Menghubungkan simulator CLI ke ${brokerUrl} (vehicle ${vehicleId})...`);

const client = mqtt.connect(brokerUrl, {
  username: username || undefined,
  password: password || undefined,
  clean: true,
  reconnectPeriod: 4000,
});

let tick = 0;

client.on('connect', () => {
  console.log('Terhubung ke broker EMQX. Mengirim paket tiap 5 detik (Ctrl+C untuk berhenti).');
  publishSample();
  setInterval(publishSample, 5000);
});

client.on('error', (err) => {
  console.error('Koneksi MQTT bermasalah:', err.message);
});

function publishSample() {
  tick += 1;
  // Siklus naik-turun untuk menguji status NORMAL, WASPADA, dan KRITIS secara otomatis.
  const phase = tick % 18;
  const fatigueIndex =
    phase < 6
      ? Number((0.24 + phase * 0.03).toFixed(3))
      : phase < 12
        ? Number((0.46 + (phase - 6) * 0.045).toFixed(3))
        : Number((0.77 + (phase - 12) * 0.025).toFixed(3));

  const spo2Pct = phase >= 14 ? 91.4 : Number((97.2 - fatigueIndex * 2.1).toFixed(1));
  const sqiPct = phase === 17 ? 38 : 88;

  let status = 'NORMAL';
  let hapticMode = 'MATI';
  if (sqiPct < 50) {
    status = 'DATA_TIDAK_VALID';
    hapticMode = 'MATI';
  } else if (fatigueIndex >= 0.75 || spo2Pct < 92) {
    status = 'KRITIS';
    hapticMode = 'GETAR_KUAT';
  } else if (fatigueIndex >= 0.45) {
    status = 'WASPADA';
    hapticMode = 'GETAR_LEMBUT';
  }

  const payload = {
    vehicle_id: vehicleId,
    plate_number: 'H 9104 SD',
    driver_name: 'Simulator CLI',
    device_id: 'ESP32C3-CLI-01',
    timestamp: new Date().toISOString(),
    status,
    fatigue_index: fatigueIndex,
    t1: 0.45,
    t2: 0.75,
    hr_bpm: Number((76 - fatigueIndex * 11).toFixed(1)),
    rmssd_ms: Number((42 + fatigueIndex * 18).toFixed(1)),
    sdnn_ms: Number((54 + fatigueIndex * 14).toFixed(1)),
    lf_hf_ratio: Number((1.95 - fatigueIndex * 0.9).toFixed(2)),
    spo2_pct: spo2Pct,
    sqi_pct: sqiPct,
    imu_rms_g: Number((0.08 + (phase % 3) * 0.03).toFixed(3)),
    haptic_mode: hapticMode,
    lat: Number((-7.0518 + tick * 0.0006).toFixed(6)),
    lng: Number((110.4357 + tick * 0.0004).toFixed(6)),
    speed_kmh: Number((64 - fatigueIndex * 12).toFixed(1)),
    battery_pct: Math.max(25, 92 - Math.floor(tick / 3)),
    baseline: {
      hr_bpm: 74,
      rmssd_ms: 40,
      sdnn_ms: 52,
      spo2_pct: 98,
    },
  };

  const telemetryTopic = `${prefix}/${vehicleId}/telemetry`;
  client.publish(telemetryTopic, JSON.stringify(payload), { qos: 0 });
  console.log(`[QoS 0] ${telemetryTopic} -> ${status} (IK=${payload.fatigue_index}, SpO2=${payload.spo2_pct}%)`);

  if (status === 'KRITIS') {
    const alarmTopic = `${prefix}/${vehicleId}/alarm`;
    client.publish(alarmTopic, JSON.stringify({
      ...payload,
      trigger_reason: spo2Pct < 92
        ? `SpO2 ${spo2Pct}% di bawah 92%`
        : `Indeks Kelelahan ${fatigueIndex} >= 0.75`,
    }), { qos: 1 });
    console.log(`[QoS 1 ALARM] ${alarmTopic}`);
  }
}
