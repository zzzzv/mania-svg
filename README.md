# Mania SVG Renderer

A TypeScript library for rendering osu!mania beatmaps to SVG format with vertical strip layout.

<img src="https://raw.githubusercontent.com/zzzzv/mania-svg/main/tests/output.svg" alt="Example Output" width="400">

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

const svg = render(data, {backgroundColor: '#000000'});
```

**Type definitions and options:** See [source code](https://github.com/zzzzv/mania-svg/blob/main/src/index.ts).

## TODO

- [ ] **Auto-sizing**: Automatically determine `stripNum` and `scale` based on target width/height

  ```typescript
  render(data, { targetWidth: 1920, targetHeight: 1080 })
  ```

## License

MIT
