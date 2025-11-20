import { test } from 'vitest'
import fs from 'fs'
import { BeatmapDecoder } from 'osu-parsers'
import { ManiaRuleset, Hold } from 'osu-mania-stable';
import { render, type Beatmap } from '../src'

test('render', async () => {
  const decoder = new BeatmapDecoder()
  const parsed = await decoder.decodeFromPath('./tests/7kln9g.osu', false);
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

  const svg = render(data, {strip: { mode: 'time' }, finalScale: [0.8, 0.8]});
  fs.writeFileSync('./tests/output.svg', svg);
})
