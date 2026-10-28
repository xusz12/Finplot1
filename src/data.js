const years = {
  2023: { income: [19000,20000,21500,22000,22500,24000,23000,25000,24000,24500,25000,28500], expense: [12900,13700,14000,15000,14700,15900,15400,17000,14100,15400,15500,18500] },
  2025: { income: [23000,23500,25500,26000,26200,30000,27500,30400,27800,28600,29200,35600], expense: [14800,15900,15200,17400,16200,18100,16800,19000,15400,17800,16900,20300] },
  2024: { income: [21000,22000,23000,24500,25000,26500,25500,27500,26000,26400,27200,31000], expense: [13900,14700,15000,16000,15700,16900,16400,18000,15100,16400,16500,19500] },
}
export function yearData(year) {
  const data = years[year] || years[2025]
  return data.income.map((income, i) => ({ month: i + 1, name: `${i + 1}月`, income, expense: data.expense[i], balance: income - data.expense[i] }))
}
export function totals(year, mode, month) {
  const data = yearData(year).filter(d => mode === 'year' || d.month === month)
  const income = data.reduce((a, b) => a + b.income, 0)
  const expense = data.reduce((a, b) => a + b.expense, 0)
  return { income, expense, balance: income - expense, rate: income ? (income - expense) / income * 100 : 0 }
}
export const money = (n, decimals = 0) => `¥${Number(n).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
export const categoryDefs = {
  expense: [
    { name: '生活购物', share: 0.26 }, { name: '居住', share: 0.23 },
    { name: '餐饮美食', share: 0.19 }, { name: '交通出行', share: 0.13 },
    { name: '休闲娱乐', share: 0.11 }, { name: '其他支出', share: 0.08 },
  ],
  income: [
    { name: '工资薪酬', share: 0.76 }, { name: '投资收益', share: 0.12 },
    { name: '兼职收入', share: 0.07 }, { name: '其他收入', share: 0.05 },
  ],
}
export function categories(type, amount) {
  let used = 0
  return categoryDefs[type].map((item, i, all) => {
    const value = i === all.length - 1 ? amount - used : Math.round(amount * item.share)
    used += value
    return { ...item, value }
  })
}
export const baseTransactions = [
  { day: 28, name: '日常采购', category: '生活购物', amount: -428, icon: 'shopping' },
  { day: 26, name: '周末咖啡', category: '餐饮美食', amount: -86, icon: 'coffee' },
  { day: 25, name: '工资收入', category: '工资薪酬', amount: 21000, icon: 'income' },
  { day: 22, name: '城市出行', category: '交通出行', amount: -128, icon: 'travel' },
  { day: 18, name: '生活缴费', category: '居住', amount: -680, icon: 'home' },
  { day: 15, name: '电影与晚餐', category: '休闲娱乐', amount: -368, icon: 'spark' },
  { day: 12, name: '基金分红', category: '投资收益', amount: 860, icon: 'income' },
  { day: 8, name: '生鲜超市', category: '生活购物', amount: -256, icon: 'shopping' },
  { day: 5, name: '房租', category: '居住', amount: -3400, icon: 'home' },
  { day: 2, name: '早餐与咖啡', category: '餐饮美食', amount: -42, icon: 'coffee' },
]
export const investments = [
  { month: 12, day: 18, name: '沪深 300 指数基金', code: '基金 · 000300', action: '卖出', amount: 3240, type: '基金' },
  { month: 10, day: 22, name: '纳斯达克 100 ETF', code: 'ETF · 513100', action: '卖出', amount: 2680, type: 'ETF' },
  { month: 10, day: 12, name: '红利低波动 ETF', code: 'ETF · 512890', action: '分红', amount: 860, type: 'ETF' },
  { month: 9, day: 26, name: '科技成长股票', code: '股票 · 示例', action: '卖出', amount: -1230, type: '股票' },
  { month: 8, day: 15, name: '中短债债券基金', code: '基金 · 示例', action: '分红', amount: 720, type: '基金' },
  { month: 6, day: 11, name: '消费行业指数基金', code: '基金 · 示例', action: '卖出', amount: -680, type: '基金' },
  { month: 3, day: 8, name: '沪深 300 指数基金', code: '基金 · 000300', action: '分红', amount: 1280, type: '基金' },
]

export function monthTransactions(year, month) {
  const period = totals(year, 'month', month)
  return baseTransactions.map(t => ({ ...t, amount: Math.round(t.amount * (t.amount > 0 ? period.income / 28600 : period.expense / 17800)) }))
}
export function investmentData(year) {
  return year === 2024 ? investments.map(t => ({ ...t, amount: Math.round(t.amount * 0.78) })) : investments
}
