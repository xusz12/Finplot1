import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useApp = create(persist((set) => ({
  page: 'overview', year: 2025, mode: 'year', month: 10,
  metricOrder: ['income', 'expense', 'balance', 'rate'],
  setPage: (page) => set({ page }),
  setYear: (year) => set({ year: Number(year) }), setMode: (mode) => set({ mode }),
  setMonth: (month) => set({ month: Number(month) }), setMetricOrder: (metricOrder) => set({ metricOrder }),
}), {
  name: 'finplot-prototype',
  partialize: (s) => ({ metricOrder: s.metricOrder }),
  merge: (persisted, current) => ({ ...current, metricOrder: persisted?.metricOrder ?? current.metricOrder }),
}))
