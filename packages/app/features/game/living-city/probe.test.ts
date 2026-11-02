import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCityDataset } from '../city-dataset.ts';
import { buildLaneTopology } from './topology.ts';

test('probe ACP', () => {
  const dataset = parseCityDataset(JSON.parse(readFileSync(new URL('../data/harlem-apollo.json', import.meta.url), 'utf8')));
  const topo = buildLaneTopology(dataset);
  const acp = topo.nodes.find((n) => n.names.includes('ADAM CLAYTON POWELL JR BLVD') && n.names.includes('W 125 ST'))!;
  console.log('NODE', acp.id, 'kind', acp.kind, 'legs', acp.legs.length, 'x,z', acp.x.toFixed(1), acp.z.toFixed(1));
  acp.legs.forEach((l, i) => console.log(` leg${i} az=${(l.azimuth * 180 / Math.PI).toFixed(1)} name=${l.name} w=${l.widthMeters} roads=${l.roadIds.join(',')}`));
  const ins = topo.lanesTo.get(acp.id) ?? [];
  const outs = topo.lanesFrom.get(acp.id) ?? [];
  console.log('IN LANES', ins.length, 'OUT', outs.length);
  for (const l of ins) console.log(' IN', l.id, 'road', l.roadId, 'len', l.lengthMeters.toFixed(1), 'dir', l.dir, 'ow', l.oneway, 'laneIdx', l.laneIndex, 'internal', l.internal, 'from', l.from.slice(0, 44));
  for (const l of outs) console.log(' OUT', l.id, 'road', l.roadId, 'len', l.lengthMeters.toFixed(1), 'ow', l.oneway, 'internal', l.internal, 'to', l.to.slice(0, 44));
  const conns = topo.connectors.filter((c) => c.node === acp.id);
  console.log('CONNS', conns.length);
  const xw = topo.xwalks.filter((x) => x.node === acp.id);
  for (const x of xw) console.log(' XWALK', x.id.slice(acp.id.length + 7), 'leg', x.leg, 'len', x.lengthMeters.toFixed(1), x.backing);
});
