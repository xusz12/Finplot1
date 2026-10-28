import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OVERVIEW_ALIGNED_SIZE, snapOverviewSize } from '../src/lib/chart-layout.js'

test('吸附范围按实际可用宽度计算，两侧靠近对齐线均可吸附', () => {
  for (const width of [700, 1000, 1400]) {
    for (const direction of [-1, 1]) {
      const near = OVERVIEW_ALIGNED_SIZE + direction * 9 / width * 100
      const far = OVERVIEW_ALIGNED_SIZE + direction * 11 / width * 100
      assert.equal(snapOverviewSize(near, width), OVERVIEW_ALIGNED_SIZE)
      assert.equal(snapOverviewSize(far, width), far)
    }
  }
})

test('吸附后允许小幅移动，拖出释放范围后恢复自由调整', () => {
  for (const direction of [-1, 1]) {
    const withinRelease = OVERVIEW_ALIGNED_SIZE + direction * 1.5
    const outsideRelease = OVERVIEW_ALIGNED_SIZE + direction * 1.9
    assert.equal(snapOverviewSize(withinRelease, 1000, true), OVERVIEW_ALIGNED_SIZE)
    assert.equal(snapOverviewSize(outsideRelease, 1000, true), outsideRelease)
  }
})

test('键盘调整不继承拖动的吸附保持范围，方向键可以离开对齐点', () => {
  for (const direction of [-1, 1]) {
    const next = OVERVIEW_ALIGNED_SIZE + direction * 2
    assert.equal(snapOverviewSize(next, 700), next)
  }
})

test('容器尚未布局或隐藏时不根据无效宽度吸附', () => {
  for (const width of [0, -1, NaN, Infinity]) assert.equal(snapOverviewSize(65, width), 65)
})
