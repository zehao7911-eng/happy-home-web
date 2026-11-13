from pathlib import Path
import gzip
import json
import re
import sys
from base64 import b64encode
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parent
workspace = ET.parse(sys.argv[1]).getroot()
data = json.loads((root/"map.mjs").read_text().strip()[10:-1])

def props(item):
    return {n.get("name"):n for n in item.findall("./Properties/*")}

def v(p, keys):
    return [round(float(p.findtext(k)),6) for k in keys]

def asset(prop):
    match = re.search(r"\bid=(\d+)", prop.findtext("uri", ""))
    return match.group(1) if match else None

def asset_bytes(asset_id):
    binary = (Path(sys.argv[2])/asset_id).read_bytes()
    return gzip.decompress(binary) if binary[:2] == b"\x1f\x8b" else binary

world = workspace.find("Item[@class='Workspace']")
lighting = props(workspace.find("Item[@class='Lighting']"))
camera = props(world.find("Item[@class='Camera']"))
camera_frame = v(camera["CFrame"], ["X","Y","Z",*[f"R{i}{j}" for i in range(3) for j in range(3)]])
seat = props(world.find(".//Item[@class='VehicleSeat']"))
parts = [x for x in world.iter("Item") if x.get("class") in ("Part","WedgePart","Seat","SpawnLocation","VehicleSeat")]
assert len(parts)==len(data["parts"])
assets = {}
decals = []
meshes = []
materials = []
for index,item in enumerate(parts):
    p = props(item)
    assert max(abs(a-b) for a,b in zip(v(p["CFrame"],"XYZ"),data["parts"][index]))<.00002
    materials.append(int(p["Material"].text))
    for child in item.findall("Item"):
        cls = child.get("class")
        cp = props(child)
        if cls in ("Texture","Decal"):
            aid = asset(cp["TextureContent"])
            if aid is None:
                continue
            assets.setdefault(aid, "data:image/png;base64,"+b64encode(asset_bytes(aid)).decode())
            decals.append([index, int(cp["Face"].text), aid, float(cp["Transparency"].text),
                           float(cp["StudsPerTileU"].text) if cls=="Texture" else 0,
                           float(cp["StudsPerTileV"].text) if cls=="Texture" else 0])
        if cls=="SpecialMesh":
            aid,tex=asset(cp["MeshContent"]),asset(cp["TextureContent"])
            assets.setdefault(tex,"data:image/png;base64,"+b64encode(asset_bytes(tex)).decode())
            meshes.append([index,aid,tex,v(cp["Scale"],"XYZ"),v(cp["Offset"],"XYZ")])
mesh_id = meshes[0][1]
version,count,mesh = asset_bytes(mesh_id).decode().splitlines()
assert version=="version 1.00"
vertices = [[float(n) for n in a.split(",")] for a in re.findall(r"\[([^\]]+)\]",mesh)]
assert len(vertices)==int(count)*9
models = {mesh_id: [[round(n,5) for n in row] for row in vertices]}
for aid in ("58247550","58247679"):
    raw = asset_bytes(aid)
    assert raw.startswith(b"\x89PNG")
    assets[aid]="data:image/png;base64,"+b64encode(raw).decode()
payload = dict(camera=camera_frame,fov=float(camera["FieldOfView"].text),
   ambient=v(lighting["Ambient"],"RGB"),brightness=float(lighting["Brightness"].text),
   time=lighting["TimeOfDay"].text,maxSpeed=float(seat["MaxSpeed"].text),
   steer=float(seat["TurnSpeed"].text),decals=decals,meshes=meshes,assets=assets,models=models,materials=materials)
(root/"fidelity.mjs").write_text("const ORIGINAL="+json.dumps(payload,separators=(",",":"))+";\n",encoding="utf-8")
print(len(decals),"original decal/texture surfaces",len(assets),"original PNGs",len(meshes),"original model instances")
