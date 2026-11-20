import type { FatigueStatus } from '../types/telemetry';

interface IconProps {
  size?: number;
}

export function StatusShapeIcon({
  status,
  size = 15,
}: {
  status: FatigueStatus;
  size?: number;
}) {
  if (status === 'NORMAL') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M5.2 8.2L7.1 10.1L10.9 6.1"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
        />
      </svg>
    );
  }

  if (status === 'WASPADA') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.1L14.3 13.3H1.7L8 2.1Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="miter"
        />
        <path d="M8 6.2V9.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
        <rect x="7.15" y="10.9" width="1.7" height="1.7" fill="currentColor" />
      </svg>
    );
  }

  if (status === 'KRITIS') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <polygon
          points="5.3,1.5 10.7,1.5 14.5,5.3 14.5,10.7 10.7,14.5 5.3,14.5 1.5,10.7 1.5,5.3"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="M8 4.8V8.8" stroke="currentColor" strokeWidth="1.85" strokeLinecap="square" />
        <rect x="7.1" y="10.3" width="1.8" height="1.8" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.6 12.4L12.4 3.6" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function NavPulseIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2 10H5.5L7.8 4.2L11.4 15.6L13.8 10H18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function NavHistoryIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="13" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 12.5L9 9.2L11.6 11.4L14.5 7.2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function NavAlarmIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.2L17.2 16H2.8L10 3.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M10 7.8V11.6" stroke="currentColor" strokeWidth="1.75" />
      <rect x="9.1" y="13.1" width="1.8" height="1.8" fill="currentColor" />
    </svg>
  );
}

export function NavLinkIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="6" height="11" stroke="currentColor" strokeWidth="1.75" />
      <rect x="11.5" y="4.5" width="6" height="11" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 10H11.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function ThemeIcon({ isDark, size = 16 }: { isDark: boolean; size?: number }) {
  if (isDark) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3.6" stroke="currentColor" strokeWidth="1.65" />
        <path
          d="M9 1.8V3.4M9 14.6V16.2M1.8 9H3.4M14.6 9H16.2M3.9 3.9L5.1 5.1M12.9 12.9L14.1 14.1M14.1 3.9L12.9 5.1M5.1 12.9L3.9 14.1"
          stroke="currentColor"
          strokeWidth="1.55"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M14.8 11.4A6.2 6.2 0 0 1 6.6 3.2A6.5 6.5 0 1 0 14.8 11.4Z"
        stroke="currentColor"
        strokeWidth="1.65"
      />
    </svg>
  );
}
