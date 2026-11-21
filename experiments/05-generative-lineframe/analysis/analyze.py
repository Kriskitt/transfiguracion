"""Measure the untouched lineframe SVG; standard library only.

`python3 analysis/analyze.py` writes geometry.json. `--check` verifies it.
Curve extrema, lengths and negative-space counts use sampled cubics.
"""

from collections import Counter, defaultdict
from hashlib import sha256
from math import hypot
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "lineframe-05.svg"
OUTPUT = ROOT / "analysis" / "geometry.json"
TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?")


def parse_path(data):
    tokens = TOKEN.findall(data)
    index, command, current, start = 0, None, (0.0, 0.0), None
    segments = []
    subpaths = 0

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
        kind, relative = command.upper(), command.islower()
        if kind == "M":
            x, y = numbers(2)
            current = (current[0] + x, current[1] + y) if relative else (x, y)
            start = current
            subpaths += 1
            command = "l" if relative else "L"
        elif kind == "L":
            x, y = numbers(2)
            end = (current[0] + x, current[1] + y) if relative else (x, y)
            segments.append(("L", current, end))
            current = end
        elif kind == "C":
            values = numbers(6)
            controls = [tuple(values[:2]), tuple(values[2:4]), tuple(values[4:])]
            if relative:
                controls = [(current[0] + x, current[1] + y) for x, y in controls]
            segments.append(("C", current, *controls))
            current = controls[-1]
        elif kind == "Z":
            if current != start:
                segments.append(("L", current, start))
            current, command = start, None
        else:
            raise ValueError(f"Unsupported command: {command}")
    return segments, subpaths


def at(segment, t):
    if segment[0] == "L":
        a, b = segment[1:]
        return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    _, a, b, c, d = segment
    u = 1 - t
    return (u**3*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t**3*d[0],
            u**3*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t**3*d[1])


def quantiles(values):
    if not values:
        return {}
    ordered = sorted(values)
    return {str(q): round(ordered[round((len(ordered)-1)*q)], 3)
            for q in (0, .25, .5, .75, 1)}


def bounds(points):
    return [round(min(p[0] for p in points), 3), round(min(p[1] for p in points), 3),
            round(max(p[0] for p in points), 3), round(max(p[1] for p in points), 3)]


def side_for(cx, cy, box):
    width, height = box[2]-box[0], box[3]-box[1]
    if width > height * 1.4:
        return "top" if cy < 540 else "bottom"
    if height > width * 1.4:
        return "left" if cx < 960 else "right"
    return "interior"


