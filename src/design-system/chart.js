// CSS remains the single source of truth; SVG and HTML both resolve these tokens.
export const chartSeries = Object.freeze([
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
])

export function withChartColors(items) {
  return items.map((item, index) => ({ ...item, color: chartSeries[index % chartSeries.length] }))
}
