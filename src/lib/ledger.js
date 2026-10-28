// StaffX schema v3. All arithmetic stays in integer cents until presentation.
export const NATURES = ['日常', '投资', '往来', '调整']
export const MAX_LEDGER_BYTES = 100 * 1024 * 1024

const requiredColumns = {
  metadata: ['key', 'value'],
  transactions: ['id', 'occurred_at', 'direction', 'amount_cents', 'category_id', 'note', 'source_category', 'source_record_id'],
  categories: ['id', 'code', 'group_id', 'name', 'direction', 'nature', 'active', 'sort_order'],
  category_groups: ['id', 'code', 'name', 'direction', 'active', 'sort_order'],
  tags: ['id', 'name'],
  transaction_tags: ['transaction_id', 'tag_id', 'source'],
}

function rows(db, sql) {
  const result = db.exec(sql)[0]
  return result ? result.values.map(values => Object.fromEntries(result.columns.map((key, index) => [key, values[index]]))) : []
}

export function readLedger(SQL, input, filename = '账本.sqlite3') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength > MAX_LEDGER_BYTES) throw new Error('账本超过 100 MB，请选择较小的 SQLite 快照。')
  if (new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\0') {
    throw new Error('请选择 SQLite 数据库文件（.sqlite、.sqlite3 或 .db）；JSON 备份清单不包含交易数据。')
  }
  let db
  try {
    db = new SQL.Database(bytes)
    db.run('PRAGMA query_only = ON')
    const tables = new Set(rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map(row => row.name))
    for (const [table, columns] of Object.entries(requiredColumns)) {
      if (!tables.has(table)) throw new Error(`账本格式不匹配：缺少 ${table} 表，需要 StaffX schema v3。`)
      const actual = new Set(rows(db, `PRAGMA table_info("${table}")`).map(row => row.name))
      const missing = columns.filter(column => !actual.has(column))
      if (missing.length) throw new Error(`账本格式不匹配：${table} 缺少字段 ${missing.join('、')}。`)
    }
    const version = rows(db, "SELECT value FROM metadata WHERE key = 'schema_version'")[0]?.value
    if (String(version) !== '3') throw new Error(`暂不支持账本版本 ${version ?? '未知'}，当前支持 StaffX schema v3。`)
    const integrity = rows(db, 'PRAGMA quick_check')
    if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') throw new Error('数据库完整性检查失败，请重新导出完整快照。')
    if (rows(db, 'PRAGMA foreign_key_check').length) throw new Error('账本存在无效的关联记录，请修复后重新导入。')

    // Read tags separately: a many-to-many join must never multiply money.
    const tagMap = new Map()
    for (const tag of rows(db, `SELECT tt.transaction_id, tag.name, tt.source
      FROM transaction_tags tt JOIN tags tag ON tag.id = tt.tag_id ORDER BY tag.id`)) {
      const tags = tagMap.get(tag.transaction_id) ?? []
      tags.push({ name: tag.name, source: tag.source })
      tagMap.set(tag.transaction_id, tags)
    }
    const records = rows(db, `SELECT t.id, t.occurred_at, t.direction, t.amount_cents, t.note,
      t.source_category, t.source_record_id, c.id AS category_id, c.code AS category_code,
      c.name AS category, c.nature, c.active, c.sort_order,
      c.direction AS category_direction, g.direction AS group_direction,
      g.id AS group_id, g.name AS category_group, g.sort_order AS group_sort_order
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_groups g ON g.id = c.group_id
      ORDER BY t.occurred_at DESC, t.id DESC`)
    const seenIds = new Set()
    let totalCents = 0
    const transactions = records.map(row => {
      if (!Number.isSafeInteger(row.id) || seenIds.has(row.id)) throw new Error('账本存在无效或重复的交易编号。')
      seenIds.add(row.id)
      if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents <= 0) throw new Error(`交易 ${row.id} 的金额必须为正整数分。`)
      totalCents += row.amount_cents
      if (!Number.isSafeInteger(totalCents)) throw new Error('账本金额合计超出安全计算范围。')
      if (!['收入', '支出'].includes(row.direction) || row.category_direction !== row.direction || row.group_direction !== row.direction || !NATURES.includes(row.nature)) {
        throw new Error(`交易 ${row.id} 的分类、方向或性质无效。`)
      }
      const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(row.occurred_at)
      const [year, month, day, hour, minute, second] = match ? match.slice(1).map(Number) : []
      if (!match || year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate() || hour > 23 || minute > 59 || second > 59) {
        throw new Error(`交易 ${row.id} 的日期无效，需为 YYYY-MM-DD HH:mm:ss。`)
      }
      return {
        id: row.id, occurredAt: row.occurred_at, date: row.occurred_at.slice(0, 10), year, month, day,
        direction: row.direction, amountCents: row.amount_cents,
        amount: (row.direction === '收入' ? 1 : -1) * row.amount_cents / 100,
        categoryId: row.category_id, categoryCode: row.category_code, category: row.category,
        groupId: row.group_id, group: row.category_group, nature: row.nature,
        active: Boolean(row.active), sortOrder: row.sort_order, groupSortOrder: row.group_sort_order,
        note: row.note ?? '', name: row.note?.trim() || row.category,
        sourceCategory: row.source_category, sourceRecordId: row.source_record_id,
        tags: tagMap.get(row.id) ?? [],
        icon: row.direction === '收入' ? 'income' : /吃饭|饮料|零食/.test(row.category) ? 'coffee' : /交通|汽车/.test(row.category) ? 'travel' : /住房|房贷/.test(row.category) ? 'home' : 'shopping',
      }
    })
    const years = [...new Set(transactions.map(row => row.year))].sort((a, b) => b - a)
    return {
      filename, schemaVersion: 3, transactions, years,
      firstDate: transactions.at(-1)?.date ?? null,
      lastDate: transactions[0]?.date ?? null,
      cutoff: transactions[0]?.occurredAt ?? null,
      incomeCount: transactions.filter(row => row.direction === '收入').length,
      expenseCount: transactions.filter(row => row.direction === '支出').length,
    }
  } catch (error) {
    if (/file is not a database|malformed|disk image|out of bounds/i.test(error.message)) {
      throw new Error('无法读取数据库：文件可能损坏或已加密，请选择完整的 SQLite 快照。')
    }
    throw error
  } finally {
    db?.close()
  }
}

