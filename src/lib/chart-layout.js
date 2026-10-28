// Match the panel primitive's three-significant-digit flex precision in both
// rows, keeping the original approximately 5:4 columns aligned to the pixel.
export const OVERVIEW_ALIGNED_SIZE = 55.6
export const CHART_SNAP_DISTANCE = 10
export const CHART_SNAP_RELEASE_DISTANCE = 18

export function snapOverviewSize(size, availableWidth, latched = false) {
  if (!Number.isFinite(size) || !Number.isFinite(availableWidth) || availableWidth <= 0) return size
  const distance = Math.abs(size - OVERVIEW_ALIGNED_SIZE) * availableWidth / 100
  return distance <= (latched ? CHART_SNAP_RELEASE_DISTANCE : CHART_SNAP_DISTANCE)
    ? OVERVIEW_ALIGNED_SIZE : size
}
