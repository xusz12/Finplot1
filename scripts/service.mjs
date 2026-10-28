import { mkdir, writeFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { ROOT, DATA_DIR, run, networkConfig } from '../server/common.mjs'

if (process.platform !== 'darwin') throw new Error('守护进程安装目前支持 macOS；其他系统可使用 npm start 交给进程管理器运行。')
const label = 'com.finplot.service'
const domain = `gui/${process.getuid()}`
const plist = join(homedir(), 'Library/LaunchAgents', `${label}.plist`)
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const action = process.argv[2] || 'status'
async function stop() {
  try { await run('launchctl', ['bootout', `${domain}/${label}`]) }
  catch (error) { if (!/Could not find service|No such process/.test(error.stderr || '')) throw error }
}
if (action === 'install') {
  await networkConfig()
  await mkdir(dirname(plist), { recursive: true })
  await mkdir(join(DATA_DIR, 'logs'), { recursive: true, mode: 0o700 })
  const environment = { PATH: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
    FINPLOT_DATA_DIR: DATA_DIR, FINPLOT_HOST: process.env.FINPLOT_HOST || 'auto', FINPLOT_PORT: process.env.FINPLOT_PORT || '3210',
    ...(process.env.FINPLOT_TAILSCALE ? { FINPLOT_TAILSCALE: process.env.FINPLOT_TAILSCALE } : {}) }
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(ROOT, 'server/start.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(ROOT)}</string>
<key>EnvironmentVariables</key><dict>${Object.entries(environment).map(([k,v]) => `<key>${k}</key><string>${xml(v)}</string>`).join('')}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer><key>ExitTimeOut</key><integer>20</integer>
<key>StandardOutPath</key><string>${xml(join(DATA_DIR, 'logs/service.log'))}</string>
<key>StandardErrorPath</key><string>${xml(join(DATA_DIR, 'logs/error.log'))}</string>
</dict></plist>\n`
  await stop()
  await writeFile(plist, content, { mode: 0o600 })
  await run('plutil', ['-lint', plist])
  await run('launchctl', ['bootstrap', domain, plist])
  console.log(`已安装并启动 Finplot 守护进程。登录后自动启动，退出终端后继续运行。\n${plist}`)
} else if (action === 'start') {
  await run('launchctl', ['bootstrap', domain, plist])
  console.log('Finplot 已启动。')
} else if (action === 'stop') {
  await stop(); console.log('Finplot 已停止。')
} else if (action === 'uninstall') {
  await stop(); await rm(plist, { force: true }); console.log('已移除守护进程，账本与备份保留。')
} else if (action === 'status') {
  try {
    const result = await run('launchctl', ['print', `${domain}/${label}`])
    console.log(result.split('\n').filter(line => /state =|pid =|last exit code|program =/.test(line)).join('\n'))
  } catch { console.log('Finplot 守护进程未运行。'); process.exitCode = 1 }
} else throw new Error('支持 install / start / stop / status / uninstall。')
