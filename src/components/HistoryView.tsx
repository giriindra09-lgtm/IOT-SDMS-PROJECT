import { useEffect, useState } from 'react';
import { fetchApiHistory } from '../services/apiClient';
import type { TelemetryPacket } from '../types/telemetry';
import { StatusBadge } from './StatusBadge';

interface HistoryViewProps {
  apiBaseUrl: string;
  vehicles: TelemetryPacket[];
  selectedVehicleId: string | null;
  historyByVehicle: Record<string, TelemetryPacket[]>;
}

type HistorySource = 'session' | 'mysql';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeCsvCell(value: string | number | null): string {
  const str = value === null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function HistoryView({
  apiBaseUrl,
  vehicles,
  selectedVehicleId,
  historyByVehicle,
}: HistoryViewProps) {
  const availableIds = Array.from(
    new Set([...vehicles.map((v) => v.vehicleId), ...Object.keys(historyByVehicle)])
  );

  const [vehicleFilter, setVehicleFilter] = useState<string>(
    selectedVehicleId ?? availableIds[0] ?? ''
  );
  const [source, setSource] = useState<HistorySource>('session');
  const [mysqlRecords, setMysqlRecords] = useState<TelemetryPacket[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleFilter && availableIds.length > 0) {
      setVehicleFilter(selectedVehicleId ?? availableIds[0]);
    }
  }, [availableIds, selectedVehicleId, vehicleFilter]);

  const loadFromMysql = async (targetVehicle: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const rows = await fetchApiHistory(apiBaseUrl, targetVehicle, 120);
      setMysqlRecords(rows);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat dari API MySQL.');
      setMysqlRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (source === 'mysql') {
      void loadFromMysql(vehicleFilter);
    } else {
      setErrorMsg(null);
      setLoading(false);
    }
  }, [source, vehicleFilter, apiBaseUrl]);

  const sessionRecords = vehicleFilter
    ? historyByVehicle[vehicleFilter] ?? []
    : Object.values(historyByVehicle).flat();

  const displayedRecords =
    source === 'mysql' ? [...mysqlRecords].reverse() : [...sessionRecords].reverse();

  const handleDownloadCsv = () => {
    if (displayedRecords.length === 0) return;
    const headers = [
      'timestamp',
      'vehicle_id',
      'status',
      'fatigue_index',
      'spo2_pct',
      'hr_bpm',
      'rmssd_ms',
      'sdnn_ms',
      'lf_hf_ratio',
      'sqi_pct',
      'haptic_mode',
      'lat',
      'lng',
      'speed_kmh',
    ];
    const lines = [headers.join(',')];
    for (const row of displayedRecords) {
      lines.push(
        [
          row.timestamp,
          row.vehicleId,
          row.status,
          row.fatigueIndex.toFixed(3),
          row.spo2Pct,
          row.hrBpm,
          row.rmssdMs,
          row.sdnnMs,
          row.lfHfRatio,
          row.sqiPct,
          row.hapticMode,
          row.lat,
          row.lng,
          row.speedKmh,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sdms-riwayat-${vehicleFilter || 'armada'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="history-heading" className="focus-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h1 id="history-heading" className="page-h1">
              Riwayat Telemetri dan Sinyal Fisiologis
            </h1>
            <p className="muted-text" style={{ margin: '0.25rem 0 0' }}>
              Tinjau deret waktu Indeks Kelelahan, HRV, SpO2, dan kualitas sinyal SQI.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            disabled={displayedRecords.length === 0}
            onClick={handleDownloadCsv}
          >
            Unduh CSV ({displayedRecords.length})
          </button>
        </div>

        <div className="form-grid" style={{ alignItems: 'end' }}>
          <div className="field">
            <label htmlFor="history-vehicle-select">Kendaraan</label>
            <select
              id="history-vehicle-select"
              className="select"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            >
              <option value="">Semua Kendaraan</option>
              {availableIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="history-source-select">Sumber Data Riwayat</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                id="history-source-select"
                className="select"
                value={source}
                onChange={(e) => setSource(e.target.value as HistorySource)}
              >
                <option value="session">Buffer Sesi (Live MQTT / Simulasi)</option>
                <option value="mysql">Database MySQL cPanel ({apiBaseUrl})</option>
              </select>
              {source === 'mysql' && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void loadFromMysql(vehicleFilter)}
                >
                  Muat Ulang
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="state-box" role="status" aria-live="polite">
          <strong>Memuat riwayat telemetri dari MySQL cPanel...</strong>
          <p className="muted-text" style={{ margin: 0 }}>
            Menghubungi endpoint {apiBaseUrl}/history.php.
          </p>
        </div>
      )}

      {!loading && errorMsg && (
        <div className="state-box" data-kind="error" role="alert">
          <strong>Gagal memuat data dari MySQL cPanel</strong>
          <p style={{ margin: 0 }}>{errorMsg}</p>
          <div className="state-box-actions">
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => void loadFromMysql(vehicleFilter)}
            >
              Coba Lagi
            </button>
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => {
                setErrorMsg(null);
                setLoading(false);
                setSource('session');
              }}
            >
              Kembali ke Buffer Sesi
            </button>
          </div>
        </div>
      )}

      {!loading && !errorMsg && displayedRecords.length === 0 && (
        <div className="state-box">
          <strong>Belum ada riwayat telemetri pada sumber ini</strong>
          <p className="muted-text" style={{ margin: 0 }}>
            {source === 'mysql'
              ? 'Tabel telemetry_logs di MySQL belum menerima paket, atau webhook EMQX Cloud belum diaktifkan.'
              : 'Hubungkan broker EMQX Cloud atau aktifkan Mode Simulasi untuk merekam paket sesi.'}
          </p>
        </div>
      )}

      {!loading && !errorMsg && displayedRecords.length > 0 && (
        <div className="panel">
          <table className="history-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Unit</th>
                <th>Status</th>
                <th>IK</th>
                <th>SpO2</th>
                <th>HR</th>
                <th>RMSSD</th>
                <th>SQI</th>
                <th>Haptik</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecords.slice(0, 80).map((row, idx) => (
                <tr key={`${row.vehicleId}-${row.timestamp}-${idx}`}>
                  <td data-label="Waktu" className="mono">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td data-label="Unit" className="mono">
                    {row.vehicleId}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={row.status} />
                  </td>
                  <td data-label="IK" className="mono">
                    {row.fatigueIndex.toFixed(2)}
                  </td>
                  <td data-label="SpO2" className="mono">
                    {row.spo2Pct !== null ? `${row.spo2Pct.toFixed(1)}%` : '--'}
                  </td>
                  <td data-label="HR" className="mono">
                    {row.hrBpm !== null ? `${row.hrBpm.toFixed(1)}` : '--'}
                  </td>
                  <td data-label="RMSSD" className="mono">
                    {row.rmssdMs !== null ? `${row.rmssdMs.toFixed(1)} ms` : '--'}
                  </td>
                  <td data-label="SQI" className="mono">
                    {row.sqiPct}%
                  </td>
                  <td data-label="Haptik">{row.hapticMode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
