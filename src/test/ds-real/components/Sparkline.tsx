import React from 'react';
import { mergeClassName } from '../utils/cx';

export type SparklineType = 'line' | 'area' | 'bar';
export type SparklineTone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface SparklineProps {
    /** `null` / non-finite points render as gaps, not zero. */
    data: (number | null | undefined)[];
    type?: SparklineType;
    tone?: SparklineTone;
    width?: number;
    height?: number;
    strokeWidth?: number;
    /** Accessible description; defaults to a min/max/last summary. */
    label?: string;
    /** Marks the last data point with a dot (line/area). */
    showLastPoint?: boolean;
    /** Vertical ticks at data indexes (e.g. plan changes). */
    markers?: { index: number; label?: string }[];
    className?: string;
    'data-testid'?: string;
}

const toneCls: Record<SparklineTone, string> = {
    primary: 'text-primary',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-warning',
    info: 'text-info',
    neutral: 'text-fg-muted',
};

const PAD = 2;

/** Dependency-free inline SVG trend chart (line / area / bar). */
export const Sparkline: React.FC<SparklineProps> = ({
    data,
    type = 'line',
    tone = 'primary',
    width = 96,
    height = 28,
    strokeWidth = 1.5,
    label,
    showLastPoint = false,
    markers,
    className = '',
    ...rest
}) => {
    const n = data.length;
    const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
    const values = data.filter(isNum);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const range = max - min;
    const innerW = width - PAD * 2;
    const innerH = height - PAD * 2;

    // Flat series sits mid-height instead of dividing by zero.
    const y = (v: number) => (range === 0 ? PAD + innerH / 2 : PAD + innerH - ((v - min) / range) * innerH);
    // x is by position in the ORIGINAL series so gaps keep their slot.
    const x = (i: number) => (n === 1 ? width / 2 : PAD + (i / (n - 1)) * innerW);
    const lastIdx = data.reduce<number>((acc, v, i) => (isNum(v) ? i : acc), -1);

    const summary =
        label ??
        (values.length
            ? `Trend: ${values.length} points, min ${min}, max ${max}, latest ${values[values.length - 1]}`
            : 'No trend data');

    let body: React.ReactNode = null;
    if (values.length > 0) {
        if (type === 'bar') {
            const slot = innerW / n;
            const barW = Math.max(1, slot * 0.7);
            body = data.map((v, i) => {
                if (!isNum(v)) return null;
                const top = range === 0 ? PAD + innerH / 2 : y(v);
                const h = Math.max(1, PAD + innerH - top);
                return (
                    <rect
                        key={i}
                        data-testid="sparkline-bar"
                        x={PAD + i * slot + (slot - barW) / 2}
                        y={PAD + innerH - h}
                        width={barW}
                        height={h}
                        rx={1}
                        className="fill-current"
                    />
                );
            });
        } else {
            // Contiguous runs of numeric points; a null breaks the line.
            const runs: { i: number; v: number }[][] = [];
            data.forEach((v, i) => {
                if (!isNum(v)) { runs.push([]); return; }
                if (!runs.length) runs.push([]);
                runs[runs.length - 1].push({ i, v });
            });
            const segs = runs.filter((r) => r.length > 0);
            const pathOf = (r: { i: number; v: number }[]) => `M${r.map((p) => `${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' L')}`;
            body = (
                <>
                    {type === 'area' && segs.filter((r) => r.length > 1).map((r, k) => (
                        <path
                            key={`a${k}`}
                            data-testid="sparkline-area"
                            d={`${pathOf(r)} L${x(r[r.length - 1].i).toFixed(2)},${height - PAD} L${x(r[0].i).toFixed(2)},${height - PAD} Z`}
                            className="fill-current opacity-20"
                            stroke="none"
                        />
                    ))}
                    {segs.filter((r) => r.length > 1).map((r, k) => (
                        <path
                            key={`l${k}`}
                            data-testid="sparkline-line"
                            d={pathOf(r)}
                            fill="none"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="stroke-current"
                        />
                    ))}
                    {/* isolated single points (between gaps) still show as dots */}
                    {segs.filter((r) => r.length === 1 && r[0].i !== lastIdx).map((r) => (
                        <circle key={`s${r[0].i}`} data-testid="sparkline-point" cx={x(r[0].i)} cy={y(r[0].v)} r={1.5} className="fill-current" />
                    ))}
                    {(showLastPoint || values.length === 1) && lastIdx >= 0 && (
                        <circle
                            data-testid="sparkline-point"
                            cx={x(lastIdx)}
                            cy={y(data[lastIdx] as number)}
                            r={2.5}
                            className="fill-current"
                        />
                    )}
                </>
            );
        }
    }

    const ticks = (markers ?? []).filter((m) => m.index >= 0 && m.index < n).map((m) => (
        <line
            key={`m${m.index}`}
            data-testid="sparkline-marker"
            x1={x(m.index)}
            x2={x(m.index)}
            y1={PAD}
            y2={height - PAD}
            strokeWidth={1}
            strokeDasharray="2 2"
            className="stroke-current opacity-50"
        >
            {m.label ? <title>{m.label}</title> : null}
        </line>
    ));

    return (
        <svg
            role="img"
            aria-label={summary}
            data-testid={rest['data-testid'] ?? 'sparkline'}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={mergeClassName(`inline-block shrink-0 ${toneCls[tone]}`.trim(), className)}
        >
            {ticks}
            {body}
        </svg>
    );
};
