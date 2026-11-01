"""Clips for one egg: egg_idle, hatch, attention_lean_in, attention_hesitate.

`hatch` covers stir → pressure → crack → burst → emerge as one timeline whose
phase ranges come from the manifest, so the runtime can seek straight to the
start of any saved phase. Attention outcomes are separate clips.
"""
import math

import numpy as np
from mathutils import Euler, Quaternion, Vector

from common import deg, ease, frame, keys, merge_clip, rng


def _q(axis, degrees):
    return Quaternion(Vector(axis), math.radians(degrees))


def _shard_rest(info, slide):
    out = Vector((math.cos(math.radians(info["azimuth"])), math.sin(math.radians(info["azimuth"])), 0))
    return Vector(info["hinge"]) + out * slide + Vector((0, 0, info["restDrop"]))


def _shard_rest_centre(ob, info, slide):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    c = Vector(co.reshape(-1, 3).mean(axis=0))
    return _q(info["axis"], info["restAngle"]) @ c + _shard_rest(info, slide)


def plan(manifest, shard_info):
    """Frames and per-shard roles shared by the goo builder and the animator."""
    t = manifest["timing"]
    ph = {k: (frame(manifest, a), frame(manifest, b)) for k, (a, b) in t["phases"].items()}
    c0, c1 = ph["crack"]
    beats = [round(c0 + (c1 - c0) * b) for b in t["crackBeats"]]
    shards = [i for i in shard_info if i["cell"] > 0]
    # The three shards facing the Caller (Blender -Y) crack first, in that order.
    shards.sort(key=lambda i: abs(((i["azimuth"] + 90 + 180) % 360) - 180))
    return {"phases": ph, "beats": beats, "crackers": shards[:3], "others": [i for i in shard_info if i["cell"] >= 0 and i not in shards[:3]]}


def burst_angle(info, p, beat_index):
    """Angle a cracking shard reaches at the start and end of `burst`."""
    small = 4.5 + 1.5 * (2 - beat_index) if beat_index is not None else 0.0
    return small, info["restAngle"] * 0.55


def shard_angle_at(info, p, beat_index, t):
    """Opening angle during burst at fraction t (strands use the same curve)."""
    a, b = burst_angle(info, p, beat_index)
    return a + (b - a) * ease(t)


