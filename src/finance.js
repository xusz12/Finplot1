import * as demo from './data.js'
import { useApp } from './store.js'
import { ledgerCategories, ledgerTotals, ledgerYearData, selectTransactions } from './lib/ledger.js'

export const money = (value, decimals = 2) => value == null ? '—' : demo.money(value, decimals)
export const percent = share => share > 0 && share < 0.001 ? '<0.1' : (share * 100).toFixed(1)

export function useFinance() {
  const { ledger, year, mode, month, nature } = useApp()
  return {
    yearData: selectedYear => ledger ? ledgerYearData(ledger, selectedYear, nature) : demo.yearData(selectedYear),
    totals: (selectedYear, selectedMode, selectedMonth) => ledger ? ledgerTotals(ledger, selectedYear, selectedMode, selectedMonth, nature) : demo.totals(selectedYear, selectedMode, selectedMonth),
    categories: (type, amount, level = 'category') => ledger ? ledgerCategories(ledger, { year, mode, month, nature }, type, level) : demo.categories(type, amount),
    monthTransactions: (selectedYear, selectedMonth) => ledger ? selectTransactions(ledger, { year: selectedYear, mode: 'month', month: selectedMonth, nature }) : demo.monthTransactions(selectedYear, selectedMonth).map((t, id) => ({ ...t, id, tags: [], direction: t.amount > 0 ? '收入' : '支出', amountCents: Math.round(Math.abs(t.amount) * 100) })),
    investmentData: selectedYear => ledger ? selectTransactions(ledger, { year: selectedYear, nature: '投资' }) : demo.investmentData(selectedYear).map((t, id) => ({ ...t, id, direction: t.amount > 0 ? '收入' : '支出', amountCents: Math.round(Math.abs(t.amount) * 100) })),
  }
}
