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

test('导入账本定位到最新交易，切换账本不会沿用旧筛选与非法日期', () => {
  state().setNature('投资')
  state().setCalendarDay(31)
  const ledger = { transactions: [{ year: 2026, month: 2, day: 28 }] }
  state().setLedger(ledger)
  assert.deepEqual(selectedDate(), [2026, 2, 28])
  assert.equal(state().nature, 'all')
  assert.equal(state().ledger, ledger)
  assert.ok(![...storage.values()].some(value => value.includes('transactions')))
  state().clearLedger()
  assert.equal(state().ledger, null)
  assert.deepEqual(selectedDate(), [2025, 10, 28])
})

test('图表月份与顶部周期联动，再次点击恢复全年并保留交集筛选', () => {
  state().setCalendarDay(31)
  state().toggleOverviewType('expense')
  state().setOverviewQuery('餐饮')
  const seen = []
  const unsubscribe = useApp.subscribe(() => seen.push([state().mode, ...selectedDate()]))
  state().toggleOverviewMonth(2)
  state().toggleOverviewMonth(2)
  unsubscribe()
  assert.deepEqual(seen, [['month', 2025, 2, 28], ['year', 2025, 2, 28]])
  assert.equal(state().overviewFilters.type, 'expense')
  assert.equal(state().overviewFilters.query, '餐饮')
})

test('方向切换清除不兼容分类，子类型可反选，清除恢复默认范围', () => {
  state().setOverviewQuery('备注')
  state().selectOverviewGroup({ id: 1, name: '生活' }, 'expense')
  state().selectOverviewCategory({ id: 2, name: '餐饮' })
  state().selectOverviewCategory({ id: 2, name: '餐饮' })
  assert.equal(state().overviewFilters.category, null)
  state().toggleOverviewType('income')
  assert.deepEqual(state().overviewFilters, { type: 'income', group: null, category: null, query: '备注' })
  state().toggleOverviewType('income')
  assert.equal(state().overviewFilters.type, 'all')
  state().toggleOverviewMonth(2)
  state().clearOverviewFilters()
  assert.equal(state().mode, 'year')
  assert.deepEqual(state().overviewFilters, { type: 'all', group: null, category: null, query: '' })
})

test('全账本搜索跳到正确年份、月份与日期，不受原性质筛选影响', () => {
  state().setNature('投资')
  state().setSearchOpen(true)
  state().openCalendarDate({ year: 2024, month: 2, day: 29, scopeNature: 'all' })
  assert.deepEqual(selectedDate(), [2024, 2, 29])
  assert.equal(state().nature, 'all')
  assert.equal(state().page, 'calendar')
  assert.equal(state().searchOpen, false)
  const navigation = state().calendarNavigation
  state().openCalendarDate({ year: 2024, month: 2, day: 29, nature: '投资' })
  assert.equal(state().calendarNavigation, navigation + 1)
  assert.equal(state().nature, 'all', '交易自身的性质不应自动改变整个日历的统计口径')
  state().selectOverviewGroup({ id: 3, name: '旧分类' }, 'expense')
  state().setLedger({ transactions: [] })
  assert.equal(state().overviewFilters.group, null)
})