def animate_hatch(manifest, root, pieces, shard_info, membrane, drips, strands, puddle, baby, landing):
    p = plan(manifest, shard_info)
    s0, s1 = p["phases"]["stir"]
    _, pr1 = p["phases"]["pressure"]
    c0, c1 = p["phases"]["crack"]
    b0, b1 = p["phases"]["burst"]
    e0, e1 = p["phases"]["emerge"]
    r = rng(manifest, "wobble")

    # Root: asymmetric, low-amplitude interior shoves that build through pressure and crack.
    wobble = [(s0, (0, 0))]
    for f in np.linspace(s0 + 6, s1, 4):
        wobble.append((int(f), (r.uniform(-0.8, 0.8), r.uniform(-0.6, 0.6))))
    for f in np.linspace(s1 + 5, pr1, 4):
        wobble.append((int(f), (r.uniform(-2.0, 2.0), r.uniform(-1.6, 1.6))))
    for bt in p["beats"]:
        wobble += [(bt, (r.uniform(-2.5, 2.5), r.uniform(-2.5, 2.5))), (bt + 4, (r.uniform(-0.8, 0.8), r.uniform(-0.8, 0.8)))]
    wobble.append((b0, (0, 0)))
    root.rotation_mode = "XYZ"
    keys(root, "rotation_euler", sorted((f, Euler((deg(x), deg(y), 0))) for f, (x, y) in wobble))

    # Membrane: breathing glow, a local press at the first crack, then it tears away.
    sk = membrane.data.shape_keys.key_blocks
    keys(sk["Pulse"], "value", [(s0, 0), (s0 + 15, 0.4), (s1, 0.1), (s1 + 12, 0.8), (pr1, 1.0), (p["beats"][0], 0.6), (b0, 0.4), (b0 + 12, 0)])
    keys(sk["Press"], "value", [(s1, 0), (pr1, 1), (p["beats"][0], 0.3), (b0, 0)])
    keys(membrane, "scale", [(b0, (1, 1, 1)), (b0 + 12, (0.6, 0.6, 0.6)), (e0 + 6, (0.0001, 0.0001, 0.0001))])

    # Shards: three dimensional cracks, then the shell parts and the pieces settle on the ground.
    for ob in pieces:
        ob.rotation_mode = "QUATERNION"
    by_name = {o.name: o for o in pieces}
    for idx, info in enumerate(p["crackers"]):
        ob = by_name[info["name"]]
        ax = info["axis"]
        bt = p["beats"][idx]
        small, open_b = burst_angle(info, p, idx)
        frames = [(s0, 0), (bt, 0), (bt + 2, small * 0.75), (bt + 5, small * 0.6)]
        for later in p["beats"][idx + 1:]:
            frames += [(later, small * 0.6), (later + 3, small)]
        frames += [(b0, small), (b1, open_b), (e0 + 18, info["restAngle"] + 4), (e0 + 24, info["restAngle"])]
        keys(ob, "rotation_quaternion", [(f, _q(ax, a)) for f, a in frames])
        hinge = Vector(info["hinge"])
        keys(ob, "location", [(s0, hinge), (e0 + 6, hinge), (e0 + 24, _shard_rest(info, 0.012))])
    for info in p["others"]:
        ob = by_name[info["name"]]
        hinge = Vector(info["hinge"])
        keys(ob, "rotation_quaternion", [(s0, _q(info["axis"], 0)), (b0 + 3, _q(info["axis"], 0)), (b1, _q(info["axis"], info["restAngle"] * 0.45)),
                                          (e0 + 20, _q(info["axis"], info["restAngle"] + 3)), (e0 + 26, _q(info["axis"], info["restAngle"]))])
        keys(ob, "location", [(s0, hinge), (e0 + 8, hinge), (e0 + 26, _shard_rest(info, 0.008))])

    # Goo: each drip beads on its crack lip right after its beat and creeps down before the shell parts.
    for idx, d in enumerate(drips):
        bt = p["beats"][idx]
        kb = d.data.shape_keys.key_blocks
        keys(kb["Bead"], "value", [(s0, 0), (bt + 3, 0), (bt + 12, 1), (bt + 22, 0)])
        keys(kb["Ooze_1"], "value", [(s0, 0), (bt + 12, 0), (bt + 24, 1), (bt + 38, 0)])
        keys(kb["Ooze_2"], "value", [(s0, 0), (bt + 24, 0), (bt + 38, 1), (bt + 56, 0)])
        keys(kb["Ooze_3"], "value", [(s0, 0), (bt + 38, 0), (min(bt + 70, e1), 1)])
    for st in strands:
        kb = st.data.shape_keys.key_blocks
        span = b1 - b0
        f1, f2, f3 = b0 + round(span / 3), b0 + round(2 * span / 3), b1
        keys(kb["Stretch_1"], "value", [(s0, 0), (b0, 0), (f1, 1), (f2, 0)])
        keys(kb["Stretch_2"], "value", [(s0, 0), (f1, 0), (f2, 1), (f3, 0)])
        keys(kb["Stretch_3"], "value", [(s0, 0), (f2, 0), (f3, 1), (f3 + 4, 0)])
        keys(kb["Snap"], "value", [(s0, 0), (f3, 0), (f3 + 4, 1)])
        keys(st, "scale", [(f3 + 4, (1, 1, 1)), (e0 + 20, (0.0001, 0.0001, 0.0001))])
    keys(puddle.data.shape_keys.key_blocks["Spread"], "value", [(s0, 0), (p["beats"][1] + 30, 0), (e1, 1)])

    # Baby (proxy): stirs inside, nudges the crown, slips, struggles out over the rim, lands, breathes.
    body, head, eyes = baby["body"], baby["head"], baby["eyes"]
    inside = Vector((0, 0, 0.012))
    land = Vector(landing)
    rim_z = 0.09
    keys(body, "location", [(s0, inside), (b0, inside), (b0 + 6, inside + Vector((0, 0, 0.018))), (b1 + 2, inside + Vector((0, -0.004, 0.034))),
                            (e0 + 4, inside + Vector((0, 0, 0.02))), (e0 + 18, inside + Vector((0, -0.01, 0.05))),
                            (e0 + 26, Vector((land.x * 0.3, land.y * 0.3, rim_z))), (e0 + 33, Vector((land.x * 0.75, land.y * 0.75, 0.045))),
                            (e0 + 38, land), (e1, land)])
    keys(body, "rotation_euler", [(s0, Euler((0, 0, 0))), (s0 + 15, Euler((deg(4), 0, deg(6)))), (s1 + 10, Euler((deg(-3), 0, deg(-8)))),
                                  (b0, Euler((0, 0, 0))), (e0 + 4, Euler((deg(-8), 0, 0))), (e0 + 12, Euler((deg(12), 0, deg(10)))),
                                  (e0 + 18, Euler((deg(-6), 0, deg(-8)))), (e0 + 30, Euler((deg(18), 0, 0))), (e0 + 38, Euler((deg(-4), 0, 0))),
                                  (e1, Euler((0, 0, 0)))])
    keys(body, "scale", [(e0 + 38, (1, 1, 1)), (e0 + 40, (1.06, 1.06, 0.9)), (e0 + 44, (1, 1, 1)),
                         (e1 - 10, (1, 1, 1)), (e1 - 5, (1.04, 1.04, 1.0)), (e1, (1, 1, 1))])
    keys(head, "rotation_euler", [(s0, Euler((0, 0, 0))), (e0 + 38, Euler((deg(8), 0, deg(-10)))), (e1, Euler((deg(-6), 0, 0)))])
    for e in eyes:
        keys(e, "scale", [(s0, (1, 1, 1)), (e1 - 8, (1, 1, 1)), (e1 - 6, (1, 1, 0.12)), (e1 - 3, (1, 1, 1))])
    return p


