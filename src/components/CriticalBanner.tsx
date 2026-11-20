import type { AlarmEvent } from '../types/telemetry';
import { StatusShapeIcon } from './Icons';

interface CriticalBannerProps {
  criticalAlarms: AlarmEvent[];
  onFocusVehicle: (vehicleId: string) => void;
  onOpenAlarmModal: (alarm: AlarmEvent) => void;
}

export function CriticalBanner({
  criticalAlarms,
  onFocusVehicle,
  onOpenAlarmModal,
}: CriticalBannerProps) {
  if (criticalAlarms.length === 0) return null;

  const latest = criticalAlarms[0];

  return (
    <section className="critical-banner" role="alert" aria-live="assertive">
      <div className="critical-banner-main">
        <StatusShapeIcon status="KRITIS" size={22} />
        <div>
          <p className="critical-banner-title">
            Peringatan Kritis: {latest.vehicleId} ({latest.driverName})
            {criticalAlarms.length > 1 ? ` dan ${criticalAlarms.length - 1} alarm kritis lain` : ''}
          </p>
          <p className="critical-banner-detail">
            {latest.triggerReason}. Intervensi motor getar kuat sedang aktif pada gelang pengemudi.
          </p>
        </div>
      </div>

      <div className="critical-banner-actions">
        <button
          type="button"
          className="btn btn-compact"
          onClick={() => onFocusVehicle(latest.vehicleId)}
        >
          Fokus Kendaraan
        </button>
        <button
          type="button"
          className="btn btn-compact btn-danger"
          onClick={() => onOpenAlarmModal(latest)}
        >
          Tandai Ditangani
        </button>
      </div>
    </section>
  );
}
