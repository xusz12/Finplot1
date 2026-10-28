import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { dailySummaries, ledgerCategories, ledgerTotals, ledgerYearData, previousPeriodTotals, readLedger, selectTransactions, summarize, summaryCsv } from '../src/lib/ledger.js'

const SQL = await initSqlJs()
// Synthetic records only. The optional integration check reads a user-supplied
// snapshot in place; no personal transaction fixtures are copied into the repo.
const schema = `
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO metadata VALUES ('schema_version','3');
  CREATE TABLE category_groups (id INTEGER PRIMARY KEY, code TEXT, name TEXT, direction TEXT, active INTEGER, sort_order INTEGER);
  CREATE TABLE categories (id INTEGER PRIMARY KEY, code TEXT, group_id INTEGER REFERENCES category_groups(id), name TEXT, direction TEXT, nature TEXT, active INTEGER, sort_order INTEGER);
  CREATE TABLE transactions (id INTEGER PRIMARY KEY, occurred_at TEXT, direction TEXT, amount_cents INTEGER, category_id INTEGER REFERENCES categories(id), note TEXT, source_category TEXT, source_record_id TEXT);
  CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE transaction_tags (transaction_id INTEGER REFERENCES transactions(id), tag_id INTEGER REFERENCES tags(id), source TEXT);
  INSERT INTO category_groups VALUES (1,'daily','生活','支出',1,1),(2,'work','工作','收入',1,2),(3,'investment_out','投资支出','支出',1,3),(4,'investment_in','投资收入','收入',1,4),(5,'retired','历史停用','支出',0,5);
  INSERT INTO categories VALUES (1,'food',1,'餐饮','支出','日常',1,1),(2,'salary',2,'工资','收入','日常',1,2),(3,'loss',3,'投资亏损','支出','投资',1,3),(4,'gain',4,'投资收益','收入','投资',1,4),(5,'transfer',5,'转账支出','支出','往来',0,5),(6,'adjustment',1,'调整支出','支出','调整',0,6);
`
const records = `
  INSERT INTO transactions VALUES
    (1,'2025-01-01 09:00:00','收入',10000,2,NULL,NULL,NULL),
    (2,'2025-01-02 10:00:00','支出',10,1,NULL,NULL,NULL),
    (3,'2025-01-02 10:00:00','支出',20,1,'同名备注',NULL,NULL),
    (4,'2025-01-02 12:00:00','收入',500,4,'同名备注',NULL,NULL),
    (5,'2025-01-03 12:00:00','支出',700,3,NULL,NULL,NULL),
    (6,'2025-01-04 12:00:00','支出',1000,5,NULL,NULL,NULL),
    (7,'2025-01-05 12:00:00','支出',1,6,NULL,NULL,NULL),
    (8,'2026-01-02 12:00:00','支出',200,1,NULL,NULL,NULL);
  INSERT INTO tags VALUES (1,'标签 A'),(2,'标签, B');
  INSERT INTO transaction_tags VALUES (3,1,'manual'),(3,2,'inferred');
`
function fixture(extra = '', includeRecords = true) {
  const db = new SQL.Database()
  try { db.run(schema + (includeRecords ? records : '') + extra); return db.export() }
  finally { db.close() }
}

test('v3 读取关联分类、历史停用与多个标签，保留同日同名交易', () => {
  const ledger = readLedger(SQL, fixture(), 'synthetic.sqlite3')
  assert.equal(ledger.transactions.length, 8)
  assert.equal(ledger.transactions.find(t => t.id === 3).tags.length, 2)
  assert.equal(ledger.transactions.find(t => t.id === 3).tags[1].name, '标签, B')
  assert.equal(ledger.transactions.find(t => t.id === 3).tags[1].source, 'inferred')
  assert.equal(ledger.transactions.find(t => t.id === 6).active, false)
  assert.equal(ledger.transactions.find(t => t.id === 2).name, '餐饮')
  assert.deepEqual(ledger.years, [2026, 2025])
  assert.equal(ledger.firstDate, '2025-01-01')
  assert.equal(ledger.cutoff, '2026-01-02 12:00:00')
})

