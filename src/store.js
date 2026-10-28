import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useApp = create(persist((set, get) => ({
  page: 'overview', year: 2025, mode: 'year', month: 10, calendarDay: 28,
  metricOrder: ['income', 'expense', 'balance', 'rate'],
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
