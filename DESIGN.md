# DESIGN.md - Smart Driver Monitoring System (SDMS)

## Design Read

Reading this as: Fleet telematics and physiological driver safety dashboard for dispatch operators (Smart Driver Monitoring System, Politeknik Negeri Semarang, TE-3E Kelompok 3, PKM-KC 2026), in a high-contrast daytime telematics instrument style with full Light/Dark parity, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Brand Identity & Placeholders

- **Logo / Identity:** Literal `[LOGO]` placeholder box beside `SDMS` (`Smart Driver Monitoring` on wider viewports) until Kelompok 3 finalizes an official emblem. No invented graphics, logos, or team avatars.
- **Language:** Indonesian operational terminology aligned with the proposal: Indeks Kelelahan (IK), status `Normal`, `Waspada`, `Kritis`, `Data Tidak Valid`, ambang `T1` (0.45), `T2` (0.75), dan `SpO2 < 92%`.

## Typography

- **UI & Headings:** `IBM Plex Sans` (bundled locally via `@fontsource/ibm-plex-sans`) chosen for crisp legibility across compact telematics readouts, Indonesian prose labels, and bright dispatch room monitors without relying on default AI fonts.
- **Numeric Telemetry & Identifiers:** `IBM Plex Mono` (bundled via `@fontsource/ibm-plex-mono`) used strictly for tabular numbers (`font-variant-numeric: tabular-nums`), timestamps, GNSS coordinates, vehicle IDs, and MQTT topics so live values do not jitter horizontally on update. Never used as large decorative display headings.

## Color System (WCAG AA Verified)

Active palette capped at core neutrals + 1 accent (`#0B4F8A` / `#6EB4F7`) + semantic status hues (`Normal`, `Waspada`, `Kritis`).

### Light Theme (Default)
- Canvas: `#F4F3EF`
- Surface: `#FFFFFF`
- Inset / Recessed: `#EAE8E1`
- Hairline divider: `#D3CFC4`
- Interactive border: `#6E6A60` (>= 4.86:1 UI contrast)
- Ink primary: `#16181A` (17.80:1 on surface, 16.03:1 on canvas)
- Ink muted: `#4A4E54` (8.37:1 on surface, 7.54:1 on canvas)
- Accent primary fill: `#0B4F8A` with `#FFFFFF` ink (8.40:1)
- Accent text on surface: `#0B4F8A` (8.40:1)
- Status Normal: `#11613B` on `#E5F4EC` (6.61:1)
- Status Waspada: `#7A4600` on `#FEF3D6` (7.03:1)
- Status Kritis: `#9E1B1B` on `#FDE8E8` (6.81:1) and solid `#B91C1C` with `#FFFFFF` (6.47:1)
- Status Data Tidak Valid: `#4A4E54` on `#EAE8E1` (6.83:1)

### Dark Theme
- Canvas: `#111417`
- Surface: `#181C20`
- Inset / Recessed: `#22272D`
- Hairline divider: `#2E353D`
- Interactive border: `#7A848E` (4.50:1 UI contrast)
- Ink primary: `#F0F2F4` (15.27:1 on surface, 16.47:1 on canvas)
- Ink muted: `#A8B1BA` (7.88:1 on surface, 8.50:1 on canvas)
- Accent primary fill: `#155D9E` with `#FFFFFF` ink (6.79:1)
- Accent text on surface: `#6EB4F7` (7.78:1)
- Status Normal: `#6EE0A8` on `#102B1E` (9.30:1)
- Status Waspada: `#F6C15C` on `#2D210B` (9.52:1)
- Status Kritis: `#FF8A8A` on `#331315` (7.43:1) and solid `#B91C1C` with `#FFFFFF` (6.47:1)
- Status Data Tidak Valid: `#B4BCC4` on `#22272D` (7.83:1)

## Layout, Rhythm & Identity Motif

- **Focal Point:** Asymmetric two-zone dispatch workspace (urgency-sorted fleet queue on the left + focused driver telemetry & GNSS map on the right), avoiding generic 4-stat-card-plus-sidebar shells.
- **Identity Motif:** Calibrated Indeks Kelelahan (IK) instrument bar marking exact proposal hysteresis thresholds `T1 = 0.45` and `T2 = 0.75`, paired with distinct geometric status symbols (check-circle for Normal, triangle for Waspada, octagon for Kritis, slashed circle for Data Tidak Valid) so alerts never rely on color alone.
- **Radius Scale:** `2px` status chips and calibrated scale ticks, `6px` interactive controls and form inputs, `8px` panels and modal dialogs.
- **Motion:** Functional state transitions only (`<= 120ms` hover/focus/active transitions, wrapped in `prefers-reduced-motion: reduce`), zero looping pulses, zero glows, zero glassmorphism.

## R-31 Design Decisions

- **Why `#F4F3EF` + `#FFFFFF` + `#0B4F8A`:** Warm instrument-paper canvas prevents glare in bright dispatch rooms while `#0B4F8A` provides 8.40:1 contrast and separates interactive actions clearly from semantic alarm colors (`Waspada` amber, `Kritis` red).
- **Why asymmetric fleet rail + focused telemetry workspace:** Dispatchers make one primary decision per screen: spot the highest-urgency driver and inspect physiological trends, baseline delta, haptic state, and vehicle GNSS position immediately.
- **Why custom geometric icons + threshold bar:** Eliminates generic library icon sameness while making status distinguishable for color-vision-deficient operators and linking UI directly to Gambar 4 and Gambar 5 of the proposal.
- **Why structured instrument rows instead of equal bento stat cards:** Separates primary alert indices (IK, SpO2) from supporting HRV time/frequency metrics (RMSSD, SDNN, LF/HF) and signal quality diagnostics (SQI, IMU RMS).
