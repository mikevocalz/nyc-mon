#!/usr/bin/env python3
"""Compile a small, previously downloaded OSM XML extract. No network or editor metadata."""
import argparse
import json
import math
import pathlib
import re
import xml.etree.ElementTree as ET


def compile_extract(raw, source_url, retrieved_at):
    if len(raw) > 2_000_000 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Unsupported or oversized XML extract')
    root = ET.fromstring(raw)
    nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])] for n in root.findall('node')}
    features = []
    estimates = []
    for way in root.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        if tags.get('building') in (None, 'no') and 'highway' not in tags:
            continue
        points = [nodes.get(n.attrib['ref']) for n in way.findall('nd')]
        if any(p is None for p in points):
            raise ValueError(f"Incomplete way {way.attrib['id']}")
        feature = {'id': f"osm:way:{way.attrib['id']}", 'points': points}
        if tags.get('building') not in (None, 'no'):
            if len(points) < 4 or points[0] != points[-1]:
                raise ValueError(f"Open building {feature['id']}; relations require a separate compiler")
            height = tags.get('height', '')
            if re.fullmatch(r'\d+(\.\d+)?\s*m?', height):
                value = float(height.rstrip('m').strip())
            else:
                levels = tags.get('building:levels', '')
                valid_levels = bool(re.fullmatch(r'\d+(\.\d+)?', levels))
                value = float(levels) * 3 if valid_levels else 9
                estimates.append({'id': feature['id'], 'field': 'heightMeters', 'method': 'levels × 3m' if valid_levels else '9m fallback'})
            if not math.isfinite(value) or not 0 < value <= 1000:
                raise ValueError('Invalid building height')
            feature.update(kind='building', heightMeters=value)
        else:
            width = tags.get('width', '')
            if re.fullmatch(r'\d+(\.\d+)?\s*m?', width):
                value = float(width.rstrip('m').strip())
            else:
                value = {'primary': 14, 'residential': 8, 'service': 4, 'footway': 2}.get(tags['highway'], 6)
                estimates.append({'id': feature['id'], 'field': 'widthMeters', 'method': f"{tags['highway']} class estimate"})
            if not math.isfinite(value) or not 0 < value <= 100:
                raise ValueError('Invalid road width')
            feature.update(kind='road', widthMeters=value)
        features.append(feature)
    features.sort(key=lambda f: f['id'])
    return {
        'version': 1, 'id': 'harlem-apollo-20261014', 'origin': [-73.94975, 40.81005],
        'source': {'url': source_url, 'attribution': '© OpenStreetMap contributors', 'license': 'ODbL-1.0', 'retrievedAt': retrieved_at},
        'dimensionEstimates': estimates, 'features': features,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=pathlib.Path)
    parser.add_argument('destination', type=pathlib.Path)
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--retrieved-at', required=True)
    args = parser.parse_args()
    data = compile_extract(args.source.read_bytes(), args.source_url, args.retrieved_at)
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print(f"Compiled {len(data['features'])} features; {len(data['dimensionEstimates'])} explicitly estimated dimensions")
