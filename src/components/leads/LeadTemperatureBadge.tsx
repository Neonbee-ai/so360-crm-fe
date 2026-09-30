/**
 * LeadTemperatureBadge.tsx — RE plan E §20 Hot / Warm / Cold.
 *
 * The band is computed and stored by crm-be (leads.temperature, migration
 * 081). The UI only reads it — it never recomputes the score. Everything here
 * is gated by RE_FLAGS.LEAD_TEMPERATURE (useCrmFeatureFlag) at the call site;
 * this component renders nothing for a lead that has no band yet.
 */
import { Flame, Snowflake, Thermometer } from 'lucide-react';
import type { Lead, LeadTemperature } from '../../types/crm';

export const LEAD_TEMPERATURE_OPTIONS: Array<{ value: LeadTemperature; label: string }> = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

/** Tolerant read of the stored band — anything unknown is "no band". */
export function normaliseTemperature(value: unknown): LeadTemperature | null {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'hot' || v === 'warm' || v === 'cold' ? v : null;
}

/**
 * List-filter predicate. 'All' (or an unset value from an older saved view)
 * keeps every lead; otherwise only leads whose stored band matches.
 */
export function matchesTemperatureFilter(lead: Pick<Lead, 'temperature'>, filter: string | undefined): boolean {
  if (!filter || filter === 'All') return true;
  return normaliseTemperature(lead.temperature) === normaliseTemperature(filter);
}

const STYLES: Record<LeadTemperature, { label: string; cls: string; Icon: typeof Flame }> = {
  hot: { label: 'Hot', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30', Icon: Flame },
  warm: { label: 'Warm', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', Icon: Thermometer },
  cold: { label: 'Cold', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30', Icon: Snowflake },
};

interface LeadTemperatureBadgeProps {
  temperature: unknown;
  score?: number | null;
  className?: string;
}

export default function LeadTemperatureBadge({ temperature, score, className = '' }: LeadTemperatureBadgeProps) {
  const band = normaliseTemperature(temperature);
  if (!band) return null;
  const { label, cls, Icon } = STYLES[band];
  const title = typeof score === 'number' ? `${label} lead — temperature ${score}/100` : `${label} lead`;
  return (
    <span
      data-testid="lead-temperature-badge"
      data-temperature={band}
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${cls} ${className}`}
    >
      {Icon ? <Icon size={10} /> : null}
      {label}
    </span>
  );
}
