interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

/** رسم خطي صغير جدًا (sparkline) يوضح الاتجاه */
export default function Sparkline({ data, width = 80, height = 28, color = "#0ea5e9" }: SparklineProps) {
  const max = Math.max(1, ...data);
  const n = data.length;
  const step = n > 1 ? width / (n - 1) : width;
  const points = data.map((d, i) => ({
    x: i * step,
    y: height - 2 - (d / max) * (height - 6),
  }));
  const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = `${points[0].x},${height} ${linePath} ${points[n - 1].x},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ direction: "ltr" }} className="shrink-0">
      <polygon points={areaPath} fill={color} fillOpacity="0.12" />
      <polyline points={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[n - 1].x} cy={points[n - 1].y} r="2.5" fill={color} />
      )}
    </svg>
  );
}
