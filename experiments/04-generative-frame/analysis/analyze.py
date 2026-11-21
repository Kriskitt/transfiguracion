"""Rebuild measured frame geometry from the untouched Illustrator SVG.

Run from this experiment: python3 analysis/analyze.py
Uses only the Python standard library. Curve lengths and bounds are sampled estimates.
"""

from collections import Counter, defaultdict
from hashlib import sha256
from math import atan2, ceil, hypot, pi
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "marco-04.svg"
TOKENS = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?")


def parse_path(data):
    tokens = TOKENS.findall(data)
    index = 0
    command = None
    current = (0.0, 0.0)
    start = None
    subpaths = []
    active = None
    commands = Counter()

    def take(count):
        nonlocal index
        values = tuple(float(item) for item in tokens[index:index + count])
        if len(values) != count:
            raise ValueError("Incomplete path command")
        index += count
        return values

    def relative_point(x, y, relative):
        return (current[0] + x, current[1] + y) if relative else (x, y)

    while index < len(tokens):
        if tokens[index].isalpha():
            command = tokens[index]
            index += 1
        commands[command] += 1
        kind = command.upper()
        relative = command.islower()
        if kind == "M":
            current = relative_point(*take(2), relative)
            start = current
            active = {"start": start, "segments": [], "closed": False}
            subpaths.append(active)
            command = "l" if relative else "L"
        elif kind == "L":
            target = relative_point(*take(2), relative)
            active["segments"].append(("L", current, target))
            current = target
        elif kind == "H":
            value = take(1)[0]
            target = (current[0] + value if relative else value, current[1])
            active["segments"].append(("L", current, target))
            current = target
        elif kind == "V":
            value = take(1)[0]
            target = (current[0], current[1] + value if relative else value)
            active["segments"].append(("L", current, target))
            current = target
        elif kind == "C":
            values = take(6)
            if relative:
                controls = ((current[0] + values[0], current[1] + values[1]),
                            (current[0] + values[2], current[1] + values[3]))
                target = (current[0] + values[4], current[1] + values[5])
            else:
                controls = (values[:2], values[2:4])
                target = values[4:6]
            active["segments"].append(("C", current, *controls, target))
            current = target
        elif kind == "Z":
            if current != start:
                active["segments"].append(("L", current, start))
            active["closed"] = True
            current = start
            command = None
        else:
            raise ValueError(f"Unexpected SVG command: {command}")
    return subpaths, commands


def point(segment, t):
    if segment[0] == "L":
        a, b = segment[1:]
        return (a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1]))
    _, a, b, c, d = segment
    u = 1-t
    return (u**3*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t**3*d[0],
            u**3*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t**3*d[1])


def sampled(segment):
    if segment[0] == "L":
        return [segment[1], segment[2]]
    chord = hypot(segment[-1][0]-segment[1][0], segment[-1][1]-segment[1][1])
    steps = max(12, ceil(chord / 3))
    return [point(segment, i/steps) for i in range(steps+1)]


def bounds(points):
    return [round(min(p[0] for p in points), 2), round(min(p[1] for p in points), 2),
            round(max(p[0] for p in points), 2), round(max(p[1] for p in points), 2)]


def measure_subpath(subpath):
    points = [p for segment in subpath["segments"] for p in sampled(segment)]
    length = sum(hypot(b[0]-a[0], b[1]-a[1])
                 for segment in subpath["segments"] for a, b in zip(sampled(segment), sampled(segment)[1:]))
    return {"closed": subpath["closed"], "start": list(subpath["start"]),
            "lineCount": sum(s[0] == "L" for s in subpath["segments"]),
            "cubicCount": sum(s[0] == "C" for s in subpath["segments"]),
            "bounds": bounds(points), "sampledLength": round(length, 2)}


def segment_key(segment):
    forward = tuple(tuple(round(v, 1) for v in p) for p in segment[1:])
    reverse = tuple(reversed(forward))
    return (segment[0], min(forward, reverse))


def quantiles(values):
    if not values:
        return {}
    ordered = sorted(values)
    return {str(q): round(ordered[round((len(ordered)-1)*q)], 2)
            for q in (0, 0.25, 0.5, 0.75, 0.9, 1)}


def region_for(point):
    x, y = point
    return "left" if x < 150 else ("bottom" if y > 890 else (
        "top" if y < 320 and x < 1400 else "right"))


