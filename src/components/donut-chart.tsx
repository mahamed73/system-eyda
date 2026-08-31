interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
}

/** Donut chart بتوزيع النسب — بيظهر نسبة كل جزء بالألوان */
export default function DonutChart({ slices, size = 140, thickness = 22 }: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {total > 0 &&
        slices.map((s, i) => {
          const fraction = s.value / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      <text x={center} y={center - 4} textAnchor="middle" className="fill-slate-800" fontSize="20" fontWeight="700">
        {total.toLocaleString("en-US")}
      </text>
      <text x={center} y={center + 16} textAnchor="middle" className="fill-slate-400" fontSize="11">
        ج.م
      </text>
    </svg>
  );
}
