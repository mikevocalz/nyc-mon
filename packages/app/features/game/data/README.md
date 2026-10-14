# Harlem Apollo sample

A small offline OpenStreetMap extract around the Apollo Theater and West 125th Street. This is real map geometry, not the decorative generated city background. It is not a five-borough map, routing service, safety map or authoritative building survey.

Data © OpenStreetMap contributors, distributed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OSM copyright and attribution requirements](https://www.openstreetmap.org/copyright). Any map surface must visibly display the attribution and license link. This data license is separate from the code license.

The JSON records the source query and retrieval timestamp. Stable way IDs retain provenance. Editor identities, edit history, contact details and unrelated tags are excluded. Geometry outside the query rectangle is retained where OSM returns the complete crossing way. The runtime parser separately enforces the small tile radius.

Building heights use the OSM height tag where present. Missing heights use tagged levels × 3m or a 9m estimate. Untagged road widths use an explicit road-class estimate. Every fallback is listed in dimensionEstimates; those dimensions must not be presented as measured facts. Relations, holes and multipolygons are not compiled by this first slice.

Reproduce from a saved XML extract with tooling/city/compile-osm.py, supplying the recorded source URL and timestamp. Do not poll the editing API from the app or use it as a runtime map backend.
