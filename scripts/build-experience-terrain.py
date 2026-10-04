import argparse
import hashlib
import json
import math
import pathlib
import struct
import subprocess
import urllib.request

SOURCE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/995/631.png"
BOUNDS = {"west": -5.09765625, "east": -4.921875, "north": 56.6562264935022, "south": 56.55948248376224}
EXAGGERATION = 2
ATTRIBUTION = "Mapzen Terrain Tiles. Produced using Copernicus data and information funded by the European Union — EU-DEM layers. SRTM and GMTED2010 data courtesy of the U.S. Geological Survey. ETOPO1: DOC/NOAA/NESDIS/NCEI."


def sample(rgb, u, v):
    x = min(255, max(0, round(u * 255)))
    y = min(255, max(0, round(v * 255)))
    at = (y * 256 + x) * 3
    r, g, b = rgb[at:at + 3]
    return r * 256 + g + b / 256 - 32768


def mesh(rgb, size):
    middle_lat = (BOUNDS["north"] + BOUNDS["south"]) / 2
    span = 2 * math.pi * 6378137 / 2048 * math.cos(math.radians(middle_lat)) / 1000
    positions = []
    elevations = []
    for row in range(size):
        for col in range(size):
            u, v = col / (size - 1), row / (size - 1)
            height = sample(rgb, u, v)
            elevations.append(height)
            positions.extend(((u - 0.5) * span, height / 1000 * EXAGGERATION, (v - 0.5) * span))
    indices = []
    for row in range(size - 1):
        for col in range(size - 1):
            a = row * size + col
            b, c, d = a + 1, a + size, a + size + 1
            indices.extend((a, c, b, b, c, d))
    normals = [0.0] * len(positions)
    for offset in range(0, len(indices), 3):
        ia, ib, ic = [indices[offset + n] * 3 for n in range(3)]
        ab = [positions[ib + n] - positions[ia + n] for n in range(3)]
        ac = [positions[ic + n] - positions[ia + n] for n in range(3)]
        cross = (ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])
        for index in (ia, ib, ic):
            for n in range(3):
                normals[index + n] += cross[n]
    for index in range(0, len(normals), 3):
        length = math.sqrt(sum(normals[index + n] ** 2 for n in range(3)))
        for n in range(3):
            normals[index + n] /= length
    return positions, normals, indices, elevations, span


def glb(positions, normals, indices):
    position_bytes = struct.pack(f"<{len(positions)}f", *positions)
    normal_bytes = struct.pack(f"<{len(normals)}f", *normals)
    index_bytes = struct.pack(f"<{len(indices)}H", *indices)
    binary = position_bytes + normal_bytes + index_bytes
    views = [
        {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(normal_bytes), "target": 34962},
        {"buffer": 0, "byteOffset": len(position_bytes) + len(normal_bytes), "byteLength": len(index_bytes), "target": 34963},
    ]
    doc = {
        "asset": {"version": "2.0", "generator": "Bothy frozen DEM mesh"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Scottish terrain — atmospheric only"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2}]}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions) // 3, "type": "VEC3", "min": [min(positions[n::3]) for n in range(3)], "max": [max(positions[n::3]) for n in range(3)]},
            {"bufferView": 1, "componentType": 5126, "count": len(normals) // 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]},
        ],
    }
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\x00" * (-len(binary) % 4)
    length = 12 + 8 + len(text) + 8 + len(binary)
    return struct.pack("<III", 0x46546C67, 2, length) + struct.pack("<II", len(text), 0x4E4F534A) + text + struct.pack("<II", len(binary), 0x004E4942) + binary


def fallback(positions, size, span):
    project = lambda x, y, z: (600 + (x - z) / span * 430, 490 + (x + z) / span * 150 - y / span * 800)
    paths = []
    for direction in (0, 1):
        for fixed in range(size):
            points = []
            for moving in range(size):
                row, col = (fixed, moving) if direction == 0 else (moving, fixed)
                at = (row * size + col) * 3
                x, y = project(*positions[at:at + 3])
                points.append(f"{x:.2f},{y:.2f}")
            paths.append(f'<polyline points="{" ".join(points)}"/>')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#161c18"/><g fill="none" stroke="#9ac4cb" stroke-opacity=".42" stroke-width="1">' + "".join(paths) + '</g></svg>'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    png = output / "source-terrarium.png"
    if png.exists():
        source = png.read_bytes()
        imagery = "Frozen source; see recorded source headers"
    else:
        with urllib.request.urlopen(SOURCE, timeout=30) as response:
            source = response.read()
            imagery = response.headers.get("x-amz-meta-x-imagery-sources", "Not supplied")
        png.write_bytes(source)
    if source[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", source[16:24]) != (256, 256):
        raise ValueError("Expected a 256x256 Terrarium PNG")
    rgb = subprocess.run(["ffmpeg", "-v", "error", "-i", str(png), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], check=True, capture_output=True).stdout
    if len(rgb) != 256 * 256 * 3:
        raise ValueError("Unexpected decoded RGB length")
    stats = {}
    for size, name in ((65, "terrain"), (33, "terrain-low")):
        positions, normals, indices, elevations, span = mesh(rgb, size)
        if not all(math.isfinite(v) for v in positions + normals) or min(elevations) < -500 or max(elevations) > 2000:
            raise ValueError("Scottish crop has unexpected elevation or geometry values")
        asset = glb(positions, normals, indices)
        (output / f"{name}.glb").write_bytes(asset)
        stats[name] = {"vertices": size * size, "triangles": len(indices) // 3, "bytes": len(asset), "sha256": hashlib.sha256(asset).hexdigest()}
        if size == 33:
            (output / "terrain-fallback.svg").write_text(fallback(positions, size, span))
    metadata_path = output / "terrain-source.json"
    existing = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    metadata = {
        "sourceUrl": SOURCE,
        "datasetUrl": "https://registry.opendata.aws/terrain-tiles/",
        "attributionUrl": "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        "attribution": ATTRIBUTION,
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "imagerySources": existing.get("imagerySources", imagery),
        "boundsWgs84": BOUNDS,
        "tile": {"zoom": 11, "x": 995, "y": 631},
        "units": "1 scene unit = 1 kilometre; Y up; X east; Z south",
        "verticalExaggeration": EXAGGERATION,
        "processing": "Nearest-pixel samples on 65x65 and 33x33 grids; approximate local ground scale from Web Mercator at crop mid-latitude; no smoothing or terrain deformation",
        "boundary": "Scottish elevation crop is brand atmosphere only, not supplier geography, route guidance or current conditions. Shelter is an illustrative brand symbol, not a mapped building.",
        "sampledElevationRangeMetres": [min(elevations), max(elevations)],
        "assets": stats,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
