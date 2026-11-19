import { UI } from '@/constants/theme';
import { fmtShort, fmtVal, type Unit } from '@/lib/stats';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

const H = 240;
const PAD = { l: 40, r: 16, t: 24, b: 28 };

/** Line chart with grid, y axis in the exercise unit, one dot per session. */
export function WeightChart({ points, color, unit }: { points: { kg: number; date: string }[]; color: string; unit: Unit }) {
  const [w, setW] = useState(0);
  const kgs = points.map(p => p.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const pad = (max - min) * 0.15 || 5;
  const lo = Math.max(0, Math.floor(min - pad));
  const hi = Math.ceil(max + pad);
  const ticks = [0, 1, 2, 3, 4].map(i => lo + ((hi - lo) * i) / 4);
  const iw = w - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (kg: number) => PAD.t + ih - ((kg - lo) / (hi - lo)) * ih;
  const every = Math.ceil(points.length / 5); // at most ~5 date labels
  const showValues = points.length <= 8;
  const best = kgs.lastIndexOf(max);

  return (
    <View
      onLayout={e => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Grafico: ${points.map(p => `${fmtShort(p.date)} ${fmtVal(p.kg, unit)}`).join(', ')}`}
    >
      {w > 0 ? (
        <Svg width={w} height={H}>
          {ticks.map(t => (
            <G key={t}>
              <Line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke={UI.border} strokeWidth={1} strokeDasharray="4 4" />
              <SvgText x={PAD.l - 8} y={y(t) + 4} fontSize={11} fill={UI.muted} textAnchor="end">{String(Math.round(t * 10) / 10)}</SvgText>
            </G>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <SvgText key={`d${i}`} x={x(i)} y={H - 8} fontSize={11} fill={UI.muted} textAnchor="middle">{fmtShort(p.date)}</SvgText>
            ) : null,
          )}
          <Polyline points={points.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')} fill="none" stroke={UI.text} strokeWidth={2.5} strokeLinejoin="round" />
          {points.map((p, i) => (
            <G key={`p${i}`}>
              <Circle cx={x(i)} cy={y(p.kg)} r={i === best ? 7 : 5} fill={color} stroke={UI.text} strokeWidth={2} />
              {showValues || i === best || i === points.length - 1 ? (
                <SvgText x={x(i)} y={y(p.kg) - 12} fontSize={11} fontWeight="700" fill={UI.text} textAnchor="middle">{String(p.kg)}</SvgText>
              ) : null}
            </G>
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
    </View>
  );
}

