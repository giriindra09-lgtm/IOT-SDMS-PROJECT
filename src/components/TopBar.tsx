import type {
  MqttConnectionStatus,
  OperatingMode,
  ThemeMode,
  ViewTab,
} from '../types/telemetry';
import {
  NavAlarmIcon,
  NavHistoryIcon,
  NavLinkIcon,
  NavPulseIcon,
  ThemeIcon,
} from './Icons';

interface TopBarProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  operatingMode: OperatingMode;
  onToggleMode: () => void;
  mqttStatus: MqttConnectionStatus;
  unacknowledgedCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const NAV_ITEMS: { id: ViewTab; label: string; shortLabel: string }[] = [
  { id: 'live', label: 'Pemantauan Langsung', shortLabel: 'Langsung' },
  { id: 'history', label: 'Riwayat & Sinyal', shortLabel: 'Riwayat' },
  { id: 'alarms', label: 'Log Alarm', shortLabel: 'Alarm' },
  { id: 'connection', label: 'Koneksi', shortLabel: 'Koneksi' },
];

function renderNavIcon(tab: ViewTab) {
  switch (tab) {
    case 'live':
      return <NavPulseIcon size={17} />;
    case 'history':
      return <NavHistoryIcon size={17} />;
    case 'alarms':
      return <NavAlarmIcon size={17} />;
    case 'connection':
      return <NavLinkIcon size={17} />;
  }
}

function formatLiveStatusText(status: MqttConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'MQTT Terhubung';
    case 'connecting':
      return 'Menghubungkan...';
    case 'reconnecting':
      return 'Menyambung Ulang';
    case 'error':
      return 'MQTT Galat';
    default:
      return 'Live MQTT';
  }
}

export function TopBar({
  activeTab,
  onSelectTab,
  operatingMode,
  onToggleMode,
  mqttStatus,
  unacknowledgedCount,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const modeLabel =
    operatingMode === 'simulation'
      ? 'Mode Simulasi'
      : formatLiveStatusText(mqttStatus);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-group">
            <span className="brand-logo">
              <img
                src="/sdms-logo-mark.png"
                alt="Logo SDMS POLINES TE-3E"
                className="brand-logo-img"
                width={32}
                height={32}
              />
            </span>
            <div className="brand-title">
              <span className="brand-code">SDMS Armada</span>
              <span className="brand-sub">Smart Driver Monitoring System</span>
            </div>
          </div>

          <nav className="desktop-nav" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="nav-tab"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                >
                  {renderNavIcon(item.id)}
                  <span>{item.label}</span>
                  {item.id === 'alarms' && unacknowledgedCount > 0 && (
                    <span className="nav-count" aria-label={`${unacknowledgedCount} alarm belum ditangani`}>
                      {unacknowledgedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="topbar-controls">
            <button
              type="button"
              className="btn btn-compact mode-btn"
              data-mode={operatingMode}
              data-connected={mqttStatus === 'connected' ? 'true' : 'false'}
              onClick={onToggleMode}
              aria-label={
                operatingMode === 'simulation'
                  ? 'Beralih ke Mode Live MQTT'
                  : 'Aktifkan Mode Simulasi untuk pengujian tanpa perangkat'
              }
            >
              <span>{modeLabel}</span>
            </button>

            <button
              type="button"
              className="btn btn-compact"
              onClick={onToggleTheme}
              aria-label={
                theme === 'light'
                  ? 'Aktifkan tema gelap'
                  : 'Aktifkan tema terang'
              }
              title={theme === 'light' ? 'Tema Gelap' : 'Tema Terang'}
            >
              <ThemeIcon isDark={theme === 'dark'} />
              <span className="sr-only">
                {theme === 'light' ? 'Tema Gelap' : 'Tema Terang'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Navigasi ponsel">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="mobile-nav-btn"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(item.id)}
            >
              {renderNavIcon(item.id)}
              <span>{item.shortLabel}</span>
              {item.id === 'alarms' && unacknowledgedCount > 0 && (
                <span className="mobile-nav-badge">{unacknowledgedCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
