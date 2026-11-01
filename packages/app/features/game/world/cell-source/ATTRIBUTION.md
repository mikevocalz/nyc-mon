# Hosted cell data: ODbL notice

Every cell the on-demand source can serve (the keys of `data/vd-cells-manifest.ts`) is a derivative work of
OpenStreetMap data baked by `tooling/city/vd-port/*`. Hosted copies remain under the Open Database License
(ODbL 1.0); the produced-works attribution obligation follows them.

Required in the host/deployment proposal (handled by the parent agent, not this lane):

- a visible credit: "© OpenStreetMap contributors, ODbL 1.0" wherever the streamed city is described;
- the cells offered under ODbL with a copy of the license or a link to it (opendatacommons.org/licenses/odbl);
- keep the manifest's sha256/byteLength pins in the served payloads so the license text stays attached to the data.
