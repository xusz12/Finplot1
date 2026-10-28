import { categories, yearData } from '../data.js'

const children = {
  生活购物: ['日常用品', '服饰鞋包'], 居住: ['房租', '水电燃气'], 餐饮美食: ['日常餐饮', '咖啡茶饮'],
  交通出行: ['公共交通', '打车'], 休闲娱乐: ['电影演出', '旅行'], 其他支出: ['礼物', '其他消费'],
  工资薪酬: ['月薪', '奖金'], 投资收益: ['基金分红', '利息'], 兼职收入: ['设计项目', '咨询'], 其他收入: ['报销', '红包'],
}
const pad = value => String(value).padStart(2, '0')

// Deterministic fictional transactions reconcile exactly with the sample totals.
// Charts, search and calendar all use these same records.
export function createDemoLedger(years = [2025, 2024, 2023]) {
  const transactions = []
  for (const year of years) for (const row of yearData(year)) for (const type of ['income', 'expense']) {
    categories(type, row[type]).forEach((group, groupIndex) => {
      const groupId = `${type}-${groupIndex}`, groupCents = Math.round(group.value * 100)
      children[group.name].forEach((category, childIndex) => {
        const cents = childIndex ? groupCents - Math.round(groupCents * .7) : Math.round(groupCents * .7)
        const count = type === 'income' || category === '房租' ? 1 : 5
        for (let n = 0; n < count; n++) {
          const day = type === 'income' ? 25 - groupIndex * 4 + childIndex : 1 + (groupIndex * 7 + childIndex * 11 + n * 5 + row.month) % 28
          const date = `${year}-${pad(row.month)}-${pad(day)}`
          const amountCents = Math.floor(cents / count) + (n < cents % count ? 1 : 0)
          transactions.push({ id: `demo-${year}-${row.month}-${groupId}-${childIndex}-${n}`,
            date, occurredAt: `${date} ${pad(type === 'income' ? 9 : 12 + n)}:30:00`, year, month: row.month, day,
            direction: type === 'income' ? '收入' : '支出', amountCents, amount: (type === 'income' ? 1 : -1) * amountCents / 100,
            name: category, note: `${category} · 虚构示例`, category, categoryId: `${groupId}-${childIndex}`,
            group: group.name, groupId, nature: group.name === '投资收益' ? '投资' : '日常',
            active: true, sortOrder: childIndex, groupSortOrder: groupIndex,
            sourceRecordId: null, sourceCategory: null, tags: [{ name: '示例' }], code: '虚构示例',
            icon: type === 'income' ? 'income' : groupIndex === 2 ? 'coffee' : groupIndex === 1 ? 'home' : groupIndex === 3 ? 'travel' : 'shopping' })
        }
      })
    })
  }
  transactions.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
  return { transactions, years: [...years].sort((a, b) => b - a), firstDate: `${Math.min(...years)}-01-01`,
    lastDate: `${Math.max(...years)}-12-31`, filename: '虚构示例账本' }
}

export const demoLedger = createDemoLedger()
