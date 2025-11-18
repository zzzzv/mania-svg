# Mania SVG Renderer

A TypeScript library for rendering osu!mania beatmaps to SVG format with vertical strip layout.

![Example Output](https://raw.githubusercontent.com/zzzzv/mania-svg/main/tests/output.svg)

## Installation

```bash
pnpm add mania-svg
```

## Usage

**Note:** This package does not include osu! file parsing. You need to choose your own parser library.

The following example uses [`osu-parsers`](https://github.com/kionell/osu-parsers) and [`osu-mania-stable`](https://github.com/kionell/osu-mania-stable):

```typescript
import { BeatmapDecoder } from 'osu-parsers'
import { ManiaRuleset, Hold } from 'osu-mania-stable';
import { render, type Beatmap } from 'mania-svg';

const decoder = new BeatmapDecoder()
const parsed = await decoder.decodeFromPath('test.osu', false);
const ruleset = new ManiaRuleset();
const mania = ruleset.applyToBeatmap(parsed);

const data: Beatmap = {
  keys: mania.difficulty.circleSize,
  objects: mania.hitObjects.map(obj => ({
    start: obj.startTime,
    end: obj instanceof Hold ? obj.endTime : undefined,
    column: obj.column,
  })),
  timingPoints: mania.controlPoints.timingPoints.map(tp => ({
    time: tp.startTime,
    bpm: tp.bpm,
    meter: tp.timeSignature,
  })),
};

const svg = render(data, {backgroundColor: '#000000'});
```

## API

### `render(beatmap: Beatmap, options?: Partial<RenderOptions>): string`

Renders a beatmap to SVG string.

#### Beatmap Interface

```typescript
interface Beatmap {
  keys: number;              // Number of columns (4-10)
  start?: number;            // Start time in ms (default: 0)
  end?: number;              // End time in ms (default: auto-calculated)
  objects: Object[];         // Notes and hold notes
  timingPoints: TimingPoint[]; // Timing information
}

interface Object {
  column: number;  // Column index (0-based)
  start: number;   // Start time in ms
  end?: number;    // End time in ms (for hold notes)
}

interface TimingPoint {
  time: number;  // Time in ms
  bpm: number;   // Beats per minute
  meter: number; // Time signature numerator
}
```

#### Render Options

```typescript
{
  // Layout
  objectWidth: 20,      // Width of each column in px
  noteHeight: 6,        // Height of regular notes in px
  rx: 2,                // Corner radius in px
  timeScale: 0.1,       // Vertical scale: px per ms
  barlineHeight: 1,     // Height of bar lines in px

  // Strip Layout
  stripNum: 8,          // Number of vertical strips
  stripSpacing: 20,     // Spacing between strips in px
  margin: 20,           // Margin around the entire SVG in px
  scale: [1, 1],        // Final scale factor [x, y]

  // Colors
  noteColors: {
    n1: '#FFFFFF',      // Primary note color (white)
    n2: '#5EAEFF',      // Secondary note color (blue)
    mid: '#FFEC5E',     // Middle note color (yellow)
    edge: '#FF3F00'     // Edge note color (red, for 9k/10k)
  },
  barLineColor: '#85F000',    // Bar line color (green)
  backgroundColor: 'none',     // Background color (transparent)

  // Key-specific color patterns (auto-applied based on beatmap.keys)
  keys: {
    4: [n1, n2, n2, n1],
    5: [n1, n2, mid, n2, n1],
    // ... up to 10 keys
  }
}
```

## TODO

- [ ] **Auto-sizing**: Automatically determine `stripNum` and `scale` based on target width/height

  ```typescript
  render(data, { targetWidth: 1920, targetHeight: 1080 })
  ```

## License

MIT
