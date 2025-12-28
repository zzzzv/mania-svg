import { test } from 'vitest'
import fs from 'fs'
import { BeatmapDecoder } from 'osu-parsers'
import { ManiaRuleset, Hold } from 'osu-mania-stable';
import { render, type Beatmap } from '../src'

test('render', async () => {
  const decoder = new BeatmapDecoder()
  const parsed = await decoder.decodeFromPath('./tests/7kln10i.osu', false);
  const ruleset = new ManiaRuleset();
  const mania = ruleset.applyToBeatmap(parsed);

  const data: Beatmap = {
    keys: mania.totalColumns,
    notes: mania.hitObjects.map(obj => ({
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

  const svg = render(data, {
    // strip: {
    //   mode: 'ratio',
    //   ratio: 1.5
    // },
    // layout: {
    //   finalScale: 1,
    //   targetSize: [1200, 1000],
    // }
  });
  fs.writeFileSync('./tests/output.svg', svg);
})