def analyze():
    source = SOURCE.read_bytes()
    root = ET.fromstring(source)
    paths = root.findall(".//{*}path")
    parsed = []
    signatures = defaultdict(list)
    all_points = []
    command_counts = Counter()
    handle_lengths, chord_lengths, bends = [], [], []
    for index, element in enumerate(paths):
        data = element.get("d")
        command_counts.update(re.findall(r"[A-Za-z]", data))
        segments, subpaths = parse_path(data)
        points = [at(segment, t) for segment in segments for t in (0, .25, .5, .75, 1)]
        all_points.extend(points)
        box = bounds(points)
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        origin = segments[0][1]
        signature = tuple((segment[0], tuple(round(v - origin[axis], 1)
            for point in segment[2:] for axis, v in enumerate(point))) for segment in segments)
        signatures[signature].append(index)
        parsed.append({"index": index, "segments": segments, "subpaths": subpaths,
                       "bounds": box, "center": [cx, cy], "side": side_for(cx, cy, box),
                       "regular": len(segments) == 6})
        for segment in segments:
            if segment[0] != "C":
                continue
            a, c1, c2, b = segment[1:]
            chord = hypot(b[0]-a[0], b[1]-a[1])
            chord_lengths.append(chord)
            handle_lengths.extend((hypot(c1[0]-a[0], c1[1]-a[1]),
                                   hypot(b[0]-c2[0], b[1]-c2[1])))
            if chord > 0:
                bends.append(max(abs((b[0]-a[0])*(at(segment, t)[1]-a[1]) -
                                     (b[1]-a[1])*(at(segment, t)[0]-a[0])) / chord
                                 for t in (.25, .5, .75)))
    sides = {}
    for name in ("top", "right", "bottom", "left"):
        entries = [p for p in parsed if p["side"] == name and p["regular"]]
        axis = 0 if name in ("top", "bottom") else 1
        centers = sorted(p["center"][axis] for p in entries)
        pitch = [b-a for a, b in zip(centers, centers[1:])]
        sides[name] = {
            "count": len(entries),
            "bounds": bounds([(p["bounds"][0], p["bounds"][1]) for p in entries] +
                             [(p["bounds"][2], p["bounds"][3]) for p in entries]),
            "widthQuantiles": quantiles([p["bounds"][2]-p["bounds"][0] for p in entries]),
            "heightQuantiles": quantiles([p["bounds"][3]-p["bounds"][1] for p in entries]),
            "centerPitchQuantiles": quantiles(pitch),
        }
    families = [{"count": len(indices), "representativePath": indices[0],
                 "segmentCount": len(parsed[indices[0]]["segments"])}
                for indices in sorted(signatures.values(), key=len, reverse=True)]
    representative = parsed[0]
    center = representative["center"]
    template = [{"type": segment[0], "points": [
        [round(point[0]-center[0], 3), round(point[1]-center[1], 3)]
        for point in segment[1:]]} for segment in representative["segments"]]
    empty = [p for p in all_points if 50 < p[0] < 1870 and 50 < p[1] < 1030]
    measured = {
        "viewBox": [float(v) for v in root.get("viewBox").split()],
        "groupCount": len(root.findall(".//{*}g")), "pathCount": len(paths),
        "commandCounts": {"cubic": command_counts["C"] + command_counts["c"],
                          "line": command_counts["L"] + command_counts["l"],
                          "move": command_counts["M"] + command_counts["m"],
                          "close": command_counts["Z"] + command_counts["z"]},
        "subpathCount": sum(p["subpaths"] for p in parsed),
        "regularSixSpanPathCount": sum(p["regular"] for p in parsed),
        "cornerOrJoinPathIndices": [p["index"] for p in parsed if not p["regular"]],
        "templateFamilies": families,
        "sides": sides,
        "sampledBounds": bounds(all_points),
        "cubicChordQuantiles": quantiles(chord_lengths),
        "cubicHandleQuantiles": quantiles(handle_lengths),
        "cubicChordDeviationQuantiles": quantiles(bends),
        "declaredTransforms": 0,
        "renderStyle": {"fill": "black (SVG default)", "stroke": "none (SVG default)"},
        "centralEmptyRegion": {"box": [50, 50, 1870, 1030],
                               "sampledPointCount": len(empty)},
        "canonicalMotif": {"sourcePathIndex": 0, "center": center,
                           "bounds": representative["bounds"], "segments": template},
    }
    return {"source": "references/lineframe-05.svg", "sha256": sha256(source).hexdigest(),
            "measured": measured,
            "inferredRules": {
                "status": "Hypotheses from one Illustrator export, not a proven authoring sequence",
                "motif": "A short tapered slanted capsule is reused by translation and quarter-turns; six exceptional paths resolve the corners",
                "layout": "Four near-periodic edge runs preserve a vast empty center; the 310 groups do not imply 310 distinct designs",
                "variation": "Correlated changes to cadence, length and bend can vary the border without scattering marks into the center"}}


def main():
    content = json.dumps(analyze(), indent=2) + "\n"
    if "--check" in sys.argv:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            print("geometry.json differs from source analysis", file=sys.stderr)
            raise SystemExit(1)
        print("lineframe analysis reproducible")
    else:
        OUTPUT.write_text(content)
        print("wrote", OUTPUT)


if __name__ == "__main__":
    main()
