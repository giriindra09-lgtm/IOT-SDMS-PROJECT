-- Skema database MySQL / MariaDB untuk Smart Driver Monitoring System (SDMS)
-- Import file ini melalui phpMyAdmin di cPanel pada database yang sudah dibuat.

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id VARCHAR(40) NOT NULL PRIMARY KEY,
  plate_number VARCHAR(32) NOT NULL DEFAULT '',
  driver_name VARCHAR(80) NOT NULL DEFAULT '',
  device_id VARCHAR(48) NOT NULL DEFAULT '',
  last_status ENUM('NORMAL', 'WASPADA', 'KRITIS', 'DATA_TIDAK_VALID') NOT NULL DEFAULT 'NORMAL',
  last_fatigue_index DECIMAL(4, 3) NOT NULL DEFAULT 0.000,
  last_spo2 DECIMAL(5, 2) NULL,
  last_hr DECIMAL(5, 1) NULL,
  last_sqi TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_haptic_mode VARCHAR(32) NOT NULL DEFAULT 'MATI',
  last_lat DECIMAL(10, 7) NULL,
  last_lng DECIMAL(10, 7) NULL,
  last_speed_kmh DECIMAL(5, 1) NULL,
  last_seen_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS driver_baselines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id VARCHAR(40) NOT NULL,
  driver_name VARCHAR(80) NOT NULL,
  baseline_hr DECIMAL(5, 1) NOT NULL,
  baseline_rmssd DECIMAL(6, 2) NOT NULL,
  baseline_sdnn DECIMAL(6, 2) NOT NULL,
  baseline_lf_hf DECIMAL(5, 2) NOT NULL,
  baseline_spo2 DECIMAL(5, 2) NOT NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_baseline_vehicle (vehicle_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telemetry_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id VARCHAR(40) NOT NULL,
  status ENUM('NORMAL', 'WASPADA', 'KRITIS', 'DATA_TIDAK_VALID') NOT NULL,
  fatigue_index DECIMAL(4, 3) NOT NULL,
  hr_bpm DECIMAL(5, 1) NULL,
  rmssd_ms DECIMAL(6, 2) NULL,
  sdnn_ms DECIMAL(6, 2) NULL,
  lf_hf_ratio DECIMAL(5, 2) NULL,
  spo2_pct DECIMAL(5, 2) NULL,
  sqi_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
  imu_rms_g DECIMAL(5, 3) NULL,
  haptic_mode VARCHAR(32) NOT NULL DEFAULT 'MATI',
  lat DECIMAL(10, 7) NULL,
  lng DECIMAL(10, 7) NULL,
  speed_kmh DECIMAL(5, 1) NULL,
  battery_pct TINYINT UNSIGNED NULL,
  recorded_at DATETIME NOT NULL,
  INDEX idx_vehicle_time (vehicle_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alarm_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id VARCHAR(40) NOT NULL,
  driver_name VARCHAR(80) NOT NULL DEFAULT '',
  severity ENUM('WASPADA', 'KRITIS') NOT NULL,
  trigger_reason VARCHAR(160) NOT NULL,
  fatigue_index DECIMAL(4, 3) NULL,
  spo2_pct DECIMAL(5, 2) NULL,
  haptic_mode VARCHAR(32) NOT NULL DEFAULT 'GETAR_KUAT',
  lat DECIMAL(10, 7) NULL,
  lng DECIMAL(10, 7) NULL,
  qos TINYINT UNSIGNED NOT NULL DEFAULT 1,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  acknowledged_by VARCHAR(80) NULL,
  acknowledge_note VARCHAR(255) NULL,
  acknowledged_at DATETIME NULL,
  triggered_at DATETIME NOT NULL,
  INDEX idx_alarm_time (triggered_at, acknowledged)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
