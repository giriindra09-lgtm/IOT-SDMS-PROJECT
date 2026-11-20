import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FatigueStatus } from '../types/telemetry';

interface FleetMapProps {
  vehicleId: string;
  driverName: string;
  status: FatigueStatus;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  trail: [number, number][];
}

function getMarkerColor(status: FatigueStatus): string {
  switch (status) {
    case 'KRITIS':
      return '#b91c1c';
    case 'WASPADA':
      return '#b45309';
    case 'DATA_TIDAK_VALID':
      return '#4a4e54';
    default:
      return '#11613b';
  }
}

export function FleetMap({
  vehicleId,
  driverName,
  status,
  lat,
  lng,
  speedKmh,
  trail,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialLat = lat ?? -7.0521;
    const initialLng = lng ?? 110.4354;

    const map = L.map(el, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) return;

    const pos: [number, number] = [lat, lng];
    const color = getMarkerColor(status);

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(pos, {
        radius: 9,
        color: '#ffffff',
        weight: 2.5,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(pos);
      markerRef.current.setStyle({ fillColor: color });
    }

    markerRef.current.bindTooltip(`${vehicleId} (${driverName})`, {
      direction: 'top',
      offset: [0, -8],
    });

    if (trail.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(trail, {
          color: '#0b4f8a',
          weight: 3,
          opacity: 0.78,
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(trail);
      }
    } else if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    map.panTo(pos, { animate: false });
  }, [lat, lng, status, vehicleId, driverName, trail]);

  const handleRecenter = () => {
    if (mapRef.current && lat !== null && lng !== null) {
      mapRef.current.setView([lat, lng], 15, { animate: false });
    }
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <section className="panel" aria-label="Peta posisi GNSS kendaraan">
      <div className="panel-header">
        <h3 className="panel-title">Posisi GNSS Kendaraan</h3>
        <span className="mono muted-text">
          {speedKmh !== null ? `${speedKmh.toFixed(1)} km/jam` : 'Kecepatan --'}
        </span>
      </div>

      {lat === null || lng === null ? (
        <div className="state-box" style={{ minHeight: '220px', justifyContent: 'center' }}>
          <p className="muted-text" style={{ margin: 0 }}>
            Koordinat GNSS belum tersedia dari modul A7672S untuk unit {vehicleId}.
          </p>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="map-container"
            role="region"
            aria-label={`Peta lokasi ${vehicleId} pada koordinat ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
          />
          <div className="map-controls">
            <span className="mono muted-text">
              Lat {lat.toFixed(5)}, Lng {lng.toFixed(5)}
            </span>
            <div className="map-btn-group">
              <button type="button" className="btn btn-compact" onClick={handleRecenter}>
                Pusatkan
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={handleZoomIn}
                aria-label="Perbesar peta"
              >
                +
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={handleZoomOut}
                aria-label="Perkecil peta"
              >
                -
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
