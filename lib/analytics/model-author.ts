/**
 * Model “author” keys for Silk analytics (similar to OpenRouter market share “by provider”).
 */

export const MARKET_SHARE_TOP_K = 9;

export type MarketShareAuthorRow = {
  key: string;
  label: string;
  color: string;
  totalTokens: number;
  /** Share of aggregate token usage in the chart window (%). */
  sharePercent: number;
};

export type MarketShareDailyRow = {
  date: string;
  /** Heights for stacked bar; keys include `others`; sum ~= 100 per day with usage. */
  pctByAuthor: Record<string, number>;
};

export type AnalyticsMarketShare = {
  authors: MarketShareAuthorRow[];
  /** Vertical stack segment order bottom → top (Flexbox column-reverse). */
  stackKeys: string[];
  daily: MarketShareDailyRow[];
  /** Total tokens in chart window (30 days); used as denominator for shares. */
  windowTotalTokens: number;
};

/** OpenRouter-style hues for common authors (see rankings “Market Share” tab). */
const AUTHOR_COLORS: Record<string, string> = {
  google: "#1a73e8",
  anthropic: "#14b8a6",
  deepseek: "#ff7c33",
  openai: "#f5a524",
  "meta-llama": "#f87356",
  mistralai: "#84cc16",
  qwen: "#2546d9",
  "x-ai": "#06b6d4",
  microsoft: "#d946ef",
  others: "#f472b6",
  // Common in Silk seed / catalogs
  moonshotai: "#0f766e",
  minimax: "#22bb5c",
  "z-ai": "#f4a7c1",
  nvidia: "#1d6f42",
  xiaomi: "#aabe2e",
};

const FALLBACK = ["#8b5cf6", "#0ea5e9", "#64748b", "#eab308", "#6366f1"];

function stableStringHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function authorColor(key: string): string {
  return AUTHOR_COLORS[key] ?? FALLBACK[stableStringHash(key) % FALLBACK.length];
}

const KNOWN_LABELS: Record<string, string> = {
  google: "google",
  anthropic: "anthropic",
  openai: "openai",
  deepseek: "deepseek",
  "meta-llama": "meta-llama",
  mistralai: "mistralai",
  qwen: "qwen",
  "x-ai": "x-ai",
  microsoft: "microsoft",
  others: "Others",
};

export function displayAuthorLabel(key: string): string {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];
  if (key === "moonshotai") return "moonshotai";
  return key;
}

/** Prefer provider.slug; otherwise infer OpenRouter-ish author from model identifiers. */
export function resolveModelAuthorKey(
  providerSlug: string | null | undefined,
  modelSlug: string | null | undefined,
  modelName: string
): string {
  const p = providerSlug?.toLowerCase().trim();
  if (p && p.length > 0) return p;

  const s = `${modelSlug ?? ""} ${modelName}`.toLowerCase();

  const rules: [RegExp, string][] = [
    [/(^|[\s/_-])(goog|gemini)|\bgemini\b|\bpalm\b/, "google"],
    [/anthropic|^claude|[-_]claude| claude\b/, "anthropic"],
    [/\bgpt[-_]|chatgpt|^gpt\b|[-_]gpt|openai|o\d[-_]?mini|[-_]openai\b/, "openai"],
    [/\bqwen\b|tongyi/, "qwen"],
    [/deepseek/, "deepseek"],
    [/mistral|^mistral|mixtral|codestral/, "mistralai"],
    [/\bllama[-_]|\bmeta[-_]?llama|meta['\s]s?\s*llama/i, "meta-llama"],
    [/minimax|ababa/, "minimax"],
    [/[-_]x[-_]ai|^x-ai|\bgrok\b|^grok-|[-_]xai\b|^xai\b(?![a-z])/, "x-ai"],
    [/^phi[-_]|\bmicrosoft\b|azure[-_]openai|[-_]gpt-4.?o[-_]mini\b.*azure/i, "microsoft"],
    [/\bz[-_]?ai\b|\bglm[-_]|chatglm|zhipu|^glm\b/, "z-ai"],
    [/xiaomi|\bmimo\b/, "xiaomi"],
    [/nvidia|nemotron/, "nvidia"],
    [/moonshot|kimi/i, "moonshotai"],
  ];

  for (const [re, key] of rules) {
    if (re.test(s)) return key;
  }

  return modelSlug?.split("-")[0]?.toLowerCase() || "unknown";
}
