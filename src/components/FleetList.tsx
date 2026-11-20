import type { FatigueStatus, TelemetryPacket } from '../types/telemetry';
import { StatusBadge } from './StatusBadge';

export type FleetFilter = 'ALL' | FatigueStatus;

interface FleetListProps {
  vehicles: TelemetryPacket[];
  selectedVehicleId: string | null;
  filter: FleetFilter;
  onFilterChange: (filter: FleetFilter) => void;
  onSelectVehicle: (vehicleId: string) => void;
}

const FILTER_OPTIONS: { id: FleetFilter; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'KRITIS', label: 'Kritis' },
  { id: 'WASPADA', label: 'Waspada' },
  { id: 'NORMAL', label: 'Normal' },
];

const SEVERITY_ORDER: Record<FatigueStatus, number> = {
  KRITIS: 0,
  WASPADA: 1,
  DATA_TIDAK_VALID: 2,
  NORMAL: 3,
};

function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function FleetList({
  vehicles,
  selectedVehicleId,
  filter,
  onFilterChange,
  onSelectVehicle,
}: FleetListProps) {
  const sorted = [...vehicles].sort((a, b) => {
    const diff = SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status];
    if (diff !== 0) return diff;
    return b.fatigueIndex - a.fatigueIndex;
  });

  const visible =
    filter === 'ALL' ? sorted : sorted.filter((item) => item.status === filter);

  return (
    <aside className="panel fleet-rail" aria-label="Daftar unit armada">
      <div className="panel-header" style={{ marginBottom: 0 }}>
        <h2 className="panel-title">Antrean Armada ({vehicles.length})</h2>
      </div>

      <div className="filter-row" role="group" aria-label="Filter status unit">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="filter-btn"
            aria-pressed={filter === opt.id}
            onClick={() => onFilterChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="state-box" style={{ padding: '1rem' }}>
          <p className="muted-text" style={{ margin: 0 }}>
            Tidak ada unit dengan filter status yang dipilih.
          </p>
          {filter !== 'ALL' && (
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => onFilterChange('ALL')}
            >
              Tampilkan Semua Unit
            </button>
          )}
        </div>
      ) : (
        <div className="fleet-items">
          {visible.map((unit) => {
            const isSelected = unit.vehicleId === selectedVehicleId;
            return (
              <button
                key={unit.vehicleId}
                type="button"
                className="fleet-item"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelectVehicle(unit.vehicleId)}
              >
                <div className="fleet-item-top">
                  <div>
                    <div className="fleet-item-id mono">{unit.vehicleId}</div>
                    <div className="fleet-item-driver">
                      {unit.driverName} ({unit.plateNumber})
                    </div>
                  </div>
                  <StatusBadge status={unit.status} />
                </div>

                <div className="fleet-item-meta mono">
                  <span>IK {unit.fatigueIndex.toFixed(2)}</span>
                  <span>
                    SpO2 {unit.spo2Pct !== null ? `${unit.spo2Pct.toFixed(1)}%` : '--'}
                  </span>
                  <span>{formatTimeShort(unit.timestamp)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
