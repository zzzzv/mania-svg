export interface Object {
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
  /** Start time in ms, defaults to 0 */
  start?: number;
  /** End time in ms, defaults to max object end time */
  end?: number;
  /** Note objects */
  objects: Object[];
  /** Timing points */
  timingPoints: TimingPoint[];
}

/** Note color identifiers used in options and key maps */
export enum colorId {
  /** note 1 */
  n1,
  /** note 2 */
  n2,
  /** middle note */
  mid,
  /** edge note for 9k/10k */
  edge,
}

const renderOptions = {
  /** Width of each column in px */
  objectWidth: 20,
  /** Height of regular notes in px */
  noteHeight: 6,
  /** Corner radius in px */
  rx: 2,
  /** Vertical scale: px per ms */
  timeScale: 0.1,
  /** Height of bar lines in px */
  barlineHeight: 1,

  /** Number of vertical strips to divide the timeline */
  stripNum: 8,
  /** Spacing between strips in px */
  stripSpacing: 20,
  /** Margin around the entire SVG in px */
  margin: 20,
  /** Final scale factor [x, y] applied to the entire SVG */
  scale: [1, 1] as [number, number],

  noteColors: {
    [colorId.n1]: '#FFFFFF', // white
    [colorId.n2]: '#5EAEFF', // light blue
    [colorId.mid]: '#FFEC5E', // yellow
    [colorId.edge]: '#FF3F00', // red
  } as Record<colorId, string>,
  barLineColor: '#85F000', // green
  backgroundColor: 'none', // transparent
  
  keys: {
    4: [colorId.n1, colorId.n2, colorId.n2, colorId.n1],
    5: [colorId.n1, colorId.n2, colorId.mid, colorId.n2, colorId.n1],
    6: [colorId.n1, colorId.n2, colorId.n1, colorId.n1, colorId.n2, colorId.n1],
    7: [colorId.n1, colorId.n2, colorId.n1, colorId.mid, colorId.n1, colorId.n2, colorId.n1],
    8: [colorId.n1, colorId.n2, colorId.n1, colorId.mid, colorId.mid, colorId.n1, colorId.n2, colorId.n1],
    9: [colorId.edge, colorId.n1, colorId.n2, colorId.n1, colorId.mid, colorId.n1, colorId.n2, colorId.n1, colorId.edge],
    10: [colorId.edge, colorId.n1, colorId.n2, colorId.n1, colorId.mid, colorId.mid, colorId.n1, colorId.n2, colorId.n1, colorId.edge],
  } as Record<number, colorId[]>,
}

type optionsType = typeof renderOptions;

export const render = (beatmap: Beatmap, optionsOverride: Partial<optionsType> = {}) => {
  const options = { ...renderOptions, ...optionsOverride };
  const builder = new SVGRenderer(beatmap, options);
  return builder.render();
}

export class SVGRenderer {
  beatmap: Beatmap;
  options: optionsType;

  start: number;
  end: number;
  
  get stripWidth(): number {
    return this.beatmap.keys * this.options.objectWidth;
  }

  get stripHeight(): number {
    return (this.end - this.start) / this.options.stripNum;
  }

  get baseWidth(): number {
    return this.stripWidth * this.options.stripNum + this.options.stripSpacing * (this.options.stripNum - 1) + this.options.margin * 2;
  }

  get baseHeight(): number {
    return this.stripHeight * this.options.timeScale + this.options.margin * 2;
  }

  get totalWidth(): number {
    return this.baseWidth * this.options.scale[0];
  }

  get totalHeight(): number {
    return this.baseHeight * this.options.scale[1];
  }

  constructor(beatmap: Beatmap, options: optionsType) {
    if (!options.keys?.[beatmap.keys]) {
      throw new Error(`Unsupported keys: ${beatmap.keys}`);
    }
    this.beatmap = beatmap;
    this.options = options;

    this.start = beatmap.start ?? 0;
    this.end = beatmap.end ?? beatmap.objects.reduce((max, note) => Math.max(max, note.end ?? note.start), this.start);
    this.end += 100; // extra padding
  }

