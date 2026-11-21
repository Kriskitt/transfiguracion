"""Measure the untouched Illustrator SVG with only Python's standard library.

Run from this experiment: python3 analysis/analyze.py
Polyline lengths, areas, curvature, and intersections are numerical estimates.
"""

from collections import Counter, defaultdict
from hashlib import sha256
from math import atan2, ceil, degrees, hypot, pi
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "outline-01.svg"
TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?")


def parse_path(data):
    tokens = TOKEN.findall(data)
    index, command, current, start = 0, None, (0.0, 0.0), None
    subpaths, active = [], None
    counts = Counter()

    def numbers(count):
        nonlocal index
        values = [float(value) for value in tokens[index:index + count]]
        if len(values) != count:
            raise ValueError("Incomplete path command")
        index += count
        return values

    while index < len(tokens):
        if tokens[index].isalpha():
            command = tokens[index]
            index += 1
        counts[command] += 1
        relative = command.islower()
        kind = command.upper()
        if kind == "M":
            x, y = numbers(2)
            current = (current[0] + x, current[1] + y) if relative else (x, y)
            start = current
            active = {"start": current, "segments": [], "closed": False}
            subpaths.append(active)
            command = "l" if relative else "L"
        elif kind == "C":
            values = numbers(6)
            if relative:
                c1 = (current[0] + values[0], current[1] + values[1])
                c2 = (current[0] + values[2], current[1] + values[3])
                end = (current[0] + values[4], current[1] + values[5])
            else:
                c1, c2, end = tuple(values[:2]), tuple(values[2:4]), tuple(values[4:])
            active["segments"].append(("C", current, c1, c2, end))
            current = end
        elif kind == "L":
            x, y = numbers(2)
            end = (current[0] + x, current[1] + y) if relative else (x, y)
            active["segments"].append(("L", current, end))
            current = end
        elif kind == "Z":
            if current != start:
                active["segments"].append(("L", current, start))
            current = start
            active["closed"] = True
            command = None
        else:
            raise ValueError(f"Unexpected SVG command: {command}")
    return subpaths, counts


def point(segment, t):
    if segment[0] == "L":
        a, b = segment[1:]
        return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    _, a, b, c, d = segment
    u = 1 - t
    return (u**3 * a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t**3*d[0],
            u**3 * a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t**3*d[1])


def derivative(segment, t):
    _, a, b, c, d = segment
    u = 1 - t
    return (3*u*u*(b[0]-a[0]) + 6*u*t*(c[0]-b[0]) + 3*t*t*(d[0]-c[0]),
            3*u*u*(b[1]-a[1]) + 6*u*t*(c[1]-b[1]) + 3*t*t*(d[1]-c[1]))


def second_derivative(segment, t):
    _, a, b, c, d = segment
    return (6*(1-t)*(c[0]-2*b[0]+a[0]) + 6*t*(d[0]-2*c[0]+b[0]),
            6*(1-t)*(c[1]-2*b[1]+a[1]) + 6*t*(d[1]-2*c[1]+b[1]))


def round2(value):
    return round(value, 2)


