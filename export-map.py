"""Export geometry from the archive's binary place and its Lune XML view."""
from pathlib import Path
from xml.etree import ElementTree as ET
from base64 import b64encode
import json
import struct
import sys

ROOT = Path(__file__).parent
ORIGINAL = ROOT / "roblox/Happy-Home-in-Robloxia.rbxl"


def lz4(source, size):
    data = bytearray()
    cursor = 0

    def extended(length):
        nonlocal cursor
        if length == 15:
            while source[cursor] == 255:
                length += 255
                cursor += 1
            length += source[cursor]
            cursor += 1
        return length

    while cursor < len(source):
        token = source[cursor]
        cursor += 1
        count = extended(token >> 4)
        data.extend(source[cursor:cursor + count])
        cursor += count
        if cursor == len(source):
            break
        offset = int.from_bytes(source[cursor:cursor + 2], "little")
        cursor += 2
        count = 4 + extended(token & 15)
        data.extend((data[-offset:] * ((count + offset - 1) // offset))[:count])
    assert len(data) == size
    return data


def terrain_payload(binary):
    cursor = 32
    marker = b"ClusterGridV2"
    while cursor < len(binary):
        kind, packed, size, _ = struct.unpack_from("<4sIII", binary, cursor)
        cursor += 16
        source = binary[cursor:cursor + (packed or size)]
        cursor += packed or size
        if kind != b"PROP" or size < 700000:
            continue
        data = lz4(source, size) if packed else source
        if data[8:8 + len(marker)] == marker:
            return data[13 + len(marker):]
    raise ValueError("ClusterGridV2 is missing")


def terrain(data):
    # This archive uses a dense grid of 16 x 4 x 16 chunks. Unlike V3,
    # coordinates are implicit (z, y, x). A long run has a big-endian count.
    heights = bytearray(512 ** 2)
    shapes = bytearray(512 ** 2)
    cursor = 0

    def runs():
        nonlocal cursor
        index = 0
        while index < 16384:
            value, count = data[cursor:cursor + 2]
            cursor += 2
            if count == 255:
                count = int.from_bytes(data[cursor:cursor + 2], "big")
                cursor += 2
            assert 0 < count <= 16384 - index
            yield index, count, value
            index += count

    for chunk in range(1024):
        x = chunk // 64 * 32
        z = chunk % 16 * 32
        y = chunk // 16 % 4 * 16
        cells = bytearray(16384)
        for start, count, value in runs():
            cells[start:start + count] = bytes([value]) * count
        for start, count, value in runs():
            if value == 17:
                continue
            for idx in range(start, start + count):
                layer = y + (idx >> 10) + 1
                output = (z + (idx >> 5 & 31)) * 512 + x + (idx & 31)
                if heights[output] <= layer:
                    heights[output] = layer
                    shapes[output] = cells[idx]
    assert cursor == len(data)
    for x, z, level in [(-382,-135,40),(-373,-118,40),(-308,-160,40),(-510,-156,72),(-405,176,92)]:
        assert heights[(z // 4 + 256)*512 + x // 4 + 256] * 4 == level
    return {"heights": b64encode(heights).decode(), "shapes": b64encode(shapes).decode()}


def read_parts(xml):
    world = ET.parse(xml).getroot().find("Item[@class='Workspace']")
    parts, doors, seats, scripts = [], [], [], []
    jeep = []
    spawn = None
    tv = None

    def visit(item, path, door=None):
        nonlocal spawn, tv
        props = {p.get("name"): p for p in item.findall("./Properties/*")}

        def prop(name, default):
            node = props.get(name)
            return node.text if node is not None and node.text is not None else default

        def vector(node, keys):
            return [round(float(node.findtext(k)), 5) for k in keys]

        cls = item.get("class")
        name = prop("Name", cls)
        path = path + [name]
        if name in ("HouseDoor", "SpaceHatch"):
            door = len(doors)
            doors.append([])
        if cls in ("Part", "WedgePart", "Seat", "SpawnLocation", "VehicleSeat"):
            frame = props["CFrame"]
            position = vector(frame, "XYZ")
            rotation = vector(frame, [f"R{i}{j}" for i in range(3) for j in range(3)])
            size = vector(props["size"], "XYZ")
            shape = 3 if cls == "WedgePart" else int(prop("shape", "1"))
            mesh = item.find("Item[@class='CylinderMesh']")
            if mesh is not None:
                shape = 2
            color = int(prop("Color3uint8", "10526880")) & 0xffffff
            transparent = round(float(prop("Transparency", "0")), 4)
            flags = (1 if prop("CanCollide", "true") == "true" else 0) + (2 if prop("TopSurface", "0") == "3" else 0)
            code = 0
            if "Jeep" in path:
                code = 2 if name.startswith("Wheel_") else 1
            if door is not None and name in ("Door1", "Door2"):
                code = 10 + door
                doors[door].append(len(parts))
            if "houseInteriorTV" in path and name == "Screen":
                code = 20
                tv = position
            row = [*position, *size, *rotation, color, transparent, shape, flags, code]
            parts.append(row)
            if code in (1, 2):
                jeep.append(len(parts) - 1)
            if cls == "SpawnLocation":
                spawn = position
            if cls == "Seat":
                seats.append(position)
        if cls == "Script":
            scripts.append("/".join(path))
        for child in item.findall("Item"):
            visit(child, path, door)

    visit(world, [])
    assert len(parts) == 3775 and len(jeep) == 39 and len(doors) == 3 and spawn and tv
    return dict(parts=parts, jeep=jeep, doors=doors, seats=seats, spawn=spawn, tv=tv, scripts=scripts)


if __name__ == "__main__":
    output = read_parts(sys.argv[1])
    output.update(terrain(terrain_payload(ORIGINAL.read_bytes())))
    (ROOT / "map.mjs").write_text("const MAP=" + json.dumps(output, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(len(output["parts"]), "source parts, 512 x 512 terrain columns")