def boundary_detail(parsed):
    # Path 2 traces the upper staircase and valley in drawing order. Path 4
    # retraces the valley in reverse, so it would double-count fine detail.
    upper = parsed[2][0][0]["segments"]
    dominant = parsed[4][0][0]["segments"]
    treads, risers = [], []
    for segment in upper:
        if segment[0] != "L":
            continue
        a, b = segment[1:]
        dx, dy = abs(b[0]-a[0]), abs(b[1]-a[1])
        if 700 < min(a[0], b[0]) and max(a[0], b[0]) < 1450 and min(a[1], b[1]) > 100:
            if dx > 30 and dy < 1:
                treads.append(round(dx, 2))
            if dy > 10 and dx < 1.5:
                risers.append(round(dy, 2))
    valley_segments = [segment for segment in upper if
                       max(segment[1][0], segment[-1][0]) >= 1400 and
                       min(segment[1][1], segment[-1][1]) >= 270 and
                       max(segment[1][1], segment[-1][1]) < 600]
    valley_points = [point for segment in valley_segments for point in sampled(segment)]
    lowest = max(valley_points, key=lambda item: item[1])
    short_cubics, short_lines, turns = Counter(), Counter(), Counter()
    macro_axis_runs = Counter()
    cubic_bends = defaultdict(list)
    previous_angle = None
    for segment in dominant:
        a, b = segment[1], segment[-1]
        chord = hypot(b[0]-a[0], b[1]-a[1])
        region = region_for(point(segment, 0.5))
        if segment[0] == "C" and chord < 16:
            short_cubics[region] += 1
        if segment[0] == "C" and chord > 0.001:
            bend = max(abs((b[0]-a[0])*(point(segment, t)[1]-a[1]) -
                           (b[1]-a[1])*(point(segment, t)[0]-a[0])) / chord
                       for t in (.25, .5, .75))
            cubic_bends[region].append(bend)
        if segment[0] == "L" and chord < 16:
            short_lines[region] += 1
        if (segment[0] == "L" and chord >= 30 and
                (abs(b[0]-a[0]) < 1.5 or abs(b[1]-a[1]) < 1.5)):
            macro_axis_runs[region] += 1
        if chord > 0.5:
            angle = atan2(b[1]-a[1], b[0]-a[0])
            if previous_angle is not None and abs((angle-previous_angle+pi) % (2*pi)-pi) > pi/9:
                turns[region] += 1
            previous_angle = angle
    return {
        "upperStepTreads": treads,
        "upperStepRisers": risers,
        "upperStepTreadQuantiles": quantiles(treads),
        "upperStepRiserQuantiles": quantiles(risers),
        "rightValley": {"lowestPoint": [round(v, 2) for v in lowest],
                        "sampledBounds": bounds(valley_points),
                        "segmentCount": len(valley_segments),
                        "shortCubicCountUnder16Units": sum(s[0] == "C" and
                            hypot(s[-1][0]-s[1][0], s[-1][1]-s[1][1]) < 16
                            for s in valley_segments)},
        "shortCubicCounts": dict(short_cubics),
        "shortLineCounts": dict(short_lines),
        "directionChangesOver20Degrees": dict(turns),
        "cubicMaxChordDeviationQuantiles": {key: quantiles(values)
                                            for key, values in cubic_bends.items()},
        "macroAxisRunsAtLeast30Units": dict(macro_axis_runs),
    }


