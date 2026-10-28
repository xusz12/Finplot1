// Stable entry point used by launchd and npm. Load the installed supervisor on
// each service start so updates to the supervisor itself take effect as well.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DATA_DIR, ROOT, manifest, readJson } from './common.mjs'
import { compareVersions } from './updates.mjs'

const active = await readJson(join(DATA_DIR, 'active.json'))
const root = active && compareVersions(active.version, manifest.version) >= 0 ? active.root : ROOT
await import(pathToFileURL(join(root, 'server/launcher.mjs')).href)
