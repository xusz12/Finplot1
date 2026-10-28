import assert from 'node:assert/strict'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { fixture } from './helpers/ledger-fixture.mjs'
import { readLedger, selectTransactions, summarize } from '../src/lib/ledger.js'
import { exploreTransactions, explorationSeries, filterTransactions, groupTransactions, searchTransactions } from '../src/lib/exploration.js'
import { calendarHeatmap, heatLevel } from '../src/lib/heatmap.js'
import { demoLedger } from '../src/lib/demo-ledger.js'
import { yearData } from '../src/data.js'

const SQL = await initSqlJs()
const ledger = readLedger(SQL, fixture())

test('月份、性质、方向、分组、子分类和搜索按交集筛选，不因多标签重复计数', () => {
  const records = exploreTransactions(ledger, { year: 2025, mode: 'month', month: 1, nature: '日常' },
    { type: 'expense', group: { id: 1 }, category: { id: 1 }, query: '同名 标签 A' })
  assert.deepEqual(records.map(t => t.id), [3])
  assert.equal(summarize(records).expenseCents, 20)
  assert.equal(exploreTransactions(ledger, { year: 2025, mode: 'month', month: 2 }, { type: 'expense' }).length, 0)
  assert.equal(filterTransactions(records, { type: 'income' }).length, 0)
})

test('同名分类使用编号区分；分组总额等于子分类及交易合计', () => {
  const duplicate = { ...ledger.transactions.find(t => t.id === 2), id: 99, categoryId: 90, groupId: 91 }
  const records = [...selectTransactions(ledger, { year: 2025 }), duplicate]
  assert.deepEqual(filterTransactions(records, { category: { id: 90 } }).map(t => t.id), [99])
  const groups = groupTransactions(records, 'expense')
  assert.equal(groups.reduce((sum, group) => sum + group.cents, 0), summarize(records).expenseCents)
  const children = groupTransactions(filterTransactions(records, { group: { id: 1 } }), 'expense', 'category')
  assert.equal(children.reduce((sum, child) => sum + child.cents, 0), groups.find(group => group.id === 1).cents)
})

test('搜索支持备注、分类、标签、时间、金额和来源编号，忽略大小写和全角字符', () => {
  const records = [{ ...ledger.transactions.find(t => t.id === 3), sourceRecordId: 'ABC-123', amountCents: 123450 }]
  for (const query of ['餐饮', '生活', '#标签, B', '同名', '2025-01-02', '2025年1月2日', '1234.50', '1,234.50', '−¥1,234.50', 'ａｂｃ-１２３', '  ABC 标签  ']) {
    assert.equal(searchTransactions(records, query).length, 1, query)
  }
  assert.equal(searchTransactions(records, '[.*').length, 0)
  assert.equal(searchTransactions(records, 'ABC 不存在').length, 0)
  assert.equal(searchTransactions(records, '  ').length, 1)
})

test('趋势保留全年上下文，未覆盖月份为空，覆盖内无匹配月份为零', () => {
  const series = explorationSeries(ledger, 2025, exploreTransactions(ledger, { year: 2025 }, { type: 'expense', category: { id: 1 } }))
  assert.equal(series[0].expense, .3)
  assert.equal(series[0].income, 0)
  assert.equal(series[1].expense, 0)
  const next = explorationSeries(ledger, 2026, selectTransactions(ledger, { year: 2026 }))
  assert.equal(next[0].expense, 2)
  assert.equal(next[1].expense, null)
})

test('热力图按完整日期聚合，同日收支各自保留，不按净额抵消', () => {
  const model = calendarHeatmap(ledger, 2025, selectTransactions(ledger, { year: 2025 }))
  const day = model.days.find(t => t?.date === '2025-01-02')
  assert.equal(day.incomeCents, 500)
  assert.equal(day.expenseCents, 30)
  assert.equal(day.count, 3)
  assert.ok(day.incomeLevel > 0 && day.expenseLevel > 0)
  assert.equal(model.days.find(t => t?.date === '2025-02-02').count, 0)
  assert.equal(model.activeDays, 5)
  const expenseOnly = calendarHeatmap(ledger, 2025, exploreTransactions(ledger, { year: 2025 }, { type: 'expense' }))
  assert.equal(expenseOnly.maximum.income, 0)
})

test('热力图平年、闰年、跨年星期位置和覆盖空白均准确', () => {
  for (const [year, length] of [[2024, 366], [2025, 365], [2012, 366]]) {
    const source = { firstDate: `${year}-02-01`, lastDate: `${year}-11-30` }
    const model = calendarHeatmap(source, year, [])
    const days = model.days.filter(Boolean)
    assert.equal(days.length, length)
    assert.equal(new Set(days.map(day => day.date)).size, length)
    assert.equal(days[0].date, `${year}-01-01`)
    assert.equal(days.at(-1).date, `${year}-12-31`)
    assert.equal(days[0].weekday, (new Date(Date.UTC(year, 0, 1)).getUTCDay() + 6) % 7)
    assert.equal(model.days.length % 7, 0)
    assert.equal(model.months.length, 12)
    assert.equal(days[0].available, false)
    assert.equal(days.find(day => day.date === `${year}-06-01`).available, true)
  }
})

test('热力色阶在零值、极值和阈值边界有确定结果，收支分别计算', () => {
  assert.deepEqual([0, 1, 25, 26, 50, 51, 75, 76, 100].map(value => heatLevel(value, 100)), [0, 1, 1, 2, 2, 3, 3, 4, 4])
  assert.equal(heatLevel(0, 0), 0)
  assert.equal(heatLevel(1, 1), 4)
  assert.equal(heatLevel(1000, 100), 4)
})

test('示例流水逐月与原始示例收支对账，搜索、分组和热力图使用同一组金额', () => {
  assert.equal(new Set(demoLedger.transactions.map(t => t.id)).size, demoLedger.transactions.length)
  for (const year of demoLedger.years) for (const row of yearData(year)) {
    const records = selectTransactions(demoLedger, { year, mode: 'month', month: row.month })
    const total = summarize(records)
    assert.equal(total.incomeCents, row.income * 100)
    assert.equal(total.expenseCents, row.expense * 100)
    assert.equal(groupTransactions(records, 'expense').reduce((sum, item) => sum + item.cents, 0), total.expenseCents)
  }
  const model = calendarHeatmap(demoLedger, 2025, selectTransactions(demoLedger, { year: 2025 }))
  assert.equal(model.days.reduce((sum, day) => sum + (day?.expenseCents ?? 0), 0), 20380000)
})
