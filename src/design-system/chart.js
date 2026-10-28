// CSS remains the single source of truth; SVG and HTML both resolve these tokens.
export const chartSeries = Object.freeze([
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
])

export function withChartColors(items) {
  return items.map((item, index) => ({ ...item, color: chartSeries[index % chartSeries.length] }))
}

// Shared shadcn chart configuration; values reference the Finplot tokens.
export const financialChartConfig = Object.freeze({
  income: { label: '收入', color: 'var(--income)' },
  expense: { label: '支出', color: 'var(--expense)' },
  balance: { label: '结余', color: 'var(--income)' },
  value: { label: '盈亏', color: 'var(--income)' },
})
