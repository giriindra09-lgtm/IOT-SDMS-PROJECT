import { useEffect, useRef, useState } from 'react';
import { fetchApiAlarms } from '../services/apiClient';
import type { AlarmEvent } from '../types/telemetry';
import { formatHapticLabel, StatusBadge } from './StatusBadge';

interface AlarmLogViewProps {
  alarms: AlarmEvent[];
  apiBaseUrl: string;
  onAcknowledgeAlarm: (alarm: AlarmEvent, operatorName: string, note: string) => Promise<void>;
  onMergeApiAlarms: (serverAlarms: AlarmEvent[]) => void;
  externalSelectedAlarm: AlarmEvent | null;
  onClearExternalSelectedAlarm: () => void;
}

type AlarmFilter = 'ALL' | 'OPEN' | 'ACK';

function formatAlarmTime(iso: string): string {
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

export function AlarmLogView({
  alarms,
  apiBaseUrl,
  onAcknowledgeAlarm,
  onMergeApiAlarms,
  externalSelectedAlarm,
  onClearExternalSelectedAlarm,
}: AlarmLogViewProps) {
  const [filter, setFilter] = useState<AlarmFilter>('ALL');
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [activeAlarm, setActiveAlarm] = useState<AlarmEvent | null>(null);
  const [operatorName, setOperatorName] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const operatorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (externalSelectedAlarm) {
      setActiveAlarm(externalSelectedAlarm);
      setFormError(null);
      onClearExternalSelectedAlarm();
    }
  }, [externalSelectedAlarm, onClearExternalSelectedAlarm]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeAlarm) {
      if (!dialog.open) {
        dialog.showModal();
      }
      operatorInputRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [activeAlarm]);

  const closeDialog = () => {
    setActiveAlarm(null);
    setFormError(null);
  };

  const handleSyncFromServer = async () => {
    setLoadingServer(true);
    setServerError(null);
    try {
      const serverRows = await fetchApiAlarms(apiBaseUrl);
      onMergeApiAlarms(serverRows);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Gagal menyinkronkan log alarm dari MySQL cPanel.'
      );
    } finally {
      setLoadingServer(false);
    }
  };

  const handleSubmitAck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAlarm) return;

    const cleanOperator = operatorName.trim();
    if (!cleanOperator) {
      setFormError('Nama operator wajib diisi sebelum menandai alarm ditangani.');
      operatorInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onAcknowledgeAlarm(activeAlarm, cleanOperator, note.trim());
      setNote('');
      closeDialog();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan tindak lanjut alarm.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = alarms.filter((item) => {
    if (filter === 'OPEN') return !item.acknowledged;
    if (filter === 'ACK') return item.acknowledged;
    return true;
  });

  return (
    <section aria-labelledby="alarms-heading" className="focus-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h1 id="alarms-heading" className="page-h1">
              Log Alarm Kelelahan (QoS 1)
            </h1>
            <p className="muted-text" style={{ margin: '0.25rem 0 0' }}>
              Catatan kejadian status Kritis dan tindak lanjut operator armada.
            </p>
          </div>

          <button
            type="button"
            className="btn"
            disabled={loadingServer}
            onClick={() => void handleSyncFromServer()}
          >
            {loadingServer ? 'Menyinkronkan...' : 'Muat Log dari MySQL cPanel'}
          </button>
        </div>

        <div className="filter-row" role="group" aria-label="Filter status penanganan alarm">
          <button
            type="button"
            className="filter-btn"
            aria-pressed={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          >
            Semua ({alarms.length})
          </button>
          <button
            type="button"
            className="filter-btn"
            aria-pressed={filter === 'OPEN'}
            onClick={() => setFilter('OPEN')}
          >
            Belum Ditangani ({alarms.filter((a) => !a.acknowledged).length})
          </button>
          <button
            type="button"
            className="filter-btn"
            aria-pressed={filter === 'ACK'}
            onClick={() => setFilter('ACK')}
          >
            Sudah Ditangani ({alarms.filter((a) => a.acknowledged).length})
          </button>
        </div>
      </div>

      {serverError && (
        <div className="state-box" data-kind="error" role="alert">
          <strong>Sinkronisasi log alarm dari server gagal</strong>
          <p style={{ margin: 0 }}>{serverError}</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="state-box">
          <strong>Belum ada alarm pada filter yang dipilih</strong>
          <p className="muted-text" style={{ margin: 0 }}>
            Alarm otomatis tercatat ketika Indeks Kelelahan mencapai T2 (0.75) atau SpO2 di bawah
            92%. Sinyal kualitas rendah (SQI &lt; 50%) ditandai Data Tidak Valid tanpa memicu alarm.
          </p>
        </div>
      ) : (
        <div className="panel">
          <table className="history-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Unit</th>
                <th>Tingkat</th>
                <th>Pemicu</th>
                <th>Haptik</th>
                <th>Status Tindak Lanjut</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alarm) => (
                <tr key={alarm.id}>
                  <td data-label="Waktu" className="mono">
                    {formatAlarmTime(alarm.triggeredAt)}
                  </td>
                  <td data-label="Unit">
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {alarm.vehicleId}
                    </span>{' '}
                    ({alarm.driverName})
                    {alarm.isSimulated && (
                      <span className="sim-tag" style={{ marginLeft: '0.4rem' }}>
                        SIMULASI
                      </span>
                    )}
                  </td>
                  <td data-label="Tingkat">
                    <StatusBadge status={alarm.severity} />
                  </td>
                  <td data-label="Pemicu">{alarm.triggerReason}</td>
                  <td data-label="Haptik">{formatHapticLabel(alarm.hapticMode)}</td>
                  <td data-label="Status Tindak Lanjut">
                    {alarm.acknowledged ? (
                      <span>
                        Ditangani oleh <strong>{alarm.acknowledgedBy}</strong>
                        {alarm.acknowledgeNote ? `: ${alarm.acknowledgeNote}` : ''}
                      </span>
                    ) : (
                      <span>Belum ditangani</span>
                    )}
                  </td>
                  <td data-label="Aksi">
                    {alarm.acknowledged ? (
                      <span className="muted-text">Selesai</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-compact btn-primary"
                        onClick={() => setActiveAlarm(alarm)}
                      >
                        Catat Tindak Lanjut
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="sdms-dialog"
        aria-labelledby="ack-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          closeDialog();
        }}
      >
        {activeAlarm && (
          <form className="dialog-inner" onSubmit={handleSubmitAck} noValidate>
            <div>
              <h2 id="ack-dialog-title" className="panel-title">
                Catat Tindak Lanjut Alarm ({activeAlarm.vehicleId})
              </h2>
              <p className="muted-text" style={{ margin: '0.35rem 0 0' }}>
                {activeAlarm.driverName}: {activeAlarm.triggerReason}
              </p>
            </div>

            <div className="field">
              <label htmlFor="ack-operator">Nama Operator Dispatch</label>
              <input
                ref={operatorInputRef}
                id="ack-operator"
                type="text"
                className="input"
                placeholder="Nama Operator"
                value={operatorName}
                aria-invalid={formError ? 'true' : undefined}
                aria-describedby={formError ? 'ack-form-error' : undefined}
                onChange={(e) => {
                  setOperatorName(e.target.value);
                  if (formError) setFormError(null);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="ack-note">Catatan Tindak Lanjut (Opsional)</label>
              <textarea
                id="ack-note"
                className="textarea"
                placeholder="Contoh: Pengemudi dihubungi dan diarahkan berhenti di rest area terdekat."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {formError && (
              <p id="ack-form-error" className="field-error" role="alert">
                {formError}
              </p>
            )}

            <div className="dialog-actions">
              <button type="button" className="btn" onClick={closeDialog}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Tindak Lanjut'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
