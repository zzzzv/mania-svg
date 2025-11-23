export interface Note {
  /** Column index (0-based) */
  column: number;
  /** Start time in milliseconds */
  start: number;
  /** End time in milliseconds, optional for hold notes */
  end?: number;
}

export interface TimingPoint {
  /** Time in milliseconds */
  time: number;
  /** Beats per minute */
  bpm: number;
  /** Time signature numerator (meter) */
  meter: number;
}

export interface Beatmap {
  /** Number of columns (keys) */
  keys: number;
  /** Note objects */
  objects: Note[];
  /** Timing points */
  timingPoints: TimingPoint[];
}

export const presetColorSchemes = [
  '#FFFFFF',
  '#5EAEFF',
  '#FFEC5E',
  '#FF3F00',
];

export const presetKeyLayouts = {
  4: [0, 1, 1, 0],
  5: [0, 1, 2, 1, 0],
  6: [0, 1, 0, 0, 1, 0],
  7: [0, 1, 0, 2, 0, 1, 0],
  8: [0, 1, 0, 2, 2, 0, 1, 0],
  9: [3, 0, 1, 0, 2, 0, 1, 0, 3],
  10: [3, 0, 1, 0, 2, 2, 0, 1, 0, 3],
};

export function createColorSelector(
  colors: readonly string[] = presetColorSchemes,
  layouts: Readonly<Record<number, readonly number[]>> = presetKeyLayouts
) {
  return (keys: number, object: Note) => {
    const layout = layouts[keys];
    if (!layout) {
      throw new Error(`Unsupported keys: ${keys}`);
    }
    const colorKey = layout[object.column];
    if (colorKey === undefined) {
      throw new Error(`Invalid column: ${object.column} for ${keys}K`);
    }
    return colors[colorKey];
  };
}

const defaultOptions = {
  background: {
    /** Whether to render background */
    enabled: true,
    /** Background color of the SVG */
    color: '#000000',
    /** Function to create SVG elements for the background */
    createElement: createBackground,
  },
  note: {
    /** Width of each column in px */
    width: 20,
    /** Height of regular notes in px */
    height: 6,
    /** Corner radius in px */
    rx: 2,
    /** Function to select color for each object */
    colorSelector: createColorSelector(),
    /** Function to create SVG elements for each object */
    createElement: createNote,
  },
  time: {
    /** Start time in ms */
    start: 'auto' as 'auto' | number,
    /** End time in ms */
    end: 'auto' as 'auto' | number,
    /** Vertical scale: px per ms */
    scale: 0.1,
  },
  barline: {
    /** Height of bar lines in px */
    height: 1,
    color: '#85F000', // green
    /** Function to create SVG elements for each bar line */
    createElement: createBarLine,
  },
  strip: {
    /**
     * Layout mode for strips
     * - 'num': specify number of strips
     * - 'time': specify time duration per strip
     * - 'ratio': specify target aspect ratio (width / height) to auto-calculate strip count (approximate)
    */
    mode: 'num' as 'num' | 'time' | 'ratio',
    /** Number of vertical strips to divide the timeline */
    num: 8 as number | undefined,
    /** Time duration per strip in ms */
    time: 30000 as number | undefined,
    /** Target aspect ratio (width / height), actual ratio may vary slightly */
    ratio: 1.5 as number | undefined,
    /** Spacing between strips in px */
    spacing: 30,
  },
  layout: {
    /**
     * Margin around the entire SVG in px [horizontal, vertical]
     * When targetSize is set, this value serves as the minimum margin
     * and will be automatically adjusted to meet the target size requirements
     */
    margin: [10, 10] as [number, number],
    /**
     * Maximum scale factor applied to the entire SVG
     * When targetSize is set:
     * - Will be automatically reduced (if needed) to prevent content from exceeding targetSize
     * - After scaling, margin will be adjusted to exactly meet targetSize requirements
     */
    finalScale: 1.0 as number,
    /**
     * Target size [width, height] for the final SVG
     * When set, the SVG will be adjusted to fit this size by:
     * 1. Reducing finalScale (if needed) to prevent content from exceeding targetSize
     * 2. Adjusting margin (using the margin value as minimum) to exactly meet targetSize
     */
    targetSize: undefined as [number, number] | undefined,
  },
};

export type Options = typeof defaultOptions;

