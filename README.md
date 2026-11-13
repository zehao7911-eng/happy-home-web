# Happy Home in Robloxia — 2012 Web Edition

An unofficial HTML5 port of the October 2012 Happy Home in Robloxia place published in [Roblox's Old Open Source Levels archive](https://github.com/Roblox/Old-Open-Source-Levels/tree/ab6927b221ab4a91a5664f69b5be64b98e782e75/ROBLOX/Miscellaneous). The unmodified Studio project is in roblox/ and retains the original MIT notice.

The web edition imports 3,775 original Workspace parts. It restores 456 original texture and decal assignments, the flower mesh, the TV's two static images, and the archived camera framing. Terrain is drawn as 4-stud cells using the decoded ClusterGridV2 surface shape and orientation data. Browser physics uses a smoothed collision surface for reliable walking and driving. The renderer approximates the original lighting and the built-in Roblox player and spawn visuals.

Start in free roam. Use WASD or the touch stick, drag to look, press Space to jump, E to board or exit the Jeep and T near the TV. The Jeep uses the archived maximum speed and turn parameters. The three-landmark tour is optional in Menu. Doors and TV use browser equivalents of their archived script behaviors. Roblox multiplayer, character services and building tools require the Roblox runtime.

## Build

The compiled index.html works locally or from a static host. Python 3 build.py bundles the editable sources and makes the root-index GameWave archive. To regenerate map.mjs from the Studio file, run Lune with decode.luau, the original binary path and a temporary XML output path. Then run Python 3 export-map.py with that XML path. The terrain comes directly from the original binary.

Run Python 3 fidelity-export.py with the temporary XML path and a directory of downloaded Roblox asset payloads to regenerate fidelity.mjs. Asset IDs come from the place file and its TV script.
