import { useState } from 'react';
import type { TelemetryPacket } from '../types/telemetry';

interface TelemetryChartProps {
  records: TelemetryPacket[];
  vehicleId: string;
}

type ChartMode = 'fatigue' | 'hrv';

const WIDTH = 680;
const HEIGHT = 230;
const PAD = { top: 18, right: 44, bottom: 28, left: 44 };

function buildPolylinePoints(
  values: (number | null)[],
  minVal: number,
  maxVal: number
): string {
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const count = Math.max(1, values.length - 1);
  const span = maxVal - minVal || 1;

  const pts: string[] = [];
  values.forEach((v, idx) => {
    if (v === null) return;
    const x = PAD.left + (idx / count) * innerW;
    const clamped = Math.max(minVal, Math.min(maxVal, v));
    const y = PAD.top + (1 - (clamped - minVal) / span) * innerH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(' ');
}

function formatAxisTime(iso: string | undefined): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function TelemetryChart({ records, vehicleId }: TelemetryChartProps) {
  const [mode, setMode] = useState<ChartMode>('fatigue');

  if (records.length < 2) {
    return (
      <section className="panel" aria-label="Grafik tren telemetri">
        <div className="panel-header">
          <h3 className="panel-title">
            Bagaimana tren Indeks Kelelahan dan SpO2 untuk {vehicleId}?
          </h3>
        </div>
        <div className="state-box" style={{ padding: '1.25rem' }}>
          <p className="muted-text" style={{ margin: 0 }}>
            Menunggu minimal 2 paket telemetri berurutan untuk menggambar kurva tren sinyal.
          </p>
        </div>
      </section>
    );
  }

  const slice = records.slice(-36);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const ikPoints = buildPolylinePoints(
    slice.map((r) => r.fatigueIndex),
    0,
    1
  );
  const spo2Points = buildPolylinePoints(
    slice.map((r) => r.spo2Pct),
    88,
    100
  );

  const hrValues = slice.map((r) => r.hrBpm).filter((v): v is number => v !== null);
  const rmssdValues = slice.map((r) => r.rmssdMs).filter((v): v is number => v !== null);

  const hrMin = hrValues.length ? Math.floor(Math.min(...hrValues) - 5) : 50;
  const hrMax = hrValues.length ? Math.ceil(Math.max(...hrValues) + 5) : 110;
  const rmssdMin = rmssdValues.length ? Math.floor(Math.min(...rmssdValues) - 5) : 20;
  const rmssdMax = rmssdValues.length ? Math.ceil(Math.max(...rmssdValues) + 5) : 90;

  const hrPoints = buildPolylinePoints(
    slice.map((r) => r.hrBpm),
    hrMin,
    hrMax
  );
  const rmssdPoints = buildPolylinePoints(
    slice.map((r) => r.rmssdMs),
    rmssdMin,
    rmssdMax
  );

  const t1Y = PAD.top + (1 - 0.45) * innerH;
  const t2Y = PAD.top + (1 - 0.75) * innerH;

  const latest = slice[slice.length - 1];
  const peakIk = Math.max(...slice.map((r) => r.fatigueIndex));
  const minSpo2Candidates = slice
    .map((r) => r.spo2Pct)
    .filter((v): v is number => v !== null);
  const minSpo2 = minSpo2Candidates.length ? Math.min(...minSpo2Candidates) : null;

  return (
    <section className="panel" aria-label="Grafik tren sinyal fisiologis">
      <div className="panel-header">
        <h3 className="panel-title">
          {mode === 'fatigue'
            ? `Bagaimana tren Indeks Kelelahan dan SpO2 pada ${vehicleId}?`
            : `Bagaimana perubahan RMSSD HRV dan Detak Jantung pada ${vehicleId}?`}
        </h3>

        <div className="filter-row" role="group" aria-label="Pilih seri grafik">
          <button
            type="button"
            className="filter-btn"
            aria-pressed={mode === 'fatigue'}
            onClick={() => setMode('fatigue')}
          >
            IK &amp; SpO2
          </button>
          <button
            type="button"
            className="filter-btn"
            aria-pressed={mode === 'hrv'}
            onClick={() => setMode('hrv')}
          >
            HRV &amp; HR
          </button>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ display: 'block', width: '100%', height: 'auto' }}
          role="img"
          aria-label={
            mode === 'fatigue'
              ? `Grafik garis Indeks Kelelahan dan SpO2 untuk ${vehicleId}`
              : `Grafik garis RMSSD dan detak jantung untuk ${vehicleId}`
          }
        >
          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--border-control)"
            strokeWidth="1"
          />
          <line
            x1={PAD.left}
            y1={HEIGHT - PAD.bottom}
            x2={WIDTH - PAD.right}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--border-control)"
            strokeWidth="1"
          />

          {mode === 'fatigue' ? (
            <>
              <line
                x1={PAD.left}
                y1={t1Y}
                x2={WIDTH - PAD.right}
                y2={t1Y}
                stroke="var(--status-waspada-fg)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left + 4}
                y={t1Y - 4}
                fontSize="10"
                fill="var(--status-waspada-fg)"
                fontFamily="var(--font-mono)"
              >
                T1 0.45
              </text>

              <line
                x1={PAD.left}
                y1={t2Y}
                x2={WIDTH - PAD.right}
                y2={t2Y}
                stroke="var(--status-kritis-fg)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD.left + 4}
                y={t2Y - 4}
                fontSize="10"
                fill="var(--status-kritis-fg)"
                fontFamily="var(--font-mono)"
              >
                T2 0.75
              </text>

              <polyline
                fill="none"
                stroke="var(--accent-text)"
                strokeWidth="2.4"
                points={ikPoints}
              />
              <polyline
                fill="none"
                stroke="var(--status-normal-fg)"
                strokeWidth="2"
                strokeDasharray="6 3"
                points={spo2Points}
              />

              <text
                x={PAD.left - 6}
                y={PAD.top + 8}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                fontFamily="var(--font-mono)"
              >
                1.0
              </text>
              <text
                x={PAD.left - 6}
                y={HEIGHT - PAD.bottom}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                fontFamily="var(--font-mono)"
              >
                0.0
              </text>
              <text
                x={WIDTH - PAD.right + 6}
                y={PAD.top + 8}
                fontSize="10"
                fill="var(--status-normal-fg)"
                fontFamily="var(--font-mono)"
              >
                100%
              </text>
              <text
                x={WIDTH - PAD.right + 6}
                y={HEIGHT - PAD.bottom}
                fontSize="10"
                fill="var(--status-normal-fg)"
                fontFamily="var(--font-mono)"
              >
                88%
              </text>
            </>
          ) : (
            <>
              <polyline
                fill="none"
                stroke="var(--accent-text)"
                strokeWidth="2.4"
                points={rmssdPoints}
              />
              <polyline
                fill="none"
                stroke="var(--status-waspada-fg)"
                strokeWidth="2"
                strokeDasharray="5 3"
                points={hrPoints}
              />
              <text
                x={PAD.left - 6}
                y={PAD.top + 8}
                textAnchor="end"
                fontSize="10"
                fill="var(--accent-text)"
                fontFamily="var(--font-mono)"
              >
                {rmssdMax}ms
              </text>
              <text
                x={PAD.left - 6}
                y={HEIGHT - PAD.bottom}
                textAnchor="end"
                fontSize="10"
                fill="var(--accent-text)"
                fontFamily="var(--font-mono)"
              >
                {rmssdMin}ms
              </text>
              <text
                x={WIDTH - PAD.right + 6}
                y={PAD.top + 8}
                fontSize="10"
                fill="var(--status-waspada-fg)"
                fontFamily="var(--font-mono)"
              >
                {hrMax}
              </text>
              <text
                x={WIDTH - PAD.right + 6}
                y={HEIGHT - PAD.bottom}
                fontSize="10"
                fill="var(--status-waspada-fg)"
                fontFamily="var(--font-mono)"
              >
                {hrMin}
              </text>
            </>
          )}

          <text
            x={PAD.left}
            y={HEIGHT - 8}
            fontSize="10"
            fill="var(--ink-muted)"
            fontFamily="var(--font-mono)"
          >
            {formatAxisTime(slice[0]?.timestamp)}
          </text>
          <text
            x={WIDTH - PAD.right}
            y={HEIGHT - 8}
            textAnchor="end"
            fontSize="10"
            fill="var(--ink-muted)"
            fontFamily="var(--font-mono)"
          >
            {formatAxisTime(latest?.timestamp)}
          </text>
        </svg>
      </div>

      <div className="chart-summary-row mono">
        {mode === 'fatigue' ? (
          <>
            <span>Garis penuh: IK terkini {latest.fatigueIndex.toFixed(2)} (puncak {peakIk.toFixed(2)})</span>
            <span>
              Garis putus: SpO2 terkini {latest.spo2Pct !== null ? `${latest.spo2Pct.toFixed(1)}%` : '--'}
              {minSpo2 !== null ? ` (terendah ${minSpo2.toFixed(1)}%)` : ''}
            </span>
          </>
        ) : (
          <>
            <span>
              Garis penuh: RMSSD {latest.rmssdMs !== null ? `${latest.rmssdMs.toFixed(1)} ms` : '--'}
            </span>
            <span>
              Garis putus: HR {latest.hrBpm !== null ? `${latest.hrBpm.toFixed(1)} bpm` : '--'}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
