export type StatBar = {
  label?: string
  value: number
  max: number
  color: string
}

export type MentorStats = {
  morale: StatBar
  academia: StatBar
  admin: StatBar
  integrity: StatBar
  funding: number
  reputation: number
  year: number
  quarter: 1 | 2 | 3 | 4
}

const clamp = (value: number, max: number, min = 0) => Math.min(max, Math.max(min, value))

const randomInRange = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

const academiaByAlma: Record<string, { min: number; max: number }> = {
  'QS Top 10': { min: 40, max: 40 },
  '清北 / 国内 TOP2': { min: 36, max: 39 },
  '华五': { min: 34, max: 37 },
  C9: { min: 32, max: 35 },
  '985': { min: 28, max: 33 },
  '211': { min: 24, max: 30 },
  '双非': { min: 20, max: 26 },
}

const adminBonusByAlma: Record<string, { min: number; max: number }> = {
  '985': { min: 2, max: 4 },
  '211': { min: 4, max: 6 },
  '双非': { min: 6, max: 8 },
}

export const buildInitialStats = (almaMater: string): MentorStats => {
  const academyRange = academiaByAlma[almaMater] ?? { min: 24, max: 32 }
  const academyValue = clamp(randomInRange(academyRange.min, academyRange.max), 100)

  const adminBase = randomInRange(20, 40)
  const bonusRange = adminBonusByAlma[almaMater]
  const adminBonus = bonusRange ? randomInRange(bonusRange.min, bonusRange.max) : 0
  const adminValue = clamp(adminBase + adminBonus, 100)

  const baseFunding = randomInRange(100000, 200000)

  return {
    morale: { value: 100, max: 100, color: '#3b82f6' },
    academia: { value: academyValue, max: 100, color: '#0ea5e9' },
    admin: { value: adminValue, max: 100, color: '#6366f1' },
    integrity: { value: 0, max: 100, color: '#f97316' },
    funding: baseFunding,
    reputation: 10,
    year: 1,
    quarter: 3,
  }
}

export const defaultStats: MentorStats = buildInitialStats('QS Top 10')

export const applyQuarterEffects = (stats: MentorStats): MentorStats => {
  const nextQuarter = stats.quarter === 4 ? 1 : ((stats.quarter + 1) as 1 | 2 | 3 | 4)
  const nextYear = stats.quarter === 4 ? stats.year + 1 : stats.year

  const moraleDelta = stats.quarter === 4 ? -6 : -3
  const academiaDelta = stats.quarter === 1 ? 4 : stats.quarter === 3 ? 6 : 2
  const adminDelta = stats.quarter === 2 ? 5 : 1
  const integrityDelta = stats.quarter === 3 ? 4 : 0
  const fundingDelta = stats.quarter === 1 ? -5000 : stats.quarter === 2 ? -8000 : stats.quarter === 3 ? -1000 : 2000
  const reputationDelta = stats.academia.value > 70 ? 1 : 0

  return {
    ...stats,
    morale: { ...stats.morale, value: clamp(stats.morale.value + moraleDelta, stats.morale.max) },
    academia: { ...stats.academia, value: clamp(stats.academia.value + academiaDelta, stats.academia.max) },
    admin: { ...stats.admin, value: clamp(stats.admin.value + adminDelta, stats.admin.max) },
    integrity: { ...stats.integrity, value: clamp(stats.integrity.value + integrityDelta, stats.integrity.max) },
    funding: Math.max(0, stats.funding + fundingDelta),
    reputation: stats.reputation + reputationDelta,
    year: nextYear,
    quarter: nextQuarter,
  }
}
