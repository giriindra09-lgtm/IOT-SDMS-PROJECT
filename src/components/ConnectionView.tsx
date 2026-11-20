import { useState } from 'react';
import { checkApiHealth } from '../services/apiClient';
import type {
  ApiHealthResponse,
  MqttConnectionConfig,
  MqttConnectionStatus,
  RawMqttMessageLog,
} from '../types/telemetry';

interface ConnectionViewProps {
  mqttConfig: MqttConnectionConfig;
  mqttStatus: MqttConnectionStatus;
  mqttError: string | null;
  onConnectMqtt: (config: MqttConnectionConfig) => void;
  onDisconnectMqtt: () => void;
  apiBaseUrl: string;
  onUpdateApiBaseUrl: (url: string) => void;
  rawLogs: RawMqttMessageLog[];
  onClearLogs: () => void;
}

const PAYLOAD_CONTRACT_SAMPLE = `{
  "vehicle_id": "TRK-01",
  "plate_number": "H 9104 SD",
  "driver_name": "Budi Santoso",
  "device_id": "ESP32C3-01",
  "timestamp": "2026-11-20T12:30:00Z",
  "status": "WASPADA",
  "fatigue_index": 0.54,
  "t1": 0.45,
  "t2": 0.75,
  "hr_bpm": 68.4,
  "rmssd_ms": 51.2,
  "sdnn_ms": 62.0,
  "lf_hf_ratio": 1.32,
  "spo2_pct": 95.8,
  "sqi_pct": 91,
  "imu_rms_g": 0.11,
  "haptic_mode": "GETAR_LEMBUT",
  "lat": -7.05182,
  "lng": 110.43574,
  "speed_kmh": 58.5,
  "battery_pct": 84
}`;