def main():
    source = SOURCE.read_bytes()
    root = ET.fromstring(source)
    elements = root.findall(".//{*}path")
    rectangles = root.findall(".//{*}rect")
    parsed = [parse_path(element.get("d")) for element in elements]
    path_metrics = []
    all_segments = []
    for path_index, (subpaths, commands) in enumerate(parsed):
        metrics = [measure_subpath(subpath) for subpath in subpaths]
        segments = [segment for subpath in subpaths for segment in subpath["segments"]]
        all_segments.extend((path_index, segment) for segment in segments)
        path_metrics.append({"index": path_index, "commands": dict(commands),
                             "subpathCount": len(subpaths),
                             "closedSubpathCount": sum(m["closed"] for m in metrics),
                             "lineCount": sum(m["lineCount"] for m in metrics),
                             "cubicCount": sum(m["cubicCount"] for m in metrics),
                             "sampledLength": round(sum(m["sampledLength"] for m in metrics), 2),
                             "subpaths": metrics})

    line_lengths = {"horizontal": [], "vertical": [], "other": []}
    axis_drift = {"horizontal": [], "vertical": []}
    cubic_chords = []
    curve_regions = Counter()
    dominant_lines = {"top": [], "left": [], "bottom": [], "right": []}
    for _, segment in all_segments:
        if segment[0] != "L":
            a, b = segment[1], segment[-1]
            cubic_chords.append(hypot(b[0]-a[0], b[1]-a[1]))
            middle = point(segment, 0.5)
            region = "left" if middle[0] < 150 else (
                "bottom" if middle[1] > 890 else (
                    "top" if middle[1] < 320 else "right"))
            curve_regions[region] += 1
            continue
        a, b = segment[1:]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = hypot(dx, dy)
        kind = "horizontal" if abs(dy) <= max(0.6, length*0.02) else (
            "vertical" if abs(dx) <= max(0.6, length*0.02) else "other")
        line_lengths[kind].append(length)
        if kind == "horizontal": axis_drift[kind].append(abs(dy))
        if kind == "vertical": axis_drift[kind].append(abs(dx))
        if length < 18 or kind == "other":
            continue
        item = [[round(v, 1) for v in a], [round(v, 1) for v in b], round(length, 1)]
        if kind == "horizontal" and max(a[1], b[1]) < 320:
            dominant_lines["top"].append(item)
        if kind == "vertical" and max(a[0], b[0]) < 145:
            dominant_lines["left"].append(item)
        if kind == "horizontal" and min(a[1], b[1]) > 890:
            dominant_lines["bottom"].append(item)
        if kind == "vertical" and min(a[0], b[0]) > 1500:
            dominant_lines["right"].append(item)

    keys_by_path = [Counter(segment_key(segment) for sub in paths for segment in sub["segments"])
                    for paths, _ in parsed]
    shared = []
    for left in range(len(keys_by_path)):
        for right in range(left+1, len(keys_by_path)):
            count = sum(min(n, keys_by_path[right][key]) for key, n in keys_by_path[left].items())
            if count:
                shared.append({"paths": [left, right], "exactSegmentsRounded0_1": count})

    points = [p for _, segment in all_segments for p in sampled(segment)]
    central = [p for p in points if 250 < p[0] < 1200 and 320 < p[1] < 850]
    edge_counts = {"top": sum(p[1] <= 0.6 for p in points),
                   "bottom": sum(p[1] >= 1079.4 for p in points),
                   "left": sum(p[0] <= 0.6 for p in points),
                   "right": sum(p[0] >= 1919.4 for p in points)}
    rectangle_data = [{"x": float(r.get("x")), "y": float(r.get("y")),
                       "width": float(r.get("width")), "height": float(r.get("height"))}
                      for r in rectangles]
    rectangle_retracing = []
    for rect in rectangle_data:
        x, y, w, h = rect.values()
        sides = [((x, y), (x+w, y)), ((x+w, y), (x+w, y+h)),
                 ((x+w, y+h), (x, y+h)), ((x, y+h), (x, y))]
        matches = []
        for path_index, segment in all_segments:
            if segment[0] != "L":
                continue
            for side_index, (a, b) in enumerate(sides):
                endpoints = ((segment[1], segment[2]), (segment[2], segment[1]))
                if any(hypot(p[0]-a[0], p[1]-a[1]) <= 0.6 and
                       hypot(q[0]-b[0], q[1]-b[1]) <= 0.6 for p, q in endpoints):
                    matches.append({"path": path_index, "side": side_index})
        rectangle_retracing.append(matches)
    measured = {
        "viewBox": [float(v) for v in root.get("viewBox").split()],
        "style": root.find("{*}style").text.strip(),
        "pathCount": len(elements), "rectangleCount": len(rectangles),
        "paths": path_metrics, "rectangles": rectangle_data,
        "sampledBounds": bounds(points),
        "lineOrientationCounts": {key: len(value) for key, value in line_lengths.items()},
        "lineLengthTotals": {key: round(sum(value), 2) for key, value in line_lengths.items()},
        "lineLengthQuantiles": {key: quantiles(value) for key, value in line_lengths.items()},
        "axisDriftQuantiles": {key: quantiles(value) for key, value in axis_drift.items()},
        "cubicChordQuantiles": quantiles(cubic_chords),
        "shortCubicCountUnder5Units": sum(value < 5 for value in cubic_chords),
        "cubicMidpointRegions": dict(curve_regions),
        "longAxisSegments": dominant_lines,
        "sharedPathSegments": shared,
        "rectangleSidesRetracedWithin0_6Units": rectangle_retracing,
        "edgePointCountsWithin0_6Units": edge_counts,
        "centralEmptyRegion": {"box": [250, 320, 1200, 850], "sampledPointCount": len(central)},
        "boundaryDetail": boundary_detail(parsed),
    }
    geometry = {
        "source": "references/marco-04.svg", "sha256": sha256(source).hexdigest(),
        "measured": measured,
        "inferredRules": {
            "status": "Hypotheses from a single Illustrator export, not a proven authoring algorithm",
            "primaryContour": "One continuous boundary path supplies most of the visible perimeter; shorter paths retrace portions of it",
            "stepGrammar": "Long orthogonal runs with irregular riser and tread lengths, small rounded or imperfect joins, and a rough right-side interruption",
            "scaleSeparation": "Long axis-aligned runs establish the architectural silhouette; short cubic and oblique spans cluster at joins and on the right valley",
            "rightValley": "An almost vertical drop near x=1596 enters a shallow trough near x=1700; short reversals interrupt the shoulder and rising side",
            "responsive": "Anchor contour sections to canvas edges and recompose step counts and spans at each aspect ratio",
        },
    }
    (ROOT / "analysis" / "geometry.json").write_text(json.dumps(geometry, indent=2) + "\n")
    print("paths", len(elements), "rectangles", len(rectangles),
          "subpaths", [p["subpathCount"] for p in path_metrics],
          "lines", measured["lineOrientationCounts"], "shared", shared)


if __name__ == "__main__":
    main()
