import * as demo from './data.js'
import { useApp } from './store.js'
import { ledgerCategories, ledgerTotals, ledgerYearData, selectTransactions } from './lib/ledger.js'
import { demoLedger } from './lib/demo-ledger.js'

export const money = (value, decimals = 2) => value == null ? '—' : demo.money(value, decimals)
export const percent = share => share > 0 && share < 0.001 ? '<0.1' : (share * 100).toFixed(1)

export function useFinance() {
  const { ledger, year, mode, month, nature } = useApp()
  const source = ledger ?? demoLedger
  return {
    source,
    yearData: selectedYear => ledgerYearData(source, selectedYear, nature),
    totals: (selectedYear, selectedMode, selectedMonth) => ledgerTotals(source, selectedYear, selectedMode, selectedMonth, nature),
    categories: (type, amount, level = 'category') => ledgerCategories(source, { year, mode, month, nature }, type, level),
    monthTransactions: (selectedYear, selectedMonth) => selectTransactions(source, { year: selectedYear, mode: 'month', month: selectedMonth, nature }),
    investmentData: selectedYear => selectTransactions(source, { year: selectedYear, nature: '投资' }),
  }
}
