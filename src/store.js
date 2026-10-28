import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyOverviewFilters } from './lib/exploration.js'

export const useApp = create(persist((set, get) => ({
  page: 'overview', year: 2025, mode: 'year', month: 10, calendarDay: 28, calendarNavigation: 0,
  metricOrder: ['income', 'expense', 'balance', 'rate'],
  overviewFilters: emptyOverviewFilters(), searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setOverviewQuery: (query) => set(state => ({ overviewFilters: { ...state.overviewFilters, query } })),
  toggleOverviewType: (type) => set(state => ({ overviewFilters: { ...state.overviewFilters,
    type: state.overviewFilters.type === type ? 'all' : type, group: null, category: null } })),
  setOverviewType: (type) => set(state => ({ overviewFilters: { ...state.overviewFilters, type, group: null, category: null } })),
  selectOverviewGroup: (group, type) => set(state => ({ overviewFilters: { ...state.overviewFilters,
    type, group: state.overviewFilters.group?.id === group.id ? null : group, category: null } })),
  selectOverviewCategory: (category) => set(state => ({ overviewFilters: { ...state.overviewFilters,
    category: state.overviewFilters.category?.id === category.id ? null : category } })),
  clearOverviewCategory: () => set(state => ({ overviewFilters: { ...state.overviewFilters, category: null } })),
  clearOverviewGroup: () => set(state => ({ overviewFilters: { ...state.overviewFilters, group: null, category: null } })),
  clearOverviewFilters: () => set({ overviewFilters: emptyOverviewFilters(), mode: 'year' }),
  toggleOverviewMonth: (month) => set(state => ({ month: Number(month),
    mode: state.mode === 'month' && state.month === Number(month) ? 'year' : 'month',
    calendarDay: Math.min(state.calendarDay, new Date(state.year, Number(month), 0).getDate()) })),
  openCalendarDate: ({ year, month, day, scopeNature }) => set(state => ({ page: 'calendar', year, month,
    nature: scopeNature ?? state.nature, calendarDay: Math.min(day, new Date(year, month, 0).getDate()),
    calendarNavigation: state.calendarNavigation + 1, searchOpen: false })),
  ledger: null, nature: 'all', ledgerLoading: true, ledgerError: '', ledgerNotice: '',
  serviceMode: 'connecting', serviceReady: false, service: null, serviceError: '', ledgerRevision: 'empty', legacyLedger: null,
  setNature: (nature) => set({ nature }),
  setLedger: (ledger) => set((state) => {
    const latest = ledger.transactions[0]
    return { ledger, nature: 'all', overviewFilters: emptyOverviewFilters(), ledgerError: '', ledgerNotice: '',
      year: latest?.year ?? state.year, month: latest?.month ?? state.month,
      calendarDay: latest?.day ?? state.calendarDay }
  }),
  clearLedger: () => set({ ledger: null, nature: 'all', overviewFilters: emptyOverviewFilters(), year: 2025, month: 10, calendarDay: 28, ledgerError: '', ledgerNotice: '' }),
  setPage: (page) => set({ page }),
  // Update the period and selection together, including cross-year navigation.
  setPeriod: (year, month) => set((state) => ({
    year: Number(year),
    month: Number(month),
    calendarDay: Math.min(state.calendarDay, new Date(Number(year), Number(month), 0).getDate()),
  })),
  setYear: (year) => get().setPeriod(year, get().month),
  setMonth: (month) => get().setPeriod(get().year, month),
  setCalendarDay: (calendarDay) => set({ calendarDay }),
  setMode: (mode) => set({ mode }),
  setMetricOrder: (metricOrder) => set({ metricOrder }),
}), {
  name: 'finplot-prototype',
  partialize: (s) => ({ metricOrder: s.metricOrder }),
  merge: (persisted, current) => ({ ...current, metricOrder: persisted?.metricOrder ?? current.metricOrder }),
}))
