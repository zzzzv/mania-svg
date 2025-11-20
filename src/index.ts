import { merge, times, flatMap } from 'lodash-es';

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
  object: {
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
    */
    mode: 'num' as 'num' | 'time',
    /** Number of vertical strips to divide the timeline */
    num: 8 as number | undefined,
    /** Time duration per strip in ms */
    time: 10000 as number | undefined,
    /** Spacing between strips in px */
    spacing: 30,
  },
  /** Margin around the entire SVG in px */
  margin: 10,
  /** Final scale factor [x, y] applied to the entire SVG */
  finalScale: [1, 1] as [number, number],
};

export type Options = typeof defaultOptions;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function createContext(beatmap: Beatmap, optionsOverride: DeepPartial<Options> = {}) {
  const options = merge({}, defaultOptions, optionsOverride);

  let ctx = {
    beatmap,
    options,
    start: 0,
    end: 0,
    stripNum: 0,
    stripWidth: 0,
    stripHeight: 0,
    totalWidth: 0,
    totalHeight: 0,
  };

  ctx.start = options.time.start === 'auto' ?
    Math.max(0, beatmap.timingPoints[0].time) :
    options.time.start;

  ctx.end = options.time.end === 'auto' ?
    beatmap.objects.reduce((max, note) => Math.max(max, note.end ?? note.start), ctx.start) :
    options.time.end;
  ctx.end += 100; // extra padding at the end

  if (options.strip.mode === 'num') {
    if (options.strip.num === undefined) {
      throw new Error('Strip num must be specified when strip mode is "num"');
    }
    ctx.stripNum = options.strip.num;
    ctx.stripWidth = beatmap.keys * options.object.width;
    ctx.stripHeight = (ctx.end - ctx.start) * options.time.scale / ctx.stripNum;
  } else if (options.strip.mode === 'time') {
    if (options.strip.time === undefined) {
      throw new Error('Strip time must be specified when strip mode is "time"');
    }
    ctx.stripNum = Math.ceil((ctx.end - ctx.start) / options.strip.time);
    ctx.end = ctx.start + ctx.stripNum * options.strip.time;
  } else {
    throw new Error(`Unsupported strip mode: ${options.strip.mode}`);
  }

  ctx.stripWidth = beatmap.keys * options.object.width;
  ctx.stripHeight = (ctx.end - ctx.start) * options.time.scale / ctx.stripNum;
  ctx.totalWidth = options.margin * 2 + ctx.stripNum * ctx.stripWidth + (ctx.stripNum - 1) * options.strip.spacing;
  ctx.totalHeight = options.margin * 2 + ctx.stripHeight;
  
  return ctx;
}

export type Context = ReturnType<typeof createContext>;

export function render(beatmap: Beatmap, optionsOverride: DeepPartial<Options> = {}): string {
  const ctx = createContext(beatmap, optionsOverride);

  const notes = flatMap(beatmap.objects, note => ctx.options.object.createElement(ctx, note));

  const barLines = generateBarLinePositions(beatmap.timingPoints, ctx.start, ctx.end)
    .flatMap(time => ctx.options.barline.createElement(ctx, time));

  const clipPaths = flatMap(times(ctx.stripNum), i => createClipPath(ctx, i));

  const strips = flatMap(times(ctx.stripNum), i => createStrip(ctx, i));

  const background = ctx.options.background.enabled ? ctx.options.background.createElement(ctx) : [];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.totalWidth * ctx.options.finalScale[0]}" height="${ctx.totalHeight * ctx.options.finalScale[1]}">
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
  <g transform="scale(${ctx.options.finalScale[0]}, ${-ctx.options.finalScale[1]}) translate(0, ${-ctx.totalHeight})">
    ${strips.join('\n    ')}
  </g>
</svg>`;
  return svg;
}

function createBackground(ctx: Context): string[] {
  const color = ctx.options.background.color;
  return [`<rect width="100%" height="100%" fill="${color}" />`];
}

function createNote(ctx: Context, note: Note): string[] {
  const x = note.column * ctx.options.object.width;
  const y = (note.start - ctx.start) * ctx.options.time.scale;
  const width = ctx.options.object.width;
  const height = note.end ? (note.end - note.start) * ctx.options.time.scale : ctx.options.object.height;
  const color = ctx.options.object.colorSelector(ctx.beatmap.keys, note);

  return [`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${ctx.options.object.rx}" fill="${color}" />`];
}

function createBarLine(ctx: Context, time: number): string[] {
  const y = (time - ctx.start) * ctx.options.time.scale;
  const width = ctx.beatmap.keys * ctx.options.object.width;
  const height = ctx.options.barline.height;
  const color = ctx.options.barline.color;

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
  const y = stripIndex * ctx.stripHeight
  const width = ctx.beatmap.keys * ctx.options.object.width;

  return [
    `<clipPath id="strip-${stripIndex}">`,
    `  <rect x="0" y="${y}" width="${width}" height="${ctx.stripHeight}" />`,
    `</clipPath>`];
}

function createStrip(ctx: Context, i: number): string[] {
  const offsetX = ctx.options.margin + i * (ctx.stripWidth + ctx.options.strip.spacing);
  const offsetY = ctx.options.margin - i * ctx.stripHeight;
    
  return [`<use href="#origin" transform="translate(${offsetX}, ${offsetY})" clip-path="url(#strip-${i})" />`];
}
