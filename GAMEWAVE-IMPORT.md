# Happy Home in Robloxia — GameWave Import

Upload HAPPY-HOME-GAMEWAVE.zip with index.html at the root. The game runs as a self-contained HTML5 WebGL page. No external libraries, assets, or Roblox login are needed. The standalone.html alias is byte-identical.

A tour starts on committed movement, boarding, jumping, or TV use and ends after all three landmarks have been found. After a reload, the first committed action resumes an unfinished tour and starts a new host session. Free roam remains available after the tour.

The GameWave bridge uses the host-provided neonlib methods when present. The local save records position, Jeep state, tour stamps, audio preference and confirmed reward flags. The cloud snapshot contains only this game's best stamps and permanent trail unlocks. A confirmed like unlocks gold Jeep dust and a direct comment unlocks sunset dust. These are optional and are deduplicated in this game's profile.

GameWave SDK features and WebGL availability depend on the host app. A real host import and device test should precede platform submission.