test('按整数分汇总全部性质，不因多标签或停用分类丢失或重复金额', () => {
  const ledger = readLedger(SQL, fixture())
  const total = ledgerTotals(ledger, 2025, 'year', 1)
  assert.equal(total.incomeCents, 10500)
  assert.equal(total.expenseCents, 1731)
  assert.equal(total.balanceCents, 8769)
  assert.equal(total.balance, 87.69)
  assert.equal(ledgerTotals(ledger, 2025, 'year', 1, '日常').expense, 0.3)
  assert.equal(ledgerTotals(ledger, 2025, 'year', 1, '投资').balance, -2)
  assert.equal(ledgerTotals(ledger, 2025, 'year', 1, '往来').expense, 10)
  assert.equal(ledgerTotals(ledger, 2025, 'year', 1, '调整').expense, 0.01)
})

test('分类和分组合计与总览相等，按金额排序，保留历史停用分类', () => {
  const ledger = readLedger(SQL, fixture())
  for (const level of ['category', 'group']) {
    const items = ledgerCategories(ledger, { year: 2025 }, 'expense', level)
    assert.equal(items.reduce((sum, item) => sum + item.cents, 0), 1731)
    assert.equal(items[0].cents, 1000)
  }
  assert.equal(ledgerCategories(ledger, { year: 2025 }, 'expense')[0].active, false)
  assert.deepEqual(ledgerCategories(ledger, { year: 2024 }, 'income'), [])
})

test('日历按整日汇总收支，包含多笔交易且不抵消收入与支出', () => {
  const ledger = readLedger(SQL, fixture())
  const entries = selectTransactions(ledger, { year: 2025, mode: 'month', month: 1 })
  const day = dailySummaries(entries).get(2)
  assert.equal(day.count, 3)
  assert.equal(day.incomeCents, 500)
  assert.equal(day.expenseCents, 30)
  assert.equal(day.balance, 4.7)
})

test('快照以外的月份为缺失值；范围内无交易为零；零收入的结余率不适用', () => {
  const ledger = readLedger(SQL, fixture())
  assert.equal(ledgerTotals(ledger, 2026, 'year', 1).rate, null)
  assert.equal(ledgerYearData(ledger, 2025)[1].income, 0)
  assert.equal(ledgerYearData(ledger, 2026)[1].income, null)
  assert.equal(ledgerTotals(ledger, 2026, 'month', 2).balance, null)
  const empty = readLedger(SQL, fixture('', false))
  assert.deepEqual(empty.years, [])
  assert.equal(empty.cutoff, null)
  assert.equal(ledgerYearData(empty, 2026)[0].income, null)
  assert.equal(summarize([]).rate, null)
})

test('去年同期按快照截止日期对齐，缺少基期时不生成百分比', () => {
  const ledger = readLedger(SQL, fixture())
  const previous = previousPeriodTotals(ledger, 2026, 'year', 1)
  assert.equal(previous.expenseCents, 30) // Only Jan 1–2, not Jan 3–5.
  assert.equal(previous.incomeCents, 10500)
  assert.match(previous.label, /1\/2/)
  assert.equal(previousPeriodTotals(ledger, 2025, 'year', 1), null)
  assert.equal(previousPeriodTotals(ledger, 2026, 'month', 2), null)
})

test('导出保留两位小数、统计口径、缺失月份和交易数', () => {
  const ledger = readLedger(SQL, fixture())
  const csv = summaryCsv(ledgerYearData(ledger, 2026, '日常'), 2026, '日常')
  assert.ok(csv.startsWith('\ufeff'))
  assert.ok(csv.includes('2026-01,日常,0.00,2.00,-2.00,1,账本内记录'))
  assert.ok(csv.includes('2026-02,日常,,,,0,超出账本日期范围'))
  assert.ok(summaryCsv([{ month: 1, income: 100, expense: 10, balance: 90 }], 2026, 'all', 'demo').includes('示例数据'))
})

test('拒绝 JSON 清单、非账本 SQLite、未知版本、缺字段和损坏的快照', () => {
  assert.throws(() => readLedger(SQL, new TextEncoder().encode('{"schema_version":3}')), /JSON/)
  const unrelated = new SQL.Database()
  unrelated.run('CREATE TABLE other (id INTEGER)')
  assert.throws(() => readLedger(SQL, unrelated.export()), /缺少 metadata/)
  unrelated.close()
  assert.throws(() => readLedger(SQL, fixture("UPDATE metadata SET value='4'")), /版本 4/)
  assert.throws(() => readLedger(SQL, fixture('ALTER TABLE transactions RENAME COLUMN amount_cents TO amount')), /amount_cents/)
  assert.throws(() => readLedger(SQL, fixture().slice(0, 200)), /数据库|database/i)
})

