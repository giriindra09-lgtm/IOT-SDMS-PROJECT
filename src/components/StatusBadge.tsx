import type { FatigueStatus, HapticMode } from '../types/telemetry';
import { StatusShapeIcon } from './Icons';

export function formatStatusLabel(status: FatigueStatus): string {
  switch (status) {
    case 'NORMAL':
      return 'Normal';
    case 'WASPADA':
      return 'Waspada';
    case 'KRITIS':
      return 'Kritis';
    case 'DATA_TIDAK_VALID':
      return 'Data Tidak Valid';
  }
}

export function formatHapticLabel(mode: HapticMode): string {
  switch (mode) {
    case 'GETAR_KUAT':
      return 'Getar Kuat Berulang';
    case 'GETAR_LEMBUT':
      return 'Getar Lembut / 30 dtk';
    case 'MATI':
      return 'Motor Getar Mati';
  }
}

export function StatusBadge({ status }: { status: FatigueStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      <StatusShapeIcon status={status} size={14} />
      <span>{formatStatusLabel(status)}</span>
    </span>
  );
}
