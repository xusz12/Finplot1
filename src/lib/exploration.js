import { selectTransactions, summarize } from './ledger.js'

export const emptyOverviewFilters = () => ({ type: 'all', group: null, category: null, query: '' })
export const directionFor = type => type === 'income' ? '收入' : type === 'expense' ? '支出' : null

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[¥￥]/g, '').replace(/−/g, '-').trim()
const searchIndex = new WeakMap()

function searchableText(t) {
  if (searchIndex.has(t)) return searchIndex.get(t)
  const sign = t.direction === '收入' ? '+' : '-'
  const amount = (t.amountCents / 100).toFixed(2)
  const formatted = (t.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
  const text = normalize([t.name, t.note, t.category, t.group, t.nature, t.direction,
    t.date, t.occurredAt, `${t.year}年${t.month}月${t.day}日`, t.sourceCategory, t.sourceRecordId,
    amount, formatted, `${sign}${amount}`, `${sign}${formatted}`,
    ...(t.tags ?? []).map(tag => `#${tag.name}`)].filter(value => value != null).join(' '))
  // Parsed records are immutable. Weak keys release the index on ledger replacement.
  searchIndex.set(t, text)
  return text
}

// All query terms must match; text is never interpreted as a regular expression.
export function searchTransactions(transactions, query = '') {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return transactions
  return transactions.filter(t => {
    const text = searchableText(t)
    return terms.every(term => text.includes(term))
  })
}

export function filterTransactions(transactions, { type = 'all', group = null, category = null, query = '' } = {}) {
  const direction = directionFor(type)
  return searchTransactions(transactions.filter(t => (!direction || t.direction === direction) &&
    (!group || t.groupId === group.id) && (!category || t.categoryId === category.id)), query)
}

export function exploreTransactions(ledger, period, filters) {
  return filterTransactions(selectTransactions(ledger, period), filters)
}

export function groupTransactions(transactions, type, level = 'group') {
  const items = new Map()
  let total = 0
  for (const t of transactions) {
    if (t.direction !== directionFor(type)) continue
    const id = level === 'group' ? t.groupId : t.categoryId
    const item = items.get(id) ?? { id, name: level === 'group' ? t.group : t.category,
      group: t.group, groupId: t.groupId, nature: t.nature, active: t.active,
      sortOrder: level === 'group' ? t.groupSortOrder : t.sortOrder, cents: 0, count: 0 }
    item.cents += t.amountCents
    item.count++
    total += t.amountCents
    items.set(id, item)
  }
  return [...items.values()].sort((a, b) => b.cents - a.cents || a.sortOrder - b.sortOrder)
    .map(item => ({ ...item, value: item.cents / 100, share: total ? item.cents / total : 0 }))
}

export function explorationSeries(ledger, year, transactions) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1, prefix = `${year}-${String(month).padStart(2, '0')}`
    const available = Boolean(ledger.firstDate && prefix >= ledger.firstDate.slice(0, 7) && prefix <= ledger.lastDate.slice(0, 7))
    const summary = summarize(transactions.filter(t => t.year === year && t.month === month))
    return { ...summary, month, name: `${month}月`, available,
      income: available ? summary.income : null, expense: available ? summary.expense : null,
      balance: available ? summary.balance : null }
  })
}
