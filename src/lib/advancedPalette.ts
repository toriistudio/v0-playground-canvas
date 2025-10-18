import type { ControlsSchema } from "@/context/ControlsContext";

export type PaletteChannelKey = "r" | "g" | "b";

export type AdvancedPaletteSection = {
  key: string;
  label: string;
  helper?: string;
};

export type AdvancedPaletteValue = Record<PaletteChannelKey, number>;

export type AdvancedPalette = Record<string, AdvancedPaletteValue>;

export type AdvancedPaletteRange = {
  min: number;
  max: number;
  step: number;
};

export type AdvancedPaletteRanges = Record<string, AdvancedPaletteRange>;

export const CHANNEL_KEYS: PaletteChannelKey[] = ["r", "g", "b"];

export const DEFAULT_CHANNEL_LABELS: Record<PaletteChannelKey, string> = {
  r: "Red",
  g: "Green",
  b: "Blue",
};

export const DEFAULT_SECTIONS: AdvancedPaletteSection[] = [
  { key: "A", label: "Vector A", helper: "Base offset" },
  { key: "B", label: "Vector B", helper: "Amplitude" },
  { key: "C", label: "Vector C", helper: "Frequency" },
  { key: "D", label: "Vector D", helper: "Phase shift" },
];

export const DEFAULT_RANGES: AdvancedPaletteRanges = {
  A: { min: 0, max: 1, step: 0.01 },
  B: { min: -1, max: 1, step: 0.01 },
  C: { min: 0, max: 2, step: 0.01 },
  D: { min: 0, max: 1, step: 0.01 },
};

export const DEFAULT_HIDDEN_KEY_PREFIX = "palette";

export const DEFAULT_GRADIENT_STEPS = 12;

export const createPaletteControlKey = (
  prefix: string,
  section: string,
  channel: PaletteChannelKey
) => `${prefix}${section}${channel}`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const toNumberOr = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const paletteColorAt = (palette: AdvancedPalette, t: number) => {
  const twoPi = Math.PI * 2;
  const computeChannel = (
    a: number,
    b: number,
    c: number,
    d: number
  ): number => {
    const value = a + b * Math.cos(twoPi * (c * t + d));
    return clamp(value, 0, 1);
  };

  return {
    r: computeChannel(
      palette.A?.r ?? 0,
      palette.B?.r ?? 0,
      palette.C?.r ?? 0,
      palette.D?.r ?? 0
    ),
    g: computeChannel(
      palette.A?.g ?? 0,
      palette.B?.g ?? 0,
      palette.C?.g ?? 0,
      palette.D?.g ?? 0
    ),
    b: computeChannel(
      palette.A?.b ?? 0,
      palette.B?.b ?? 0,
      palette.C?.b ?? 0,
      palette.D?.b ?? 0
    ),
  };
};

const toRgba = (
  { r, g, b }: { r: number; g: number; b: number },
  alpha = 0.5
) =>
  `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255
  )}, ${alpha})`;

export const computePaletteGradient = (
  palette: AdvancedPalette,
  steps: number = DEFAULT_GRADIENT_STEPS
) => {
  const stops = Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    const color = paletteColorAt(palette, t);
    const stop = (t * 100).toFixed(1);
    return `${toRgba(color)} ${stop}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
};

export const createPaletteSignature = (palette: AdvancedPalette) =>
  Object.entries(palette)
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .flatMap(([, channels]) =>
      CHANNEL_KEYS.map((channel) => (channels?.[channel] ?? 0).toFixed(3))
    )
    .join("-");

export const clonePalette = (palette: AdvancedPalette): AdvancedPalette =>
  Object.fromEntries(
    Object.entries(palette).map(([sectionKey, channels]) => [
      sectionKey,
      { ...channels },
    ])
  ) as AdvancedPalette;

export type AdvancedPaletteControlConfig = {
  defaultPalette: AdvancedPalette;
  sections?: AdvancedPaletteSection[];
  ranges?: AdvancedPaletteRanges;
  channelLabels?: Partial<Record<PaletteChannelKey, string>>;
  hiddenKeyPrefix?: string;
  controlKey?: string;
  gradientSteps?: number;
  onPaletteChange?: (palette: AdvancedPalette) => void;
  onInteraction?: () => void;
  folder?: string;
  folderPlacement?: "top" | "bottom";
};

export type ResolvedAdvancedPaletteConfig = AdvancedPaletteControlConfig & {
  sections: AdvancedPaletteSection[];
  ranges: AdvancedPaletteRanges;
  channelLabels: Record<PaletteChannelKey, string>;
  hiddenKeyPrefix: string;
  controlKey: string;
  gradientSteps: number;
};

const createDefaultSectionsFromPalette = (
  palette: AdvancedPalette
): AdvancedPaletteSection[] => {
  const sectionKeys = Object.keys(palette);
  if (sectionKeys.length === 0) return DEFAULT_SECTIONS;

  return sectionKeys.map((key, index) => ({
    key,
    label: `Vector ${key}`,
    helper: DEFAULT_SECTIONS[index]?.helper ?? "Palette parameter",
  }));
};

export const resolveAdvancedPaletteConfig = (
  config: AdvancedPaletteControlConfig
): ResolvedAdvancedPaletteConfig => {
  const sections =
    config.sections ?? createDefaultSectionsFromPalette(config.defaultPalette);

  const ranges: AdvancedPaletteRanges = {};
  sections.forEach((section) => {
    ranges[section.key] =
      config.ranges?.[section.key] ??
      DEFAULT_RANGES[section.key] ?? {
        min: 0,
        max: 1,
        step: 0.01,
      };
  });

  const channelLabels: Record<PaletteChannelKey, string> = {
    ...DEFAULT_CHANNEL_LABELS,
    ...(config.channelLabels ?? {}),
  };

  return {
    ...config,
    sections,
    ranges,
    channelLabels,
    hiddenKeyPrefix: config.hiddenKeyPrefix ?? DEFAULT_HIDDEN_KEY_PREFIX,
    controlKey: config.controlKey ?? "advancedPaletteControl",
    gradientSteps: config.gradientSteps ?? DEFAULT_GRADIENT_STEPS,
  };
};

export const createAdvancedPaletteSchemaEntries = (
  schema: ControlsSchema,
  resolvedConfig: ResolvedAdvancedPaletteConfig
): ControlsSchema => {
  const { sections, hiddenKeyPrefix, defaultPalette } = resolvedConfig;

  const updatedSchema: ControlsSchema = { ...schema };

  sections.forEach((section) => {
    CHANNEL_KEYS.forEach((channel) => {
      const key = createPaletteControlKey(
        hiddenKeyPrefix,
        section.key,
        channel
      );

      if (!(key in updatedSchema)) {
        updatedSchema[key] = {
          type: "number",
          value:
            defaultPalette?.[section.key]?.[channel] ??
            DEFAULT_RANGES[section.key]?.min ??
            0,
          hidden: true,
        };
      }
    });
  });

  return updatedSchema;
};
