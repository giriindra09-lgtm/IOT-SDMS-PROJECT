# Panduan Setup dan Deploy SDMS (EMQX Cloud + GitHub Actions + cPanel)

Dokumen ini memandu langkah lengkap menghubungkan source code workspace ini ke GitHub, EMQX Cloud, dan cPanel shared hosting (PHP + MySQL + FTP).

## 1. Persiapan Git dan Push Pertama ke GitHub

1. Unduh dan pasang **Git for Windows** dari situs resmi git-scm.com.
2. Buka PowerShell baru di folder proyek `d:\New folder\iot`, lalu atur identitas Git:
   ```powershell
   git config --global user.name "Nama Anda"
   git config --global user.email "email@kampus.ac.id"
   ```
3. Inisialisasi repository dan push ke GitHub (`main`):
   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "Inisialisasi dasbor SDMS, API PHP, dan workflow deploy cPanel"
   git remote add origin https://github.com/USERNAME/REPO-SDMS.git
   git push -u origin main
   ```

## 2. Setup Database MySQL dan Konfigurasi PHP di cPanel

1. Masuk ke cPanel, buka menu **MySQL Databases**:
   - Buat 1 database baru (mis. `usercpanel_sdms`).
   - Buat 1 user database + password kuat, lalu klik **Add User to Database** dengan hak **ALL PRIVILEGES**.
2. Buka **phpMyAdmin**, pilih database baru tersebut, buka tab **Import**, lalu unggah file `database/schema.sql` dari repo ini.
3. Buka **File Manager** cPanel menuju folder target web (mis. `public_html/api/`), salin isi `api/config.local.example.php` menjadi file baru bernama `config.local.php`:
   - Isi `db_host` (`localhost`), `db_name`, `db_user`, dan `db_pass`.
   - Buat string acak minimal 32 karakter untuk `webhook_secret` (nilai yang sama akan dipakai di EMQX Cloud).
   - Isi `allowed_origins` sesuai domain HTTPS cPanel kamu (mis. `https://sdms.domainkamu.com`).
4. Pastikan **AutoSSL / Let's Encrypt** aktif untuk domain tersebut agar browser mengizinkan koneksi `wss://` dan `https://`.

## 3. Setup GitHub Secrets untuk Auto-Deploy ke cPanel

1. Di cPanel, buka **FTP Accounts**, buat akun FTP dengan direktori mengarah tepat ke root domain atau subdomain target.
2. Di GitHub repository, buka **Settings > Secrets and variables > Actions**, lalu tambahkan **Repository Secrets** berikut:
   - `CPANEL_FTP_SERVER`: hostname FTP server (contoh `ftp.domainkamu.com`)
   - `CPANEL_FTP_USERNAME`: username FTP lengkap (contoh `deploy@domainkamu.com`)
   - `CPANEL_FTP_PASSWORD`: password akun FTP
   - `CPANEL_SERVER_DIR`: path tujuan di server relatif terhadap home akun FTP (contoh `/` jika root akun FTP sudah mengarah langsung ke `public_html`, atau `/public_html/`)
   - `VITE_MQTT_URL`: alamat WSS EMQX Cloud (contoh `wss://xxxx.ala.asia-southeast1.emqxsl.com:8084/mqtt`)
   - `VITE_MQTT_USERNAME`: username client dashboard di EMQX
   - `VITE_MQTT_PASSWORD`: password client dashboard di EMQX
   - `VITE_MQTT_TOPIC_PREFIX`: `sdms`
   - `VITE_API_BASE_URL`: `/api`
3. Setiap kali kamu menjalankan `git push origin main`, workflow `.github/workflows/deploy.yml` otomatis membangun frontend dan mengunggah hasil build + file `api/*.php` ke cPanel tanpa menimpa `api/config.local.php`.
4. Uji endpoint API di browser pada `https://domainkamu.com/api/health.php`. Pastikan `ok` bernilai `true` dan keempat tabel (`vehicles`, `driver_baselines`, `telemetry_logs`, `alarm_logs`) terdeteksi `true`.

## 4. Setup EMQX Cloud dan Rule Engine ke cPanel

1. Buat deployment **EMQX Cloud Serverless (Free Tier)** di region terdekat (mis. Singapore `ap-southeast-1`).
2. Di menu **Overview**, catat alamat broker:
   - Gateway kendaraan (`ESP32-WROOM` + `A7672S`): port **8883** (MQTTS TLS)
   - Frontend dasbor browser: port **8084** dengan path `/mqtt` (`wss://...emqxsl.com:8084/mqtt`)
3. Di menu **Access Control > Authentication**, buat minimal dua kredensial:
   - `sdms-gateway-01` untuk gateway kendaraan
   - `sdms-dashboard` untuk web dasbor
4. Untuk menyimpan riwayat ke MySQL cPanel secara otomatis, buka **Data Integration > Webhooks** di EMQX Cloud:
   - **URL:** `https://domainkamu.com/api/ingest.php`
   - **Method:** `POST`
   - **Headers:**
     - `Content-Type: application/json`
     - `X-Webhook-Secret: <nilai webhook_secret dari api/config.local.php>`
   - **Rule SQL:**
     ```sql
     SELECT
       topic,
       qos,
       timestamp,
       payload
     FROM
       "sdms/+/telemetry",
       "sdms/+/alarm"
     ```
   - Simpan dan aktifkan rule tersebut, lalu uji dengan `npm run simulate:mqtt` dari komputer lokal (setelah menyalin `.env.example` menjadi `.env`).

## 5. Kontrak Topik dan Payload JSON Firmware (ESP32-C3 / ESP32-WROOM)

- **Topik telemetri berkala (QoS 0, tiap 5 sampai 10 detik):** `sdms/{vehicle_id}/telemetry`
- **Topik alarm kritis (QoS 1):** `sdms/{vehicle_id}/alarm`
- **Nilai valid `status`:** `NORMAL`, `WASPADA`, `KRITIS`, `DATA_TIDAK_VALID`
- **Nilai valid `haptic_mode`:** `MATI`, `GETAR_LEMBUT`, `GETAR_KUAT`

```json
{
  "vehicle_id": "TRK-01",
  "plate_number": "H 9104 SD",
  "driver_name": "Budi Santoso",
  "device_id": "ESP32C3-01",
  "timestamp": "2026-11-20T12:30:00Z",
  "status": "WASPADA",
  "fatigue_index": 0.54,
  "t1": 0.45,
  "t2": 0.75,
  "hr_bpm": 68.4,
  "rmssd_ms": 51.2,
  "sdnn_ms": 62.0,
  "lf_hf_ratio": 1.32,
  "spo2_pct": 95.8,
  "sqi_pct": 91,
  "imu_rms_g": 0.11,
  "haptic_mode": "GETAR_LEMBUT",
  "lat": -7.05182,
  "lng": 110.43574,
  "speed_kmh": 58.5,
  "battery_pct": 84,
  "baseline": {
    "hr_bpm": 74.0,
    "rmssd_ms": 40.5,
    "sdnn_ms": 53.0,
    "spo2_pct": 98.0
  }
}
```
