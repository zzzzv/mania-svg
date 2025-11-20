# Mania SVG Renderer

A TypeScript library for rendering osu!mania beatmaps to SVG format with vertical strip layout.

<img src="https://raw.githubusercontent.com/zzzzv/mania-svg/main/assets/output.svg" alt="Example Output" width="400">

## Installation

```bash
pnpm add mania-svg
```

## Usage

**Note:** This package does not include .osu file parsing. You need to choose your own parser library.

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

const svg = render(data);
```

## Options

<!-- OPTIONS:START -->
```typescript
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
    */
    mode: 'num' as 'num' | 'time',
    /** Number of vertical strips to divide the timeline */
    num: 8 as number | undefined,
    /** Time duration per strip in ms */
    time: 30000 as number | undefined,
    /** Spacing between strips in px */
    spacing: 30,
  },
  /** Margin around the entire SVG in px */
  margin: 10,
  /** Final scale factor [x, y] applied to the entire SVG */
  finalScale: [1, 1] as [number, number],
};
```
<!-- OPTIONS:END -->

## TODO

- [ ] **Auto-sizing**: Automatically determine `stripNum` and `scale` based on target width/height

  ```typescript
  render(data, { targetWidth: 1920, targetHeight: 1080 })
  ```

## License

MIT