  render(): string {
    const [scaleX, scaleY] = this.options.scale;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.totalWidth}" height="${this.totalHeight}">
  <defs>
    ${this.createClipPaths()}
    <g id="origin">
      ${this.createBarLineGroup()}
      ${this.createObjectGroup()}
    </g>
  </defs>
  ${this.createBackground()}
  <g transform="scale(${scaleX}, ${-scaleY}) translate(0, ${-this.baseHeight})">
    ${this.createStripGroup()}
  </g>
</svg>`;
    return svg;
  }

  protected createBackground(): string {
    const color = this.options.backgroundColor;
    return `<rect width="100%" height="100%" fill="${color}" />`;
  }

  protected translate(column: number, time: number): [number, number] {
    const x = column * this.options.objectWidth;
    const y = (time - this.start) * this.options.timeScale;
    return [x, y];
  }

  protected createObject(note: Object): string {
    const [x, y] = this.translate(note.column, note.start);
    const width = this.options.objectWidth;
    const height = note.end ? (note.end - note.start) * this.options.timeScale : this.options.noteHeight;
    const colorId = this.options.keys[this.beatmap.keys][note.column];
    const color = this.options.noteColors[colorId];

    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${this.options.rx}" fill="${color}" />`;
  }

  protected createObjectGroup(): string {
    const objects = this.beatmap.objects.map(note => this.createObject(note)).join('\n        ');
    return `<g id="objects">
        ${objects}
      </g>`;
  }

  protected createBarLine(time: number): string {
    const y = (time - this.start) * this.options.timeScale;
    const width = this.beatmap.keys * this.options.objectWidth;
    const height = 2; // px
    const color = this.options.barLineColor;

    return `<rect x="0" y="${y}" width="${width}" height="${height}" fill="${color}" />`;
  }

  protected createBarLineGroup(): string {
    const barLines: string[] = [];
    const timingPoints = [...this.beatmap.timingPoints].sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < timingPoints.length; i++) {
      const tp = timingPoints[i];
      const nextTime = i < timingPoints.length - 1 ? timingPoints[i + 1].time : this.end;
      const beatDuration = 60000 / tp.bpm; // ms per beat
      const barDuration = beatDuration * tp.meter; // ms per bar
      
      let currentTime = tp.time;
      while (currentTime < nextTime && currentTime <= this.end) {
        if (currentTime >= this.start) {
          barLines.push(this.createBarLine(currentTime));
        }
        currentTime += barDuration;
      }
    }
    
    return `<g id="barlines">
        ${barLines.join('\n        ')}
      </g>`;
  }

  protected createClipPath(id: string, y: number, height: number): string {
    return `<clipPath id="${id}">
      <rect x="0" y="${y}" width="${this.beatmap.keys * this.options.objectWidth}" height="${height}" />
    </clipPath>`;
  }

  protected createClipPaths(): string {
    const clipPaths: string[] = [];
    for (let i = 0; i < this.options.stripNum; i++) {
      const y = i * this.stripHeight * this.options.timeScale;
      const height = this.stripHeight * this.options.timeScale;
      clipPaths.push(this.createClipPath(`strip-${i}`, y, height));
    }
    return clipPaths.join('\n    ');
  }

  protected createStrip(i: number): string {
    const offsetX = this.options.margin + i * (this.stripWidth + this.options.stripSpacing);
    const offsetY = this.options.margin - i * this.stripHeight * this.options.timeScale;
      
    return `<use href="#origin" transform="translate(${offsetX}, ${offsetY})" clip-path="url(#strip-${i})" />`;
  }

  protected createStripGroup(): string {
    const strips = [];
    for (let i = 0; i < this.options.stripNum; i++) {
      strips.push(this.createStrip(i));
    }
    return `<g id="strips">
      ${strips.join('\n      ')}
    </g>`;
  }
}

