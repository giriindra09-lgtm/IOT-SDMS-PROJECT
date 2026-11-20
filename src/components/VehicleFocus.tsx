import type { OperatingMode, TelemetryPacket } from '../types/telemetry';
import type { SimulationTargetState } from '../services/simulator';
import { FleetMap } from './FleetMap';
import { formatHapticLabel, StatusBadge } from './StatusBadge';
import { TelemetryChart } from './TelemetryChart';

interface VehicleFocusProps {
  packet: TelemetryPacket;
  history: TelemetryPacket[];
  operatingMode: OperatingMode;
  simPaused: boolean;
  onToggleSimPause: () => void;
  onInjectSimScenario: (vehicleId: string, state: SimulationTargetState) => void;
}

function formatDelta(current: number | null, base: number, unit: string): string {
  if (current === null) return `Baseline ${base.toFixed(1)} ${unit}`;
  const diff = current - base;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)} ${unit} vs baseline (${base.toFixed(1)})`;
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function VehicleFocus({
  packet,
  history,
  operatingMode,
  simPaused,
  onToggleSimPause,
  onInjectSimScenario,
}: VehicleFocusProps) {
  const trail: [number, number][] = history
    .filter((item) => item.lat !== null && item.lng !== null)
    .map((item) => [item.lat as number, item.lng as number]);

  const ikPct = Math.max(0, Math.min(100, packet.fatigueIndex * 100));
  const t1Pct = Math.round(packet.t1 * 100);
  const t2Pct = Math.round(packet.t2 * 100);

  return (
    <div className="focus-stack">
      <section className="panel focus-header-card" aria-label="Ringkasan pengemudi terpilih">
        <div className="focus-title-row">
          <div className="focus-identity">
            <h2 className="panel-title" style={{ fontSize: '1.15rem' }}>
              <span className="mono">{packet.vehicleId}</span> ({packet.driverName})
            </h2>
            {packet.isSimulated && <span className="sim-tag">SIMULASI</span>}
            <StatusBadge status={packet.status} />
          </div>

          <span className="muted-text mono">
            Pembaruan {formatUpdatedAt(packet.timestamp)}
          </span>
        </div>

        <div className="focus-status-strip">
          <span className="meta-chip">
            Pelat: <strong className="mono">{packet.plateNumber}</strong>
          </span>
          <span className="meta-chip">
            Haptik: <strong>{formatHapticLabel(packet.hapticMode)}</strong>
          </span>
          <span className="meta-chip">
            SQI: <strong className="mono">{packet.sqiPct}%</strong>
          </span>
          <span className="meta-chip">
            Baterai Gelang:{' '}
            <strong className="mono">
              {packet.batteryPct !== null ? `${packet.batteryPct}%` : '--'}
            </strong>
          </span>
          <span className="meta-chip">
            Perangkat: <strong className="mono">{packet.deviceId}</strong>
          </span>
        </div>

        {operatingMode === 'simulation' && (
          <div className="sim-toolbar" aria-label="Kontrol skenario simulasi">
            <span className="muted-text">
              Uji mesin status Gambar 5 pada unit <strong className="mono">{packet.vehicleId}</strong>:
            </span>
            <div className="sim-toolbar-actions">
              <button type="button" className="btn btn-compact" onClick={onToggleSimPause}>
                {simPaused ? 'Lanjutkan Simulasi' : 'Jeda Simulasi'}
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onInjectSimScenario(packet.vehicleId, 'NORMAL')}
              >
                Picu Normal
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onInjectSimScenario(packet.vehicleId, 'WASPADA')}
              >
                Picu Waspada
              </button>
              <button
                type="button"
                className="btn btn-compact btn-danger"
                onClick={() => onInjectSimScenario(packet.vehicleId, 'KRITIS')}
              >
                Picu Kritis
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onInjectSimScenario(packet.vehicleId, 'DATA_TIDAK_VALID')}
              >
                Picu SQI Rendah
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="telemetry-pair">
        <FleetMap
          vehicleId={packet.vehicleId}
          driverName={packet.driverName}
          status={packet.status}
          lat={packet.lat}
          lng={packet.lng}
          speedKmh={packet.speedKmh}
          trail={trail}
        />

        <section className="panel" aria-label="Pembacaan instrumen fisiologis">
          <div className="panel-header">
            <h3 className="panel-title">Instrumen Fisiologis Gelang</h3>
            <span className="muted-text">Jendela HRV 120 dtk</span>
          </div>

          <div className="ik-callout">
            <div className="ik-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Indeks Kelelahan (IK)</div>
                <div className="muted-text">
                  Normal &lt; {packet.t1.toFixed(2)}, Waspada &ge; {packet.t1.toFixed(2)}, Kritis &ge;{' '}
                  {packet.t2.toFixed(2)}
                </div>
              </div>
              <div className="ik-value">{packet.fatigueIndex.toFixed(2)}</div>
            </div>

            <div
              className="ik-scale-wrap"
              role="img"
              aria-label={`Skala Indeks Kelelahan ${packet.fatigueIndex.toFixed(2)} dari 1.00`}
            >
              <div className="ik-track">
                <div className="ik-zone-normal" />
                <div className="ik-zone-waspada" />
                <div className="ik-zone-kritis" />
              </div>
              <div className="ik-tick" style={{ left: `${t1Pct}%` }} title={`T1 = ${packet.t1}`} />
              <div className="ik-tick" style={{ left: `${t2Pct}%` }} title={`T2 = ${packet.t2}`} />
              <div className="ik-marker" style={{ left: `${ikPct}%` }} />
            </div>

            <div className="ik-scale-labels">
              <span>0.00</span>
              <span>T1 ({packet.t1.toFixed(2)})</span>
              <span>T2 ({packet.t2.toFixed(2)})</span>
              <span>1.00</span>
            </div>
          </div>

          <div className="instrument-list">
            <div className="instrument-row">
              <div className="instrument-label">
                <span className="instrument-name">Saturasi Oksigen (SpO2)</span>
                <span className="instrument-note">Ambang kritis di bawah 92.0%</span>
              </div>
              <div className="instrument-reading">
                <span
                  className={`instrument-val ${
                    packet.spo2Pct !== null && packet.spo2Pct < 92 ? 'instrument-flag' : ''
                  }`}
                >
                  {packet.spo2Pct !== null ? `${packet.spo2Pct.toFixed(1)}%` : 'Tidak valid'}
                </span>
                <span className="instrument-delta">
                  {formatDelta(packet.spo2Pct, packet.baseline.spo2Pct, '%')}
                </span>
              </div>
            </div>

            <div className="instrument-row">
              <div className="instrument-label">
                <span className="instrument-name">Detak Jantung (HR)</span>
                <span className="instrument-note">PPG MAX30102 setelah filter NLMS</span>
              </div>
              <div className="instrument-reading">
                <span className="instrument-val">
                  {packet.hrBpm !== null ? `${packet.hrBpm.toFixed(1)} bpm` : 'Tidak valid'}
                </span>
                <span className="instrument-delta">
                  {formatDelta(packet.hrBpm, packet.baseline.hrBpm, 'bpm')}
                </span>
              </div>
            </div>

            <div className="instrument-row">
              <div className="instrument-label">
                <span className="instrument-name">HRV RMSSD / SDNN</span>
                <span className="instrument-note">Domain waktu IBI per geser 10 detik</span>
              </div>
              <div className="instrument-reading">
                <span className="instrument-val">
                  {packet.rmssdMs !== null && packet.sdnnMs !== null
                    ? `${packet.rmssdMs.toFixed(1)} / ${packet.sdnnMs.toFixed(1)} ms`
                    : 'Tidak valid'}
                </span>
                <span className="instrument-delta">
                  {formatDelta(packet.rmssdMs, packet.baseline.rmssdMs, 'ms')}
                </span>
              </div>
            </div>

            <div className="instrument-row">
              <div className="instrument-label">
                <span className="instrument-name">Rasio LF / HF</span>
                <span className="instrument-note">Keseimbangan simpatis-parasimpatis</span>
              </div>
              <div className="instrument-reading">
                <span className="instrument-val">
                  {packet.lfHfRatio !== null ? packet.lfHfRatio.toFixed(2) : 'Tidak valid'}
                </span>
                <span className="instrument-delta">0.04-0.15 / 0.15-0.40 Hz</span>
              </div>
            </div>

            <div className="instrument-row">
              <div className="instrument-label">
                <span className="instrument-name">Kualitas Sinyal (SQI) &amp; IMU</span>
                <span className="instrument-note">Referensi akselerometer MPU6050</span>
              </div>
              <div className="instrument-reading">
                <span
                  className={`instrument-val ${packet.sqiPct < 50 ? 'instrument-flag' : ''}`}
                >
                  SQI {packet.sqiPct}%
                </span>
                <span className="instrument-delta">
                  IMU RMS {packet.imuRmsG !== null ? `${packet.imuRmsG.toFixed(3)} g` : '--'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <TelemetryChart records={history} vehicleId={packet.vehicleId} />
    </div>
  );
}
