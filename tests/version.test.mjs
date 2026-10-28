import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const { name, version } = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))

test('发布版本是完整版本号，包清单与锁文件根条目一致', () => {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  assert.equal(lock.version, version)
  assert.equal(lock.packages[''].version, version)
  assert.equal(lock.name, name)
  assert.equal(lock.packages[''].name, name)
})

test('README 当前版本和最新 CHANGELOG 与应用版本一致', () => {
  const readme = read('README.md')
  const changelog = read('CHANGELOG.md')
  assert.ok(readme.includes(`当前版本：**v${version}**`))
  assert.equal(changelog.match(/^## (\S+)/m)?.[1], `v${version}`)
  const latest = changelog.split(/^## /m)[1]
  for (const category of ['feat', 'improve', 'fix']) {
    assert.ok(latest.includes(`### ${category}\n`), `缺少 ${category} 分类`)
  }
})