test('拒绝关联损坏、方向不匹配、非法日期或不安全的金额', () => {
  assert.throws(() => readLedger(SQL, fixture('DELETE FROM categories WHERE id=1')), /关联/)
  assert.throws(() => readLedger(SQL, fixture("UPDATE transactions SET direction='收入' WHERE id=2")), /方向/)
  assert.throws(() => readLedger(SQL, fixture("UPDATE transactions SET occurred_at='2025-02-29 12:00:00' WHERE id=2")), /日期/)
  assert.throws(() => readLedger(SQL, fixture('UPDATE transactions SET amount_cents=0 WHERE id=2')), /金额/)
  assert.throws(() => readLedger(SQL, fixture('UPDATE transactions SET amount_cents=9007199254740992 WHERE id=2')), /金额/)
})

test('真实快照：与原生 SQLite 逐月、分类、性质、每日及投资汇总对账，文件哈希不变', { skip: !process.env.FINPLOT_LEDGER_FILE }, () => {
  const path = process.env.FINPLOT_LEDGER_FILE
  const bytes = readFileSync(path)
  const digest = input => createHash('sha256').update(input).digest('hex')
  const before = digest(bytes)
  const ledger = readLedger(SQL, bytes)
  const expected = JSON.parse(execFileSync('python3', ['-c', `
import json,sqlite3,sys,pathlib
c=sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri()+'?mode=ro',uri=True)
q="SELECT substr(t.occurred_at,1,7),t.direction,c.nature,c.id,c.group_id,SUM(t.amount_cents),COUNT(*) FROM transactions t JOIN categories c ON c.id=t.category_id GROUP BY 1,2,3,4,5"
daily=c.execute("SELECT substr(occurred_at,1,10),direction,SUM(amount_cents),COUNT(*) FROM transactions GROUP BY 1,2").fetchall()
print(json.dumps({'groups':c.execute(q).fetchall(),'daily':daily,'count':c.execute('SELECT COUNT(*) FROM transactions').fetchone()[0]}))
c.close()
`, path], { encoding: 'utf8' }))
  assert.equal(ledger.transactions.length, expected.count)
  for (const [period, direction, nature, categoryId, groupId, cents, count] of expected.groups) {
    const [year, month] = period.split('-').map(Number)
    const entries = selectTransactions(ledger, { year, mode: 'month', month, nature }).filter(t => t.direction === direction && t.categoryId === categoryId)
    assert.equal(entries.reduce((sum, t) => sum + t.amountCents, 0), cents)
    assert.equal(entries.length, count)
    assert.ok(entries.every(t => t.groupId === groupId))
  }
  for (const [date, direction, cents, count] of expected.daily) {
    const entries = ledger.transactions.filter(t => t.date === date && t.direction === direction)
    assert.equal(entries.reduce((sum, t) => sum + t.amountCents, 0), cents)
    assert.equal(entries.length, count)
  }
  for (const year of ledger.years) {
    for (let month = 1; month <= 12; month++) {
      const total = ledgerTotals(ledger, year, 'month', month)
      for (const type of ['income', 'expense']) {
        const grouped = ledgerCategories(ledger, { year, month, mode: 'month' }, type)
        assert.equal(grouped.reduce((sum, item) => sum + item.cents, 0), total[`${type}Cents`])
      }
    }
  }
  if (process.env.FINPLOT_LEDGER_MANIFEST) {
    const manifest = JSON.parse(readFileSync(process.env.FINPLOT_LEDGER_MANIFEST, 'utf8'))
    assert.equal(before, manifest.snapshot_sha256)
    assert.equal(ledger.transactions.length, manifest.database.transaction_count)
    assert.equal(ledger.incomeCount, manifest.database.income_count)
    assert.equal(ledger.expenseCount, manifest.database.expense_count)
    assert.equal(ledger.cutoff, manifest.database.data_cutoff)
  }
  assert.equal(digest(readFileSync(path)), before)
})
