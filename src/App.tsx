import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlarmLogView } from './components/AlarmLogView';
import { ConnectionView } from './components/ConnectionView';
import { CriticalBanner } from './components/CriticalBanner';
import { FleetList, type FleetFilter } from './components/FleetList';
import { HistoryView } from './components/HistoryView';
import { TopBar } from './components/TopBar';
import { VehicleFocus } from './components/VehicleFocus';
import { acknowledgeApiAlarm } from './services/apiClient';
import { SdmsMqttService } from './services/mqttClient';
import { FleetSimulator, type SimulationTargetState } from './services/simulator';
import type {
  AlarmEvent,
  MqttConnectionConfig,
  MqttConnectionStatus,
  OperatingMode,
  RawMqttMessageLog,
  TelemetryPacket,
  ThemeMode,
  ViewTab,
} from './types/telemetry';

const MQTT_SESSION_KEY = 'sdms_mqtt_session_config';
const THEME_STORAGE_KEY = 'sdms_theme_mode';

function getInitialMqttConfig(): MqttConnectionConfig {
  const envUrl = import.meta.env.VITE_MQTT_URL ?? '';
  const envUser = import.meta.env.VITE_MQTT_USERNAME ?? '';
  const envPass = import.meta.env.VITE_MQTT_PASSWORD ?? '';
  const envPrefix = import.meta.env.VITE_MQTT_TOPIC_PREFIX ?? 'sdms';

  try {
    const saved = sessionStorage.getItem(MQTT_SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<MqttConnectionConfig>;
      return {
        url: parsed.url ?? envUrl,
        username: parsed.username ?? envUser,
        password: parsed.password ?? envPass,
        topicPrefix: parsed.topicPrefix ?? envPrefix,
      };
    }
  } catch {
    // Abaikan jika sessionStorage tidak tersedia.
  }

  return {
    url: envUrl,
    username: envUser,
    password: envPass,
    topicPrefix: envPrefix,
  };
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Abaikan jika localStorage diblokir.
  }
  return 'light';
}

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [activeTab, setActiveTab] = useState<ViewTab>('live');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('live');

  const [mqttConfig, setMqttConfig] = useState<MqttConnectionConfig>(getInitialMqttConfig);
  const [mqttStatus, setMqttStatus] = useState<MqttConnectionStatus>('disconnected');
  const [mqttError, setMqttError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(
    import.meta.env.VITE_API_BASE_URL ?? '/api'
  );

  // Pisahkan state Live MQTT dan Simulasi agar data nyata tidak pernah tercampur data uji.
  const [liveVehicles, setLiveVehicles] = useState<Record<string, TelemetryPacket>>({});
  const [liveHistory, setLiveHistory] = useState<Record<string, TelemetryPacket[]>>({});
  const [liveAlarms, setLiveAlarms] = useState<AlarmEvent[]>([]);
  const [rawLogs, setRawLogs] = useState<RawMqttMessageLog[]>([]);

  const [simVehicles, setSimVehicles] = useState<Record<string, TelemetryPacket>>({});
  const [simHistory, setSimHistory] = useState<Record<string, TelemetryPacket[]>>({});
  const [simAlarms, setSimAlarms] = useState<AlarmEvent[]>([]);
  const [simPaused, setSimPaused] = useState(false);

  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('ALL');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [externalAlarmModalTarget, setExternalAlarmModalTarget] = useState<AlarmEvent | null>(null);

  const mqttServiceRef = useRef<SdmsMqttService | null>(null);
  const simulatorRef = useRef<FleetSimulator | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Abaikan.
    }
  }, [theme]);

  // Inisialisasi klien MQTT browser dan sambungkan otomatis bila konfigurasi .env tersedia.
  useEffect(() => {
    const service = new SdmsMqttService({
      onStatusChange: (status, errMsg) => {
        setMqttStatus(status);
        setMqttError(errMsg ?? null);
      },
      onTelemetry: (packet) => {
        setLiveVehicles((prev) => ({
          ...prev,
          [packet.vehicleId]: packet,
        }));
        setLiveHistory((prev) => {
          const nextList = [...(prev[packet.vehicleId] ?? []), packet].slice(-120);
          return { ...prev, [packet.vehicleId]: nextList };
        });
      },
      onAlarm: (alarm) => {
        setLiveAlarms((prev) => [alarm, ...prev].slice(0, 120));
      },
      onRawLog: (entry) => {
        setRawLogs((prev) => [entry, ...prev].slice(0, 20));
      },
    });

    mqttServiceRef.current = service;

    if (mqttConfig.url.trim()) {
      service.connect(mqttConfig);
    }

    return () => {
      service.disconnect();
      mqttServiceRef.current = null;
    };
  }, []);

  // Jalankan timer simulasi hanya saat Mode Simulasi aktif dan tidak dijeda.
  useEffect(() => {
    if (operatingMode !== 'simulation') {
      return;
    }

    if (!simulatorRef.current) {
      const sim = new FleetSimulator();
      simulatorRef.current = sim;
      const seeded = sim.seedInitialState();
      const map: Record<string, TelemetryPacket> = {};
      for (const pkt of seeded.packets) {
        map[pkt.vehicleId] = pkt;
      }
      setSimVehicles(map);
      setSimHistory(seeded.historyByVehicle);
      setSimAlarms(seeded.alarms);
      setSelectedVehicleId((prev) => prev ?? seeded.packets[0]?.vehicleId ?? null);
    }

    if (simPaused) return;

    const timer = window.setInterval(() => {
      const sim = simulatorRef.current;
      if (!sim) return;
      const { packets, alarms } = sim.stepAll();
      setSimVehicles((prev) => {
        const next = { ...prev };
        for (const pkt of packets) {
          next[pkt.vehicleId] = pkt;
        }
        return next;
      });
      setSimHistory((prev) => {
        const next = { ...prev };
        for (const pkt of packets) {
          next[pkt.vehicleId] = [...(next[pkt.vehicleId] ?? []), pkt].slice(-120);
        }
        return next;
      });
      if (alarms.length > 0) {
        setSimAlarms((prev) => [...alarms, ...prev].slice(0, 120));
      }
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [operatingMode, simPaused]);

  const activeVehiclesMap = operatingMode === 'simulation' ? simVehicles : liveVehicles;
  const activeHistoryMap = operatingMode === 'simulation' ? simHistory : liveHistory;
  const activeAlarms = operatingMode === 'simulation' ? simAlarms : liveAlarms;

  const vehicleList = useMemo(() => Object.values(activeVehiclesMap), [activeVehiclesMap]);

  useEffect(() => {
    if (vehicleList.length === 0) {
      if (operatingMode === 'live') {
        setSelectedVehicleId(null);
      }
      return;
    }
    if (!selectedVehicleId || !activeVehiclesMap[selectedVehicleId]) {
      setSelectedVehicleId(vehicleList[0].vehicleId);
    }
  }, [vehicleList, selectedVehicleId, activeVehiclesMap, operatingMode]);

  const selectedPacket =
    selectedVehicleId && activeVehiclesMap[selectedVehicleId]
      ? activeVehiclesMap[selectedVehicleId]
      : vehicleList[0] ?? null;

  const criticalOpenAlarms = useMemo(
    () => activeAlarms.filter((a) => !a.acknowledged && a.severity === 'KRITIS'),
    [activeAlarms]
  );

  const unacknowledgedCount = useMemo(
    () => activeAlarms.filter((a) => !a.acknowledged).length,
    [activeAlarms]
  );

  const handleConnectMqtt = useCallback((config: MqttConnectionConfig) => {
    setMqttConfig(config);
    try {
      sessionStorage.setItem(MQTT_SESSION_KEY, JSON.stringify(config));
    } catch {
      // Abaikan.
    }
    setOperatingMode('live');
    mqttServiceRef.current?.connect(config);
  }, []);

  const handleDisconnectMqtt = useCallback(() => {
    mqttServiceRef.current?.disconnect();
  }, []);

  const handleInjectScenario = useCallback(
    (vehicleId: string, state: SimulationTargetState) => {
      const sim = simulatorRef.current;
      if (!sim) return;
      const packet = sim.injectScenario(vehicleId, state);
      if (!packet) return;

      setSimVehicles((prev) => ({ ...prev, [packet.vehicleId]: packet }));
      setSimHistory((prev) => ({
        ...prev,
        [packet.vehicleId]: [...(prev[packet.vehicleId] ?? []), packet].slice(-120),
      }));

      if (packet.status === 'KRITIS') {
        const triggerReason =
          packet.spo2Pct !== null && packet.spo2Pct < 92
            ? `SpO2 ${packet.spo2Pct.toFixed(1)}% (< 92%) dan IK ${packet.fatigueIndex.toFixed(2)}`
            : `Indeks Kelelahan ${packet.fatigueIndex.toFixed(2)} >= 0.75`;
        const alarm: AlarmEvent = {
          id: `sim-manual-${packet.vehicleId}-${Date.now()}`,
          vehicleId: packet.vehicleId,
          driverName: packet.driverName,
          severity: 'KRITIS',
          triggerReason,
          fatigueIndex: packet.fatigueIndex,
          spo2Pct: packet.spo2Pct,
          hapticMode: packet.hapticMode,
          lat: packet.lat,
          lng: packet.lng,
          qos: 1,
          acknowledged: false,
          triggeredAt: packet.timestamp,
          isSimulated: true,
        };
        setSimAlarms((prev) => [alarm, ...prev]);
      }
    },
    []
  );

  const handleAcknowledgeAlarm = useCallback(
    async (alarm: AlarmEvent, operatorName: string, note: string) => {
      // Jika alarm berasal dari database MySQL (ID numerik), simpan juga ke server.
      if (!alarm.isSimulated && /^\d+$/.test(alarm.id)) {
        await acknowledgeApiAlarm(apiBaseUrl, alarm.id, operatorName, note);
      }

      const updater = (prev: AlarmEvent[]) =>
        prev.map((item) =>
          item.id === alarm.id
            ? {
                ...item,
                acknowledged: true,
                acknowledgedBy: operatorName,
                acknowledgeNote: note || undefined,
                acknowledgedAt: new Date().toISOString(),
              }
            : item
        );

      if (alarm.isSimulated) {
        setSimAlarms(updater);
      } else {
        setLiveAlarms(updater);
      }
    },
    [apiBaseUrl]
  );

  const handleMergeApiAlarms = useCallback((serverAlarms: AlarmEvent[]) => {
    setOperatingMode('live');
    setLiveAlarms((prev) => {
      const mergedMap = new Map<string, AlarmEvent>();
      for (const row of serverAlarms) mergedMap.set(row.id, row);
      for (const row of prev) {
        if (!mergedMap.has(row.id)) mergedMap.set(row.id, row);
      }
      return Array.from(mergedMap.values()).sort(
        (a, b) => Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt)
      );
    });
  }, []);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        operatingMode={operatingMode}
        onToggleMode={() =>
          setOperatingMode((prev) => (prev === 'live' ? 'simulation' : 'live'))
        }
        mqttStatus={mqttStatus}
        unacknowledgedCount={unacknowledgedCount}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
      />

      <main id="main-content" tabIndex={-1} className="main-content">
        <CriticalBanner
          criticalAlarms={criticalOpenAlarms}
          onFocusVehicle={(vehicleId) => {
            setSelectedVehicleId(vehicleId);
            setActiveTab('live');
          }}
          onOpenAlarmModal={(alarm) => {
            setExternalAlarmModalTarget(alarm);
            setActiveTab('alarms');
          }}
        />

        {activeTab === 'live' && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <h1 className="page-h1">Pemantauan Kelelahan Pengemudi Armada</h1>
              <span className="muted-text">
                {operatingMode === 'simulation'
                  ? 'Sumber aktif: Mode Simulasi Lokal (3 unit uji Semarang)'
                  : `Sumber aktif: Live MQTT (${mqttStatus})`}
              </span>
            </div>

            {vehicleList.length === 0 ? (
              <section className="state-box" aria-label="Status data armada kosong">
                <strong>Belum ada data telemetri langsung dari perangkat</strong>
                <p className="muted-text" style={{ margin: 0, maxWidth: '64ch' }}>
                  Hubungkan klien ke broker EMQX Cloud pada tab Koneksi agar gateway ESP32-WROOM
                  dan gelang ESP32-C3 mengirim telemetri ke topik{' '}
                  <span className="mono">{mqttConfig.topicPrefix || 'sdms'}/+/telemetry</span>, atau
                  aktifkan Mode Simulasi untuk menguji alur dasbor dan mesin status.
                </p>
                <div className="state-box-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setOperatingMode('simulation')}
                  >
                    Aktifkan Mode Simulasi
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setActiveTab('connection')}
                  >
                    Atur Koneksi EMQX Cloud
                  </button>
                </div>
              </section>
            ) : (
              <div className="dispatch-layout">
                <FleetList
                  vehicles={vehicleList}
                  selectedVehicleId={selectedPacket?.vehicleId ?? null}
                  filter={fleetFilter}
                  onFilterChange={setFleetFilter}
                  onSelectVehicle={setSelectedVehicleId}
                />

                {selectedPacket && (
                  <VehicleFocus
                    packet={selectedPacket}
                    history={activeHistoryMap[selectedPacket.vehicleId] ?? [selectedPacket]}
                    operatingMode={operatingMode}
                    simPaused={simPaused}
                    onToggleSimPause={() => setSimPaused((prev) => !prev)}
                    onInjectSimScenario={handleInjectScenario}
                  />
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <HistoryView
            apiBaseUrl={apiBaseUrl}
            vehicles={vehicleList}
            selectedVehicleId={selectedPacket?.vehicleId ?? null}
            historyByVehicle={activeHistoryMap}
          />
        )}

        {activeTab === 'alarms' && (
          <AlarmLogView
            alarms={activeAlarms}
            apiBaseUrl={apiBaseUrl}
            onAcknowledgeAlarm={handleAcknowledgeAlarm}
            onMergeApiAlarms={handleMergeApiAlarms}
            externalSelectedAlarm={externalAlarmModalTarget}
            onClearExternalSelectedAlarm={() => setExternalAlarmModalTarget(null)}
          />
        )}

        {activeTab === 'connection' && (
          <ConnectionView
            mqttConfig={mqttConfig}
            mqttStatus={mqttStatus}
            mqttError={mqttError}
            onConnectMqtt={handleConnectMqtt}
            onDisconnectMqtt={handleDisconnectMqtt}
            apiBaseUrl={apiBaseUrl}
            onUpdateApiBaseUrl={setApiBaseUrl}
            rawLogs={rawLogs}
            onClearLogs={() => setRawLogs([])}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <span>
            Smart Driver Monitoring System (SDMS) - TE-3E Kelompok 3, Politeknik Negeri Semarang
          </span>
          <span className="mono">Broker: EMQX Cloud WSS | Persistensi: PHP + MySQL cPanel</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