def measure_subpath(subpath):
    samples = [subpath["start"]]
    length = 0.0
    turns = []
    curvature = []
    controls = []
    for segment in subpath["segments"]:
        steps = max(6, ceil(hypot(segment[-1][0]-segment[1][0], segment[-1][1]-segment[1][1]) / 4))
        previous = samples[-1]
        for step in range(1, steps + 1):
            next_point = point(segment, step / steps)
            length += hypot(next_point[0]-previous[0], next_point[1]-previous[1])
            samples.append(next_point)
            previous = next_point
        if segment[0] == "C":
            controls.append([list(segment[1]), list(segment[2]), list(segment[3]), list(segment[4])])
            for t in (0.25, 0.5, 0.75):
                dx, dy = derivative(segment, t)
                ddx, ddy = second_derivative(segment, t)
                speed = hypot(dx, dy)
                if speed > 1e-7:
                    curvature.append(abs(dx*ddy-dy*ddx) / speed**3)
            a = derivative(segment, 0)
            b = derivative(segment, 1)
            difference = atan2(a[0]*b[1]-a[1]*b[0], a[0]*b[0]+a[1]*b[1])
            turns.append(abs(degrees(difference)))
    xs, ys = zip(*samples)
    area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(samples, samples[1:])) / 2
    return {
        "start": [round2(x) for x in subpath["start"]],
        "closed": subpath["closed"],
        "cubicCount": len(controls),
        "lineCount": len(subpath["segments"]) - len(controls),
        "sampledLength": round2(length),
        "signedArea": round2(area),
        "bounds": [round2(min(xs)), round2(min(ys)), round2(max(xs)), round2(max(ys))],
        "medianCubicTurnDegrees": round2(sorted(turns)[len(turns)//2]) if turns else 0,
        "medianAbsCurvature": round(sorted(curvature)[len(curvature)//2], 6) if curvature else 0,
        "controls": controls,
        "samples": samples,
    }


def intersection(a, b, c, d):
    x1, y1 = a; x2, y2 = b; x3, y3 = c; x4, y4 = d
    den = (x2-x1)*(y4-y3)-(y2-y1)*(x4-x3)
    if abs(den) < 1e-10:
        return None
    t = ((x3-x1)*(y4-y3)-(y3-y1)*(x4-x3))/den
    u = ((x3-x1)*(y2-y1)-(y3-y1)*(x2-x1))/den
    if 1e-5 < t < 1-1e-5 and 1e-5 < u < 1-1e-5:
        return (x1+t*(x2-x1), y1+t*(y2-y1))
    return None


def crossings(measures):
    segments = []
    for path_index, path in enumerate(measures):
        for sub_index, sub in enumerate(path):
            points = sub["samples"]
            segments.extend((path_index, sub_index, i, points[i], points[i+1]) for i in range(len(points)-1))
    buckets = defaultdict(list)
    for index, (_, _, _, a, b) in enumerate(segments):
        for gx in range(int(min(a[0], b[0])//24), int(max(a[0], b[0])//24)+1):
            for gy in range(int(min(a[1], b[1])//24), int(max(a[1], b[1])//24)+1):
                buckets[(gx, gy)].append(index)
    checked, hits = set(), []
    for ids in buckets.values():
        for i, left in enumerate(ids):
            p, s, step, a, b = segments[left]
            for right in ids[i+1:]:
                key = (min(left, right), max(left, right))
                if key in checked: continue
                checked.add(key)
                q, t, other_step, c, d = segments[right]
                if p == q and s == t and abs(step-other_step) <= 1: continue
                hit = intersection(a, b, c, d)
                if hit: hits.append(hit)
    return hits


def main():
    source = SOURCE.read_bytes()
    root = ET.fromstring(source)
    paths = root.findall(".//{*}path")
    measured = []
    all_subpaths = []
    for path in paths:
        subpaths, counts = parse_path(path.get("d"))
        metrics = [measure_subpath(sub) for sub in subpaths]
        all_subpaths.append(metrics)
        measured.append({
            "commands": dict(counts),
            "subpathCount": len(metrics),
            "closedSubpathCount": sum(m["closed"] for m in metrics),
            "cubicCount": sum(m["cubicCount"] for m in metrics),
            "lineCount": sum(m["lineCount"] for m in metrics),
            "sampledLength": round2(sum(m["sampledLength"] for m in metrics)),
            "subpaths": [{key: value for key, value in m.items() if key not in ("controls", "samples")}
                         for m in metrics],
        })
    hits = crossings(all_subpaths)
    big = all_subpaths[1][0]
    curves = [segment for sub in parse_path(paths[1].get("d"))[0] for segment in sub["segments"] if segment[0] == "C"]
    curve_lengths = []
    curve_turns = []
    curvatures = []
    for segment in curves:
        points = [point(segment, i / 16) for i in range(17)]
        curve_lengths.append(sum(hypot(b[0]-a[0], b[1]-a[1]) for a, b in zip(points, points[1:])))
        outgoing, incoming = derivative(segment, 0), derivative(segment, 1)
        if hypot(*outgoing) > 1e-7 and hypot(*incoming) > 1e-7:
            curve_turns.append(abs(degrees(atan2(outgoing[0]*incoming[1]-outgoing[1]*incoming[0],
                                                  outgoing[0]*incoming[0]+outgoing[1]*incoming[1]))))
        for t in (0.25, 0.5, 0.75):
            dx, dy = derivative(segment, t)
            ddx, ddy = second_derivative(segment, t)
            speed = hypot(dx, dy)
            if speed > 1e-7:
                curvatures.append(abs(dx*ddy-dy*ddx) / speed**3)
    chord = [hypot(s[-1][0]-s[1][0], s[-1][1]-s[1][1]) for s in curves]
    handle = [(hypot(s[2][0]-s[1][0], s[2][1]-s[1][1]),
               hypot(s[3][0]-s[4][0], s[3][1]-s[4][1])) for s in curves]
    controls = {
        "medianChord": round2(sorted(chord)[len(chord)//2]),
        "medianFirstHandle": round2(sorted(x[0] for x in handle)[len(handle)//2]),
        "medianSecondHandle": round2(sorted(x[1] for x in handle)[len(handle)//2]),
        "nearZeroChordCount": sum(x < 1 for x in chord),
        "examples": [[list(p) for p in segment[1:]] for segment in curves[::max(1, len(curves)//8)][:8]],
    }
    joins = []
    for sub in parse_path(paths[1].get("d"))[0]:
        for left, right in zip(sub["segments"], sub["segments"][1:]):
            if left[0] != "C" or right[0] != "C": continue
            a = (left[4][0]-left[3][0], left[4][1]-left[3][1])
            b = (right[2][0]-right[1][0], right[2][1]-right[1][1])
            if hypot(*a) < 1e-7 or hypot(*b) < 1e-7: continue
            joins.append(abs(degrees(atan2(a[0]*b[1]-a[1]*b[0], a[0]*b[0]+a[1]*b[1]))))
    controls["medianAdjacentTangentAngleDegrees"] = round2(sorted(joins)[len(joins)//2])
    inner = all_subpaths[1][1:]
    overlapping_bounds = sum(
        a["bounds"][0] < b["bounds"][2] and b["bounds"][0] < a["bounds"][2] and
        a["bounds"][1] < b["bounds"][3] and b["bounds"][1] < a["bounds"][3]
        for i, a in enumerate(inner) for b in inner[i+1:])
    all_points = [xy for path in all_subpaths for sub in path for xy in sub["samples"]]
    xs, ys = zip(*all_points)
    geometry = {
        "source": "references/outline-01.svg",
        "sha256": sha256(source).hexdigest(),
        "measured": {
            "viewBox": [float(x) for x in root.get("viewBox").split()],
            "pathCount": len(paths),
            "style": root.find("{*}style").text.strip(),
            "paths": measured,
            "allSampledBounds": [round2(min(xs)), round2(min(ys)), round2(max(xs)), round2(max(ys))],
            "mainOuterSubpathBounds": big["bounds"],
            "mainOuterSubpathLength": big["sampledLength"],
            "cubicLengthQuantiles": {str(q): round2(sorted(curve_lengths)[round((len(curve_lengths)-1)*q)])
                                   for q in (0, 0.25, 0.5, 0.75, 0.9, 1)},
            "cubicTurnDegreesQuantiles": {str(q): round2(sorted(curve_turns)[round((len(curve_turns)-1)*q)])
                                        for q in (0.25, 0.5, 0.75, 0.9)},
            "absoluteCurvatureInverseUnitsQuantiles": {str(q): round(sorted(curvatures)[round((len(curvatures)-1)*q)], 6)
                                                    for q in (0.25, 0.5, 0.75, 0.9)},
            "controlPointRelationships": controls,
            "loopContours": {
                "positiveAreaCount": sum(sub["signedArea"] > 0 for sub in all_subpaths[1]),
                "outerNegativeAreaCount": sum(sub["signedArea"] < 0 for sub in all_subpaths[1]),
                "innerWidthMedian": round2(sorted(sub["bounds"][2]-sub["bounds"][0] for sub in all_subpaths[1][1:])[25]),
                "innerHeightMedian": round2(sorted(sub["bounds"][3]-sub["bounds"][1] for sub in all_subpaths[1][1:])[25]),
                "innerCentroidXBands240": [sum(lo <= (sub["bounds"][0]+sub["bounds"][2])/2 < lo+240 for sub in all_subpaths[1][1:]) for lo in range(0,1920,240)],
                "approxNetSignedArea": round2(sum(sub["signedArea"] for sub in all_subpaths[1])),
                "overlappingInnerBoundingBoxPairs": overlapping_bounds,
            },
            "sampledBoundaryCrossings": {
                "count": len(hits),
                "examples": [[round2(x), round2(y)] for x, y in hits[:24]],
                "method": "Polyline sampled at <=4-unit endpoint chord intervals, grid-indexed; approximate boundary intersections, not centerline crossings",
            },
            "crossingBands": [sum(lo <= x < hi for x, _ in hits) for lo, hi in zip(range(0,1920,240), range(240,2160,240))],
            "sampledYBands": [sum(lo <= y < lo+90 for _, y in all_points) for lo in range(0,1080,90)],
        },
        "inferredRules": {
            "status": "hypotheses from one exported artwork, not the original authoring procedure",
            "construction": "Long connected gestural centerlines with elliptical excursions and smooth tangent bridges; render as narrow white ribbons with fine black edges",
            "loopDistribution": "One broad left loop, middle overlapping loops, denser right group; variable radii and directional reversals",
            "responsive": "Keep horizontal sequence on wide screens; recompose related gestures into stacked bands on portrait screens",
        },
    }
    (ROOT / "analysis" / "geometry.json").write_text(json.dumps(geometry, indent=2) + "\n")
    print("paths", len(paths), "subpaths", [p["subpathCount"] for p in measured],
          "cubics", [p["cubicCount"] for p in measured], "crossings", len(hits))
    print("bounds", geometry["measured"]["allSampledBounds"], "length", [p["sampledLength"] for p in measured])


if __name__ == "__main__":
    main()
