from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
import hashlib

ROOT = Path(__file__).resolve().parent

def read(name):
    return (ROOT / name).read_text(encoding="utf-8")

def wrap(name, binding=None):
    source = read(name)
    names = re.findall(r"^export (?:function|const|class) (\w+)", source, re.M)
    source = re.sub(r"^export ", "", source, flags=re.M)
    return f"const {binding}=(()=>{{\n{source}\nreturn {{{','.join(names)}}};\n}})();\n" if binding else source

html = read("index-source.html")
html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + read("style.css") + "\n</style>")
html = html.replace('<script src="vendor/three.min.js"></script>',
                    "<script>\n/*\n" + read("vendor/THREE-LICENSE.txt") + "\n*/\n" + read("vendor/three.min.js") + "\n</script>")
scripts = [("map.mjs",None),("world.mjs","World"),("art.mjs","Art"),("sdk.mjs","SDK"),("app.mjs",None)]
html = html.replace('<script type="module" src="app.mjs"></script>',
                    "<script>(()=>{\n" + "\n".join(wrap(name,binding) for name,binding in scripts) + "\n})();</script>")
for name in ("index.html","standalone.html"):
    (ROOT / name).write_text(html,encoding="utf-8",newline="\n")

entries = ["index.html","standalone.html","GAMEWAVE-IMPORT.md","roblox/LICENSE.txt"]
archive = ROOT.parent / "HAPPY-HOME-GAMEWAVE.zip"
with ZipFile(archive,"w",ZIP_DEFLATED,compresslevel=9) as z:
    for name in entries:
        z.write(ROOT / name,name)
with ZipFile(archive) as z:
    assert z.testzip() is None
    assert z.namelist() == entries
    for name in entries:
        assert z.read(name) == (ROOT / name).read_bytes()
print(archive.stat().st_size,hashlib.sha256(archive.read_bytes()).hexdigest())