export function selectTransactions(ledger, { year, month, mode = 'year', nature = 'all' } = {}) {
  return ledger.transactions.filter(t => (year == null || t.year === Number(year)) &&
    (mode !== 'month' || t.month === Number(month)) && (nature === 'all' || t.nature === nature))
}

export function summarize(transactions) {
  let incomeCents = 0, expenseCents = 0
  for (const t of transactions) {
    if (t.direction === '收入') incomeCents += t.amountCents
    else expenseCents += t.amountCents
  }
  const balanceCents = incomeCents - expenseCents
  return { incomeCents, expenseCents, balanceCents, income: incomeCents / 100,
    expense: expenseCents / 100, balance: balanceCents / 100,
    rate: incomeCents ? balanceCents / incomeCents * 100 : null, count: transactions.length }
}

export function ledgerTotals(ledger, year, mode, month, nature = 'all') {
  const summary = summarize(selectTransactions(ledger, { year, mode, month, nature }))
  const prefix = mode === 'month' ? `${year}-${String(month).padStart(2, '0')}` : String(year)
  const available = Boolean(ledger.firstDate && prefix >= ledger.firstDate.slice(0, prefix.length) && prefix <= ledger.lastDate.slice(0, prefix.length))
  return available ? { ...summary, available } : { ...summary, available, income: null, expense: null, balance: null, rate: null }
}

export function previousPeriodTotals(ledger, year, mode, month, nature = 'all') {
  const pad = value => String(value).padStart(2, '0')
  const start = `${year}-${mode === 'month' ? pad(month) : '01'}-01`
  const end = mode === 'month' ? `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}` : `${year}-12-31`
  if (!ledger.lastDate || start > ledger.lastDate || start < ledger.firstDate) return null
  const cutoff = ledger.lastDate < end ? ledger.lastDate : end
  const previousStart = `${year - 1}${start.slice(4)}`
  const endMonth = Number(cutoff.slice(5, 7))
  const endDay = Math.min(Number(cutoff.slice(8, 10)), new Date(year - 1, endMonth, 0).getDate())
  const previousEnd = `${year - 1}-${pad(endMonth)}-${pad(endDay)}`
  if (previousStart < ledger.firstDate) return null
  const summary = summarize(selectTransactions(ledger, { year: year - 1, mode, month, nature })
    .filter(t => t.date >= previousStart && t.date <= previousEnd))
  return { ...summary, label: cutoff < end ? `去年同期（截至 ${endMonth}/${endDay}）` : '去年同期' }
}

export function ledgerYearData(ledger, year, nature = 'all') {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const summary = ledgerTotals(ledger, year, 'month', month, nature)
    const key = `${year}-${String(month).padStart(2, '0')}`
    // Outside the snapshot's coverage, a missing month isn't a zero cashflow.
    const available = Boolean(ledger.firstDate && key >= ledger.firstDate.slice(0, 7) && key <= ledger.lastDate.slice(0, 7))
    return { ...summary, month, name: `${month}月`, available,
      income: available ? summary.income : null,
      expense: available ? summary.expense : null,
      balance: available ? summary.balance : null }
  })
}

export function ledgerCategories(ledger, options, type, level = 'category') {
  const direction = type === 'income' ? '收入' : '支出'
  const items = new Map()
  let total = 0
  for (const t of selectTransactions(ledger, options).filter(t => t.direction === direction)) {
    const id = level === 'group' ? t.groupId : t.categoryId
    const item = items.get(id) ?? { id, name: level === 'group' ? t.group : t.category,
      group: t.group, nature: t.nature, active: t.active, cents: 0, count: 0,
      sortOrder: level === 'group' ? t.groupSortOrder : t.sortOrder }
    item.cents += t.amountCents
    item.count++
    items.set(id, item)
    total += t.amountCents
  }
  return [...items.values()].sort((a, b) => b.cents - a.cents || a.sortOrder - b.sortOrder)
    .map(item => ({ ...item, value: item.cents / 100, share: total ? item.cents / total : 0 }))
}

export function dailySummaries(transactions) {
  const days = new Map()
  for (const t of transactions) {
    const day = days.get(t.day) ?? []
    day.push(t)
    days.set(t.day, day)
  }
  return new Map([...days].map(([day, entries]) => [day, summarize(entries)]))
}
