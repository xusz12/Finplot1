import { summarize } from './ledger.js'

export const heatLevel = (cents, maximum) => cents > 0 && maximum > 0 ? Math.min(4, Math.max(1, Math.ceil(cents / maximum * 4))) : 0

// UTC is used only for date arithmetic, so DST cannot skip or duplicate a day.
export function calendarHeatmap(ledger, year, transactions) {
  const byDate = new Map()
  for (const t of transactions) {
    if (t.year !== year) continue
    const entries = byDate.get(t.date) ?? []
    entries.push(t)
    byDate.set(t.date, entries)
  }
  const daily = new Map([...byDate].map(([date, entries]) => [date, summarize(entries)]))
  const maximum = { income: 0, expense: 0 }
  for (const day of daily.values()) {
    maximum.income = Math.max(maximum.income, day.incomeCents)
    maximum.expense = Math.max(maximum.expense, day.expenseCents)
  }
  const first = new Date(Date.UTC(year, 0, 1)), offset = (first.getUTCDay() + 6) % 7
  const length = Math.round((Date.UTC(year + 1, 0, 1) - first.getTime()) / 86400000)
  const days = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
    const date = new Date(Date.UTC(year, 0, i - offset + 1))
    if (date.getUTCFullYear() !== year) return null
    const key = date.toISOString().slice(0, 10), summary = daily.get(key) ?? summarize([])
    return { ...summary, date: key, year, month: date.getUTCMonth() + 1, day: date.getUTCDate(),
      week: Math.floor(i / 7), weekday: i % 7,
      available: Boolean(ledger.firstDate && key >= ledger.firstDate && key <= ledger.lastDate),
      incomeLevel: heatLevel(summary.incomeCents, maximum.income), expenseLevel: heatLevel(summary.expenseCents, maximum.expense) }
  })
  return { days, weeks: days.length / 7, maximum, activeDays: daily.size,
    months: days.filter(day => day?.day === 1).map(day => ({ month: day.month, week: day.week })) }
}