function resolveOptions(beatmap: Beatmap, options: Options) {
  const MAX_STRIP_NUM = 50;
  const MIN_TARGET_DIM = 32;
  const MAX_TARGET_DIM = 20000;
  const MAX_RATIO = 20;

  let start = options.time.start === 'auto' ?
    Math.max(0, beatmap.timingPoints[0].time) :
    options.time.start;

  let end = options.time.end === 'auto' ?
    beatmap.objects.reduce((max, note) => Math.max(max, note.end ?? note.start), start) :
    options.time.end;
  end += options.note.height / options.time.scale;

  const computeLayout = (stripNum: number) => {
    const stripWidth = beatmap.keys * options.note.width;
    const stripHeight = (end - start) * options.time.scale / stripNum;
    const contentWidth = stripNum * stripWidth + (stripNum - 1) * options.strip.spacing;
    const contentHeight = stripHeight;
    const totalWidth = options.layout.margin[0] * 2 + contentWidth;
    const totalHeight = options.layout.margin[1] * 2 + contentHeight;
    return [stripWidth, stripHeight, contentWidth, contentHeight, totalWidth, totalHeight];
  }

  let stripNum: number;

  if (options.strip.mode === 'num') {
    if (options.strip.num === undefined) {
      throw new Error('Strip num must be specified when strip mode is "num"');
    }
    if (options.strip.num <= 0 || options.strip.num > MAX_STRIP_NUM) {
      throw new Error(`Invalid strip.num: must be in (0, ${MAX_STRIP_NUM}]`);
    }
    stripNum = options.strip.num;
  } else if (options.strip.mode === 'time') {
    if (options.strip.time === undefined) {
      throw new Error('Strip time must be specified when strip mode is "time"');
    }
    if (options.strip.time <= 0) {
      throw new Error('Invalid strip.time: must be a positive number');
    }
    stripNum = Math.ceil((end - start) / options.strip.time);
    stripNum = Math.min(stripNum, MAX_STRIP_NUM);
    if (stripNum <= 0) {
      throw new Error('Computed strip number is zero; check strip.time and time range');
    }
    end = start + stripNum * options.strip.time;
  } else if (options.strip.mode === 'ratio') {
    if (options.strip.ratio === undefined) {
      throw new Error('Strip ratio must be specified when strip mode is "ratio"');
    }
    if (options.strip.ratio <= 0) {
      throw new Error('Invalid strip.ratio: must be a positive number');
    }
    if (options.strip.ratio > MAX_RATIO) {
      throw new Error(`strip.ratio is too large; maximum allowed is ${MAX_RATIO}`);
    }
    stripNum = 1;
    let lastRatio = 0;

    while (stripNum <= MAX_STRIP_NUM) {
      const [,,,, totalWidth, totalHeight] = computeLayout(stripNum);
      const currentRatio = totalWidth / totalHeight;
      if (currentRatio >= options.strip.ratio) {
        if (options.strip.ratio - lastRatio < currentRatio - options.strip.ratio) {
          stripNum -= 1;
        }
        break;
      }
      stripNum++;
      lastRatio = currentRatio;
    }
  } else {
    throw new Error(`Unsupported strip mode: ${options.strip.mode}`);
  }

  let [stripWidth, stripHeight, contentWidth, contentHeight, totalWidth, totalHeight] = computeLayout(stripNum);
  let finalScale = options.layout.finalScale;
  let margin = [...options.layout.margin] as [number, number];

  if (options.layout.targetSize) {
    let [targetWidth, targetHeight] = options.layout.targetSize;

    if (targetWidth < MIN_TARGET_DIM || targetWidth > MAX_TARGET_DIM ||
        targetHeight < MIN_TARGET_DIM || targetHeight > MAX_TARGET_DIM) {
      throw new Error(`layout.targetSize dimensions must be within [${MIN_TARGET_DIM}, ${MAX_TARGET_DIM}]`);
    }

    // Calculate maximum scale to prevent content from exceeding target size
    const scaleX = targetWidth / totalWidth;
    const scaleY = targetHeight / totalHeight;
    
    // Reduce finalScale if it would exceed target size
    finalScale = Math.min(finalScale, scaleX, scaleY);

    // Adjust margin to exactly meet target size
    margin[0] = Math.max(margin[0], (targetWidth / finalScale - contentWidth) / 2);
    margin[1] = Math.max(margin[1], (targetHeight / finalScale - contentHeight) / 2);
    
    totalWidth = margin[0] * 2 + contentWidth;
    totalHeight = margin[1] * 2 + contentHeight;
  }

  return {
    beatmap,
    ...options,
    time: {
      start,
      end,
      scale: options.time.scale,
    },
    strip: {
      num: stripNum,
      width: stripWidth,
      height: stripHeight,
      spacing: options.strip.spacing,
    },
    margin,
    totalWidth,
    totalHeight,
    finalScale,
  }
}

