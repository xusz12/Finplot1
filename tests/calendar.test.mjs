import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

// Keep the store's persistence boundary in memory; no browser profile is touched.
const storage = new Map()
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
globalThis.window = { localStorage }
const { useApp } = await import('../src/store.js')
const state = () => useApp.getState()
const selectedDate = () => [state().year, state().month, state().calendarDay]

beforeEach(() => useApp.setState(useApp.getInitialState(), true))

test('月份下拉：31 日进入短月后选择月末，返回长月不恢复无效日期', () => {
  state().setCalendarDay(31)
  state().setMonth('4')
  assert.deepEqual(selectedDate(), [2025, 4, 30])
  state().setMonth('2')
  assert.deepEqual(selectedDate(), [2025, 2, 28])
  state().setMonth('3')
  assert.deepEqual(selectedDate(), [2025, 3, 28])
})

test('年份下拉：闰年二月允许 29 日，改为平年时选择 28 日', () => {
  state().setYear('2024')
  state().setMonth('2')
  state().setCalendarDay(29)
  assert.deepEqual(selectedDate(), [2024, 2, 29])
  state().setYear('2025')
  assert.deepEqual(selectedDate(), [2025, 2, 28])
})

test('短月仍存在的日期在月份和年份切换后保持选中', () => {
  state().setCalendarDay(15)
  state().setMonth('2')
  state().setYear('2024')
  assert.deepEqual(selectedDate(), [2024, 2, 15])
})

test('前后月操作与下拉筛选共用月末校正', () => {
  state().setCalendarDay(31)
  state().setPeriod(2025, 11)
  assert.deepEqual(selectedDate(), [2025, 11, 30])
  state().setPeriod(2024, 2)
  assert.deepEqual(selectedDate(), [2024, 2, 29])
})

test('跨年周期一次提交完整的有效日期', () => {
  state().setPeriod(2024, 12)
  state().setCalendarDay(31)
  const seen = []
  const unsubscribe = useApp.subscribe(() => seen.push(selectedDate()))
  state().setPeriod(2025, 1)
  state().setPeriod(2024, 12)
  unsubscribe()
  assert.deepEqual(seen, [[2025, 1, 31], [2024, 12, 31]])
})

test('图表页改动周期再回到日历，选中日期仍有效', () => {
  state().setPage('calendar')
  state().setCalendarDay(31)
  state().setPage('overview')
  state().setMonth('2')
  state().setPage('calendar')
  assert.deepEqual(selectedDate(), [2025, 2, 28])
})
