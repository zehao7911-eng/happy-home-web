local r=require("@lune/roblox")
local f=require("@lune/fs")
local p=require("@lune/process")
f.writeFile(p.args[2],r.serializePlace(r.deserializePlace(f.readFile(p.args[1])),true))