export type Context = ReturnType<typeof resolveOptions>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target } as T;
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (sourceValue !== undefined) {
        if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue) &&
            typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
          result[key] = deepMerge(targetValue, sourceValue as DeepPartial<any>);
        } else {
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
  }
  
  return result;
}

function times(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function render(beatmap: Beatmap, optionsOverride: DeepPartial<Options> = {}): string {
  const options = deepMerge(defaultOptions, optionsOverride);
  const ctx = resolveOptions(beatmap, options);

  const notes = beatmap.objects.flatMap(note => ctx.note.createElement(ctx, note));

  const barLines = generateBarLinePositions(beatmap.timingPoints, ctx.time.start, ctx.time.end)
    .flatMap(time => ctx.barline.createElement(ctx, time));

  const clipPaths = times(ctx.strip.num).flatMap(i => createClipPath(ctx, i));

  const strips = times(ctx.strip.num).flatMap(i => createStrip(ctx, i));
  
  const background = ctx.background.enabled ? ctx.background.createElement(ctx) : [];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.totalWidth * ctx.finalScale}" height="${ctx.totalHeight * ctx.finalScale}">
  <defs>
    <g id="origin">
      <g id="notes">
        ${notes.join('\n        ')}
      </g>
      <g id="barlines">
        ${barLines.join('\n        ')}
      </g>
    </g>
    <g id="clip-paths">
      ${clipPaths.join('\n      ')}
    </g>
  </defs>
  ${background.join('\n  ')}
  <g transform="scale(${ctx.finalScale}, ${-ctx.finalScale}) translate(${ctx.margin[0]}, ${-ctx.totalHeight + ctx.margin[1]})">
    ${strips.join('\n    ')}
  </g>
</svg>`;
  return svg;
}

function createBackground(ctx: Context): string[] {
  const color = ctx.background.color;
  return [`<rect width="100%" height="100%" fill="${color}" />`];
}

function createNote(ctx: Context, note: Note): string[] {
  const x = note.column * ctx.note.width;
  const y = (note.start - ctx.time.start) * ctx.time.scale;
  const width = ctx.note.width;
  const height = note.end ? (note.end - note.start) * ctx.time.scale : ctx.note.height;
  const color = ctx.note.colorSelector(ctx.beatmap.keys, note);
  return [`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${ctx.note.rx}" fill="${color}" />`];
}

function createBarLine(ctx: Context, time: number): string[] {
  const y = (time - ctx.time.start) * ctx.time.scale;
  const width = ctx.beatmap.keys * ctx.note.width;
  const height = ctx.barline.height;
  const color = ctx.barline.color;

  return [`<rect x="0" y="${y}" width="${width}" height="${height}" fill="${color}" />`];
}

/**
 * Generate bar line positions for the given timing points and time range
 */
export function generateBarLinePositions(
  timingPoints: readonly TimingPoint[],
  start: number,
  end: number
): number[] {
  const sorted = [...timingPoints].sort((a, b) => a.time - b.time);
  const result: number[] = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const tp = sorted[i];
    const nextTime = i < sorted.length - 1 ? sorted[i + 1].time : end;
    const beatDuration = 60000 / tp.bpm;
    const barDuration = beatDuration * tp.meter;
    
    for (let currentTime = tp.time; currentTime < nextTime && currentTime <= end; currentTime += barDuration) {
      if (currentTime >= start) {
        result.push(currentTime);
      }
    }
  }
  
  return result;
}

function createClipPath(ctx: Context, stripIndex: number): string[] {
  const y = stripIndex * ctx.strip.height

  return [
    `<clipPath id="strip-${stripIndex}">`,
    `  <rect x="0" y="${y}" width="${ctx.strip.width}" height="${ctx.strip.height}" />`,
    `</clipPath>`];
}

function createStrip(ctx: Context, i: number): string[] {
  const offsetX = i * (ctx.strip.width + ctx.strip.spacing);
  const offsetY = -i * ctx.strip.height;
    
  return [`<use href="#origin" transform="translate(${offsetX}, ${offsetY})" clip-path="url(#strip-${i})" />`];
}
