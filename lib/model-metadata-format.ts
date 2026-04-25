export function unknownIfNil(value: string | number | null | undefined): string | number {
  return value == null || value === "" ? "unknown" : value;
}

export function formatLatencyMs(value: number | null | undefined): string {
  return value == null ? "unknown" : `${Math.round(value)} ms`;
}

export function formatThroughputTps(value: number | null | undefined): string {
  return value == null ? "unknown" : `${Number(value).toFixed(1)} tok/s`;
}

export function formatContextTokens(value: number | null | undefined): string {
  if (value == null) return "unknown";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

export function formatGbSize(value: number | null | undefined): string {
  return value == null ? "unknown" : `${Number(value).toFixed(1)} GB`;
}
