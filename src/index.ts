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

const renderOptions = {
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
    createElement: createObject,
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
    /** Number of vertical strips to divide the timeline */
    num: 8,
    /** Spacing between strips in px */
    spacing: 20,
  },
  /** Margin around the entire SVG in px */
  margin: 20,
  /** Final scale factor [x, y] applied to the entire SVG */
  finalScale: [1, 1] as [number, number],
}

export type OptionsType = typeof renderOptions;

export type ResolvedOptionsType = Omit<OptionsType, 'time'> & {
  time: {
    start: number;
    end: number;
    scale: number;
  };
};

export type RenderContext = {
  beatmap: Beatmap;
  options: ResolvedOptionsType;

  stripWidth: number;
  stripHeight: number;
}

function createContext(beatmap: Beatmap, optionsOverride: Partial<OptionsType> = {}) {
  const options = merge({}, renderOptions, optionsOverride);

  if (options.time.start === 'auto') {
    options.time.start = Math.max(0, beatmap.timingPoints[0].time) ;
  }
  if (options.time.end === 'auto') {
    options.time.end = beatmap.objects.reduce((max, note) => Math.max(max, note.end ?? note.start), options.time.start);
  }
  options.time.end += 100; // extra padding

  const stripWidth = beatmap.keys * options.object.width;
  const stripHeight = (options.time.end - options.time.start) * options.time.scale / options.strip.num;
  
  return {
    beatmap, 
    options: options as ResolvedOptionsType, 
    stripWidth,
    stripHeight,
    totalWidth: options.margin * 2 + options.strip.num * stripWidth + (options.strip.num - 1) * options.strip.spacing,
    totalHeight: options.margin * 2 + stripHeight,
  };
}

export function render(beatmap: Beatmap, optionsOverride: Partial<OptionsType> = {}): string {
  const ctx = createContext(beatmap, optionsOverride);

  const objects = flatMap(beatmap.objects, note => ctx.options.object.createElement(ctx, note));

  const barLines = generateBarLinePositions(beatmap.timingPoints, ctx.options.time.start, ctx.options.time.end)
    .flatMap(time => ctx.options.barline.createElement(ctx, time));

  const clipPaths = flatMap(times(ctx.options.strip.num), i => createClipPath(ctx, i));

  const strips = flatMap(times(ctx.options.strip.num), i => createStrip(ctx, i));

  const background = ctx.options.background.enabled ? ctx.options.background.createElement(ctx) : [];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.totalWidth * ctx.options.finalScale[0]}" height="${ctx.totalHeight * ctx.options.finalScale[1]}">
  <defs>
    <g id="origin">
      <g id="objects">
        ${objects.join('\n        ')}
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

export function createBackground(ctx: RenderContext): string[] {
  const color = ctx.options.background.color;
  return [`<rect width="100%" height="100%" fill="${color}" />`];
}

export function createObject(ctx: RenderContext, note: Note): string[] {
  const x = note.column * ctx.options.object.width;
  const y = (note.start - ctx.options.time.start) * ctx.options.time.scale;
  const width = ctx.options.object.width;
  const height = note.end ? (note.end - note.start) * ctx.options.time.scale : ctx.options.object.height;
  const color = ctx.options.object.colorSelector(ctx.beatmap.keys, note);

  return [`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${ctx.options.object.rx}" fill="${color}" />`];
}

export function createBarLine(ctx: RenderContext, time: number): string[] {
  const y = (time - ctx.options.time.start) * ctx.options.time.scale;
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

export function createClipPath(ctx: RenderContext, stripIndex: number): string[] {
  const y = stripIndex * ctx.stripHeight
  const width = ctx.beatmap.keys * ctx.options.object.width;

  return [
    `<clipPath id="strip-${stripIndex}">`,
    `  <rect x="0" y="${y}" width="${width}" height="${ctx.stripHeight}" />`,
    `</clipPath>`];
}

export function createStrip(ctx: RenderContext, i: number): string[] {
  const offsetX = ctx.options.margin + i * (ctx.stripWidth + ctx.options.strip.spacing);
  const offsetY = ctx.options.margin - i * ctx.stripHeight;
    
  return [`<use href="#origin" transform="translate(${offsetX}, ${offsetY})" clip-path="url(#strip-${i})" />`];
}
