import { readFileSync, writeFileSync } from "fs";

// Read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const minAppVersion = manifest.minAppVersion;
const currentVersion = manifest.version;

// Write minAppVersion to versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[currentVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));

console.log(`Updated versions.json with version ${currentVersion} requiring Obsidian ${minAppVersion}`);