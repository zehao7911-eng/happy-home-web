# Happy Home in Robloxia — 2012 Web Edition

An unofficial HTML5 port of the October 2012 Happy Home in Robloxia place published in [Roblox's Old Open Source Levels archive](https://github.com/Roblox/Old-Open-Source-Levels/tree/ab6927b221ab4a91a5664f69b5be64b98e782e75/ROBLOX/Miscellaneous). The unmodified Studio project is in roblox/ and retains the original MIT notice.

The web edition imports 3,775 original Workspace parts, including the starter house, furniture, Jeep, cacti and space station. It decodes the original ClusterGridV2 terrain into a 512 by 512 surface and renders a smoothed mesh. It preserves part transforms, solid colors and primitive shapes. Old remote decals, meshes and textures are not fetched. The player, lighting, audio, UI and optional three-stamp tour were created for the web port. Doors, TV and Jeep interactions are browser implementations. Roblox services, native avatar accounts, building-tool insertion and multiplayer are outside this edition.

Use WASD or the touch stick. Drag to look, press Space to jump, E to board or exit the Jeep and T near the TV. On touch, the corresponding actions appear when relevant. Explore the archived world freely after the three-stop tour.

## Build

The compiled index.html works locally or from a static host. Python 3 build.py bundles the editable sources and makes the root-index GameWave archive. To regenerate map.mjs from the Studio file, run Lune with decode.luau, the original binary path and a temporary XML output path. Then run Python 3 export-map.py with that XML path. The terrain comes directly from the original binary.