export function ConnectionView({
  mqttConfig,
  mqttStatus,
  mqttError,
  onConnectMqtt,
  onDisconnectMqtt,
  apiBaseUrl,
  onUpdateApiBaseUrl,
  rawLogs,
  onClearLogs,
}: ConnectionViewProps) {
  const [url, setUrl] = useState(mqttConfig.url);
  const [username, setUsername] = useState(mqttConfig.username);
  const [password, setPassword] = useState(mqttConfig.password);
  const [topicPrefix, setTopicPrefix] = useState(mqttConfig.topicPrefix);
  const [mqttFormError, setMqttFormError] = useState<string | null>(null);

  const [apiInput, setApiInput] = useState(apiBaseUrl);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<ApiHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  const handleSubmitMqtt = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl || (!cleanUrl.startsWith('wss://') && !cleanUrl.startsWith('ws://'))) {
      setMqttFormError(
        'Masukkan URL WebSocket broker yang valid, diawali wss:// (contoh wss://xxxx.emqxsl.com:8084/mqtt).'
      );
      return;
    }

    setMqttFormError(null);
    onConnectMqtt({
      url: cleanUrl,
      username: username.trim(),
      password,
      topicPrefix: topicPrefix.trim() || 'sdms',
    });
  };

  const handleTestApi = async () => {
    const cleanApi = apiInput.trim() || '/api';
    onUpdateApiBaseUrl(cleanApi);
    setHealthLoading(true);
    setHealthError(null);
    setHealthResult(null);

    try {
      const res = await checkApiHealth(cleanApi);
      setHealthResult(res);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Gagal terhubung ke endpoint PHP API.');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(PAYLOAD_CONTRACT_SAMPLE);
      setCopiedContract(true);
      window.setTimeout(() => setCopiedContract(false), 2500);
    } catch {
      setCopiedContract(false);
    }
  };

  return (
    <section aria-labelledby="connection-heading" className="focus-stack">
      <div className="panel">
        <h1 id="connection-heading" className="page-h1">
          Koneksi Broker EMQX Cloud dan API cPanel
        </h1>
        <p className="muted-text" style={{ margin: '0.25rem 0 0' }}>
          Hubungkan frontend ke EMQX Cloud melalui WebSocket Secure (WSS) dan verifikasi endpoint
          PHP + MySQL di server cPanel.
        </p>
      </div>

      <div className="telemetry-pair">
        <section className="panel" aria-labelledby="mqtt-form-heading">
          <div className="panel-header">
            <h2 id="mqtt-form-heading" className="panel-title">
              1. Broker EMQX Cloud (MQTT over WSS)
            </h2>
            <span className="meta-chip mono">Status: {mqttStatus}</span>
          </div>

          <form onSubmit={handleSubmitMqtt} noValidate className="focus-stack" style={{ gap: '0.85rem' }}>
            <div className="field">
              <label htmlFor="mqtt-url">URL Broker WSS</label>
              <input
                id="mqtt-url"
                type="url"
                className="input mono"
                placeholder="wss://namadeploy.ala.asia-southeast1.emqxsl.com:8084/mqtt"
                value={url}
                aria-invalid={mqttFormError ? 'true' : undefined}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (mqttFormError) setMqttFormError(null);
                }}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="mqtt-user">Username MQTT</label>
                <input
                  id="mqtt-user"
                  type="text"
                  className="input mono"
                  placeholder="sdms-dashboard"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="mqtt-pass">Password MQTT</label>
                <input
                  id="mqtt-pass"
                  type="password"
                  className="input"
                  placeholder="Password klien dasbor"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="mqtt-prefix">Prefix Topik MQTT</label>
              <input
                id="mqtt-prefix"
                type="text"
                className="input mono"
                placeholder="sdms"
                value={topicPrefix}
                onChange={(e) => setTopicPrefix(e.target.value)}
              />
            </div>

            {mqttFormError && (
              <p className="field-error" role="alert">
                {mqttFormError}
              </p>
            )}

            {mqttError && (
              <div className="state-box" data-kind="error" role="alert" style={{ padding: '0.85rem' }}>
                <strong>Galat koneksi EMQX:</strong> {mqttError}
              </div>
            )}

            <div className="state-box-actions">
              <button type="submit" className="btn btn-primary">
                {mqttStatus === 'connected' ? 'Hubungkan Ulang' : 'Hubungkan ke EMQX'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={mqttStatus === 'disconnected'}
                onClick={onDisconnectMqtt}
              >
                Putuskan
              </button>
            </div>
          </form>
        </section>

        <section className="panel" aria-labelledby="api-test-heading">
          <div className="panel-header">
            <h2 id="api-test-heading" className="panel-title">
              2. Backend PHP + MySQL cPanel
            </h2>
          </div>

          <div className="focus-stack" style={{ gap: '0.85rem' }}>
            <div className="field">
              <label htmlFor="api-base-input">Base URL Endpoint PHP API</label>
              <input
                id="api-base-input"
                type="text"
                className="input mono"
                placeholder="/api"
                value={apiInput}
                onChange={(e) => setApiInput(e.target.value)}
              />
            </div>

            <div className="state-box-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={healthLoading}
                onClick={() => void handleTestApi()}
              >
                {healthLoading ? 'Menguji API...' : 'Uji Koneksi API (/health.php)'}
              </button>
            </div>

            {healthResult && (
              <div className="state-box" style={{ padding: '0.9rem' }} role="status">
                <strong>{healthResult.message}</strong>
                <div className="mono muted-text">
                  PHP {healthResult.php_version} | Tabel:{' '}
                  {healthResult.tables
                    ? Object.entries(healthResult.tables)
                        .map(([name, ok]) => `${name}=${ok ? 'OK' : 'BELUM'}`)
                        .join(', ')
                    : '-'}
                </div>
              </div>
            )}

            {healthError && (
              <div className="state-box" data-kind="error" role="alert" style={{ padding: '0.9rem' }}>
                <strong>Endpoint API belum siap di lingkungan ini</strong>
                <p style={{ margin: 0 }}>{healthError}</p>
                <p className="muted-text" style={{ margin: 0 }}>
                  Saat dijalankan di server cPanel, pastikan database MySQL sudah diimpor dari
                  database/schema.sql dan api/config.local.php sudah terisi.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="inspector-heading">
        <div className="panel-header">
          <h2 id="inspector-heading" className="panel-title">
            Inspektor Paket MQTT Masuk ({rawLogs.length})
          </h2>
          <button
            type="button"
            className="btn btn-compact"
            disabled={rawLogs.length === 0}
            onClick={onClearLogs}
          >
            Bersihkan Log
          </button>
        </div>

        {rawLogs.length === 0 ? (
          <div className="state-box" style={{ padding: '1rem' }}>
            <p className="muted-text" style={{ margin: 0 }}>
              Belum ada pesan masuk dari topik{' '}
              <span className="mono">{topicPrefix || 'sdms'}/+/telemetry</span> atau{' '}
              <span className="mono">{topicPrefix || 'sdms'}/+/alarm</span>.
            </p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Topik</th>
                <th>QoS</th>
                <th>Validasi</th>
                <th>Cuplikan Payload</th>
              </tr>
            </thead>
            <tbody>
              {rawLogs.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Waktu" className="mono">
                    {new Date(entry.receivedAt).toLocaleTimeString('id-ID')}
                  </td>
                  <td data-label="Topik" className="mono">
                    {entry.topic}
                  </td>
                  <td data-label="QoS" className="mono">
                    QoS {entry.qos}
                  </td>
                  <td data-label="Validasi">{entry.valid ? 'Valid' : 'Format Ditolak'}</td>
                  <td data-label="Cuplikan Payload" className="mono">
                    {entry.payloadPreview}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel" aria-labelledby="contract-heading">
        <div className="panel-header">
          <div>
            <h2 id="contract-heading" className="panel-title">
              Kontrak Payload JSON Gateway (ESP32-WROOM + A7672S)
            </h2>
            <p className="muted-text" style={{ margin: '0.2rem 0 0' }}>
              Publish ke <span className="mono">sdms/{'{vehicle_id}'}/telemetry</span> (QoS 0) dan{' '}
              <span className="mono">sdms/{'{vehicle_id}'}/alarm</span> (QoS 1).
            </p>
          </div>
          <button type="button" className="btn btn-compact" onClick={() => void handleCopyContract()}>
            {copiedContract ? 'Tersalin' : 'Salin Kontrak JSON'}
          </button>
        </div>
        <pre className="code-block">{PAYLOAD_CONTRACT_SAMPLE}</pre>
      </section>
    </section>
  );
}