def animate_idle(manifest, root, membrane):
    r = rng(manifest, "idle")
    n = frame(manifest, 2.0)
    keys(root, "rotation_euler", [(0, Euler((0, 0, 0))), (n // 3, Euler((deg(r.uniform(-0.6, 0.6)), deg(r.uniform(-0.4, 0.4)), 0))),
                                   (2 * n // 3, Euler((deg(r.uniform(-0.4, 0.4)), deg(r.uniform(-0.6, 0.6)), 0))), (n, Euler((0, 0, 0)))])
    keys(membrane.data.shape_keys.key_blocks["Pulse"], "value", [(0, 0), (n // 2, 0.35), (n, 0)])


def animate_attention(manifest, baby, landing, hide_behind, outcome):
    body, head = baby["body"], baby["head"]
    land = Vector(landing)
    if outcome == "lean_in":
        n = frame(manifest, 1.5)
        keys(body, "location", [(0, land), (n, land + Vector((0, -0.006, 0)))])
        keys(body, "rotation_euler", [(0, Euler((0, 0, 0))), (n // 2, Euler((deg(12), 0, 0))), (n, Euler((deg(9), 0, 0)))])
        keys(head, "rotation_euler", [(0, Euler((deg(-6), 0, 0))), (n // 2, Euler((deg(4), 0, deg(8)))), (n, Euler((0, 0, 0)))])
    else:
        n = frame(manifest, 2.0)
        hide = Vector(hide_behind)
        keys(body, "location", [(0, land), (n // 3, hide), (n, hide)])
        keys(body, "scale", [(0, (1, 1, 1)), (n // 3, (1, 1, 0.9)), (n, (1, 1, 0.9))])
        keys(body, "rotation_euler", [(0, Euler((0, 0, 0))), (n // 3, Euler((deg(-6), 0, deg(-25)))), (2 * n // 3, Euler((deg(-4), deg(10), deg(-18)))), (n, Euler((deg(-6), 0, deg(-25))))])
        keys(head, "rotation_euler", [(0, Euler((0, 0, 0))), (n // 3, Euler((0, deg(-12), 0))), (2 * n // 3, Euler((deg(4), deg(16), deg(12)))), (n, Euler((0, deg(-12), 0)))])


def pick_landing(pieces, shard_info, slide=0.012):
    """A spot in front of the egg, away from every resting shard."""
    by = {o.name: o for o in pieces}
    rests = [_shard_rest_centre(by[i["name"]], i, slide) for i in shard_info if i["cell"] >= 0]
    # Same spot for every egg (front right of the Caller's view) unless a
    # resting shard is in the way; then the clearest nearby spot.
    def clearance(pt):
        return min((Vector((c.x, c.y, 0)) - pt).length for c in rests)

    preferred = Vector((math.cos(math.radians(-50)) * 0.13, math.sin(math.radians(-50)) * 0.13, 0))
    best, best_d = preferred, clearance(preferred)
    if best_d < 0.05:
        for az in np.linspace(-80, -20, 13):
            for rad in (0.12, 0.14):
                pt = Vector((math.cos(math.radians(az)) * rad, math.sin(math.radians(az)) * rad, 0))
                if clearance(pt) > best_d:
                    best, best_d = pt, clearance(pt)
    # Hesitation hides behind the largest shell piece, the cup, on the side
    # away from the Caller (Blender +Y), offset so the face can peek out.
    hide = Vector((0.03, 0.07, 0.0))
    return best, hide, best_d


def stash(owners, clip):
    return merge_clip(owners, clip)
