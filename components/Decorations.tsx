export const StarDecor = ({
  size = 24,
  color = '#BDF2A0',
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ opacity }} aria-hidden="true">
    <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill={color} />
  </svg>
);

export const DotDecor = ({
  size = 8,
  color = '#7B5CF5',
}: {
  size?: number;
  color?: string;
}) => (
  <div
    aria-hidden="true"
    style={{ width: size, height: size, borderRadius: '50%', background: color }}
  />
);

export const CrossDecor = ({
  size = 20,
  color = '#FF4D3B',
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ opacity }} aria-hidden="true">
    <rect x="8" y="0" width="4" height="20" fill={color} />
    <rect x="0" y="8" width="20" height="4" fill={color} />
  </svg>
);
