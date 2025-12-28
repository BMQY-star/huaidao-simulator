
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import './App.css';
import { studentTraits, type StudentTrait, type TraitCategory } from './data/studentTraits';
import { researchDirections } from './data/researchDirections';
import {
  defaultStats,
  type MentorStats,
  applyQuarterEffects,
  buildInitialStats,
} from './logic/gameState';

const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL || '';
const TEAM_DEFAULT_COUNT = 1;
const STORED_STATE_KEY = 'mentorSim.state';
const STORED_TEAM_KEY = 'mentorSim.teamMembers';
const fallbackProjectTitles = [
  '跨域数据稀疏建模与协同优化',
  '复杂系统稳态调控与鲁棒推理',
  '绿色算力调度与能耗协同机制',
  '多源信息融合驱动的智能决策',
  '非结构数据可信治理与评估',
  '模型对齐与安全可控路径研究',
  '高维表示压缩与快速检索方法',
  '跨场景迁移学习与应用落地',
];

const pickFallbackProjectTitle = () =>
  fallbackProjectTitles[Math.floor(Math.random() * fallbackProjectTitles.length)];

const getStoredState = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORED_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read stored state', error);
    return null;
  }
};

const getStoredTeamMembers = () => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORED_TEAM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Failed to read stored team', error);
    return null;
  }
};

type DashboardTab = 'home' | 'team' | 'research' | 'equipment';

type Discipline = {
  label: string;
  en: string;
  icon: string;
  accent: string;
};

type Department = {
  title: string;
  desc: string;
  icon: string;
  accent: string;
  note: string;
};

type StudentStatKey = 'diligence' | 'talent' | 'luck' | 'stress' | 'mentalState';

type ResearchProject = {
  id: string;
  title: string;
  category: '校内课题' | '横向合作' | '自由探索';
  progress: {
    literature: number;
    experiment: number;
    results: number;
  };
  assignedStudentIds: string[];
  createdYear: number;
  createdQuarter: number;
  completed: boolean;
};

type PaperVenueType = 'conference' | 'journal';
type PaperVenueTier = 'A' | 'B' | 'C';
type ProjectPaperStatus = 'awaitingVenue' | 'underReview' | 'awaitingRevision' | 'accepted' | 'rejected';

type ProjectPaper = {
  id: string;
  projectId: string;
  projectTitle: string;
  leadStudentId: string | null;
  venueType?: PaperVenueType;
  venueTier?: PaperVenueTier;
  status: ProjectPaperStatus;
  submittedYear?: number;
  submittedQuarter?: MentorStats['quarter'];
  decisionDueYear?: number;
  decisionDueQuarter?: MentorStats['quarter'];
  revisionRound: number;
  lastRevisionKind?: 'minor' | 'major';
};

type GrantType = '国自然' | '国社科';
type GrantState = {
  type: GrantType;
  appliedYear: number;
  status: 'pending' | 'approved' | 'rejected';
};

type StudentPersona = {
  id: string;
  name: string;
  studentType: string;
  year: number;
  diligence: number;
  stress: number;
  talent: number;
  luck: number;
  hiddenLuck: number;
  contribution: number;
  pendingPapers: number;
  totalPapers: number;
  mentalState: number;
  isBeingMentored: boolean;
  isGenius: boolean;
  recruitedYear: number;
  isYoungTeacher: boolean;
  personality: string;
  bio: string;
  traits: string[];
  whipReactions: { success: string[]; fail: string[] };
  comfortReactions: { success: string[]; fail: string[] };
  department: string;
  mentorId?: string;
  hasWhippedThisQuarter?: boolean;
  hasComfortedThisQuarter?: boolean;
  isLoadingPersona?: boolean;
};

const studentTraitById = new Map(studentTraits.map((trait) => [trait.id, trait]));
const studentTraitIds = studentTraits.map((trait) => trait.id);

const hasTraitConflict = (leftId: string, rightId: string) => {
  const left = studentTraitById.get(leftId);
  const right = studentTraitById.get(rightId);
  if (!left || !right) return false;
  return Boolean(left.conflicts?.includes(rightId) || right.conflicts?.includes(leftId));
};

const getTraitPoolsByCategory = (category: TraitCategory) => ({
  positive: studentTraitIds.filter(
    (id) => studentTraitById.get(id)?.category === category && studentTraitById.get(id)?.polarity === 'positive',
  ),
  negative: studentTraitIds.filter(
    (id) => studentTraitById.get(id)?.category === category && studentTraitById.get(id)?.polarity === 'negative',
  ),
  neutral: studentTraitIds.filter(
    (id) => studentTraitById.get(id)?.category === category && studentTraitById.get(id)?.polarity === 'neutral',
  ),
});

const pickWeightedTrait = (category: TraitCategory, blocked: string[]) => {
  const pools = getTraitPoolsByCategory(category);
  const weightedPick = () => {
    const roll = Math.random();
    if (roll < 0.6) return 'positive';
    if (roll < 0.8) return 'negative';
    return 'neutral';
  };
  let safety = 0;
  while (safety < 24) {
    safety += 1;
    const bucket = weightedPick();
    const pool = pools[bucket].filter((traitId) => !blocked.includes(traitId));
    if (!pool.length) continue;
    const traitId = pool[Math.floor(Math.random() * pool.length)];
    if (blocked.some((selected) => hasTraitConflict(selected, traitId))) continue;
    return traitId;
  }
  const fallback = studentTraitIds.find(
    (traitId) => studentTraitById.get(traitId)?.category === category && !blocked.includes(traitId),
  );
  return fallback;
};

const pickWeightedTraits = (category: TraitCategory, count: number, blocked: string[]) => {
  const picked: string[] = [];
  let safety = 0;
  while (picked.length < count && safety < 24) {
    safety += 1;
    const traitId = pickWeightedTrait(category, [...blocked, ...picked]);
    if (!traitId) break;
    if (picked.includes(traitId)) continue;
    if (blocked.some((selected) => hasTraitConflict(selected, traitId))) continue;
    if (picked.some((selected) => hasTraitConflict(selected, traitId))) continue;
    picked.push(traitId);
  }
  return picked;
};

const resolveStudentTraits = (traits: string[] | undefined) => {
  const uniqueTraits = Array.from(new Set(traits ?? [])).filter((traitId) => studentTraitById.has(traitId));
  const mainTrait = uniqueTraits.find((traitId) => studentTraitById.get(traitId)?.category === 'main');
  const subTraits = uniqueTraits.filter((traitId) => studentTraitById.get(traitId)?.category === 'sub');
  const desiredSubCount = Math.random() < 0.5 ? 2 : 3;

  const resolvedMain = mainTrait ?? pickWeightedTrait('main', []);
  const resolvedSubs: string[] = [];
  if (subTraits.length) {
    subTraits.forEach((traitId) => {
      if (resolvedSubs.length >= desiredSubCount) return;
      if (resolvedMain && hasTraitConflict(resolvedMain, traitId)) return;
      resolvedSubs.push(traitId);
    });
  }

  if (resolvedSubs.length < desiredSubCount) {
    resolvedSubs.push(
      ...pickWeightedTraits('sub', desiredSubCount - resolvedSubs.length, resolvedMain ? [resolvedMain] : []),
    );
  }

  const picked = [resolvedMain, ...resolvedSubs].filter(Boolean) as string[];
  return picked.length ? picked : pickWeightedTraits('main', 1, []);
};

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type LogEvent = { title: string; detail: string };

const buildActiveProjectCountByStudentId = (projects: ResearchProject[]) => {
  const counts = new Map<string, number>();
  projects.forEach((project) => {
    if (project.completed) return;
    project.assignedStudentIds.forEach((studentId) => {
      counts.set(studentId, (counts.get(studentId) ?? 0) + 1);
    });
  });
  return counts;
};

const calcPaperProgressGain = (student: StudentPersona, activeProjectCount: number) => {
  const base = 3;
  const diligenceBoost = Math.round(student.diligence / 35);
  const talentBoost = Math.round(student.talent / 45);
  const mentorBoost = student.isBeingMentored ? 1 : 0;
  const projectBoost = Math.min(activeProjectCount, 2);
  const stressPenalty = Math.round(student.stress / 50);
  const lowMentalPenalty = student.mentalState < 50 ? 1 : 0;

  return clampValue(
    base +
      diligenceBoost +
      talentBoost +
      mentorBoost +
      projectBoost -
      stressPenalty -
      lowMentalPenalty,
    0,
    12,
  );
};

const calcPaperDecisionChance = (mentorStats: MentorStats) =>
  clampValue(0.25 + mentorStats.admin.value / 250, 0.25, 0.75);

const calcPaperAcceptanceChance = (student: StudentPersona, mentorStats: MentorStats) => {
  const base = 0.05;
  const academiaBoost = mentorStats.academia.value / 500;
  const studentBoost = (student.talent + student.diligence) / 1200;
  const mentalBoost = (student.mentalState - 50) / 600;
  const stressPenalty = student.stress / 600;

  return clampValue(base + academiaBoost + studentBoost + mentalBoost - stressPenalty, 0.08, 0.55);
};

const settleResearchPapers = ({
  students,
  mentorStats,
  projects,
}: {
  students: StudentPersona[];
  mentorStats: MentorStats;
  projects: ResearchProject[];
}) => {
  const events: LogEvent[] = [];
  const reputationDelta = 0;
  const fundingDelta = 0;
  let decisionStudentId: string | null = null;

  const activeProjectCounts = buildActiveProjectCountByStudentId(projects);
  const decisionChance = calcPaperDecisionChance(mentorStats);

  const updatedStudents = students.map((student) => {
    const activeProjectCount = activeProjectCounts.get(student.id) ?? 0;
    const progressGain = calcPaperProgressGain(student, activeProjectCount);
    const combinedProgress = clampValue(student.contribution + progressGain, 0, 250);
    const submittedCount = Math.floor(combinedProgress / 100);
    const remainder = combinedProgress - submittedCount * 100;

    if (!submittedCount) {
      return { ...student, contribution: remainder };
    }

    events.push({
      title: '论文投稿',
      detail: `${student.name} 完成 ${submittedCount} 篇稿件并进入外审（在投 +${submittedCount}）。`,
    });

    return {
      ...student,
      contribution: remainder,
      pendingPapers: student.pendingPapers + submittedCount,
      mentalState: clampValue(student.mentalState - 2 * submittedCount, 0, 100),
      stress: clampValue(student.stress + 3 * submittedCount, 0, 100),
    };
  });

  const decisionCandidates = updatedStudents.filter(
    (student) => student.pendingPapers > 0 && Math.random() < decisionChance,
  );
  if (decisionCandidates.length) {
    const totalWeight = decisionCandidates.reduce((sum, student) => sum + student.pendingPapers, 0);
    let cursor = Math.random() * totalWeight;
    for (const student of decisionCandidates) {
      cursor -= student.pendingPapers;
      if (cursor <= 0) {
        decisionStudentId = student.id;
        break;
      }
    }
    if (!decisionStudentId) decisionStudentId = decisionCandidates[0].id;
  }

  return { updatedStudents, events, reputationDelta, fundingDelta, decisionStudentId };
};

const toQuarterIndex = (year: number, quarter: MentorStats['quarter']) => (year - 1) * 4 + (quarter - 1);

const addQuarters = (
  stamp: { year: number; quarter: MentorStats['quarter'] },
  offset: number,
): { year: number; quarter: MentorStats['quarter'] } => {
  const base = toQuarterIndex(stamp.year, stamp.quarter);
  const next = base + offset;
  const nextYear = Math.floor(next / 4) + 1;
  const nextQuarter = ((next % 4) + 1) as MentorStats['quarter'];
  return { year: nextYear, quarter: nextQuarter };
};

const isQuarterReached = (
  current: { year: number; quarter: MentorStats['quarter'] },
  target: { year: number; quarter: MentorStats['quarter'] },
) => toQuarterIndex(current.year, current.quarter) >= toQuarterIndex(target.year, target.quarter);

const pickProjectLeadStudentId = (project: ResearchProject, students: StudentPersona[]) => {
  const assigned = project.assignedStudentIds
    .map((id) => students.find((student) => student.id === id))
    .filter(Boolean) as StudentPersona[];
  if (!assigned.length) return null;
  return assigned.reduce((best, current) => {
    const bestScore = best.diligence + best.talent;
    const currentScore = current.diligence + current.talent;
    return currentScore > bestScore ? current : best;
  }).id;
};

const buildProjectVenueDecision = ({
  projectPaperId,
  projectId,
  projectTitle,
  year,
  quarter,
}: {
  projectPaperId: string;
  projectId: string;
  projectTitle: string;
  year: number;
  quarter: MentorStats['quarter'];
}): DecisionEvent => ({
  id: `dec-project-venue-${projectPaperId}`,
  kind: 'projectVenue',
  title: '成果投稿策略',
  prompt: `课题「${projectTitle}」已结题。请选择本次投稿的期刊/会议等级：`,
  createdYear: year,
  createdQuarter: quarter,
  context: { projectPaperId, projectId },
  options: [
    {
      id: 'conf-a',
      label: '投顶会（A）',
      hint: '风险高 · 收益高 · 出结果快',
      outcome: '已锁定顶会赛道，准备冲一把。',
      effects: { stats: { funding: -6000, morale: -1 } },
      meta: { venueType: 'conference', venueTier: 'A', reviewQuarters: 1, reputationReward: 3, fundingReward: 12000 },
    },
    {
      id: 'jour-b',
      label: '投一区期刊（B）',
      hint: '稳中求进 · 周期更长',
      outcome: '已选择一区期刊，开始按期刊节奏推进。',
      effects: { stats: { funding: -4500, morale: -1 } },
      meta: { venueType: 'journal', venueTier: 'B', reviewQuarters: 2, reputationReward: 2, fundingReward: 8000 },
    },
    {
      id: 'safe-c',
      label: '投稳妥刊会（C）',
      hint: '成功率更高 · 收益较低',
      outcome: '先把成果稳稳落地，再考虑下一轮冲刺。',
      effects: { stats: { funding: -2000, morale: 0 } },
      meta: { venueType: 'conference', venueTier: 'C', reviewQuarters: 1, reputationReward: 1, fundingReward: 5000 },
    },
  ],
});

const buildProjectRevisionDecision = ({
  projectPaperId,
  projectId,
  projectTitle,
  revisionKind,
  year,
  quarter,
}: {
  projectPaperId: string;
  projectId: string;
  projectTitle: string;
  revisionKind: 'minor' | 'major';
  year: number;
  quarter: MentorStats['quarter'];
}): DecisionEvent => ({
  id: `dec-project-revision-${projectPaperId}-${revisionKind}`,
  kind: 'projectRevision',
  title: revisionKind === 'minor' ? '外审意见：小修' : '外审意见：大修',
  prompt:
    revisionKind === 'minor'
      ? `课题「${projectTitle}」收到小修意见。你打算怎么处理？`
      : `课题「${projectTitle}」收到大修意见。你打算怎么处理？`,
  createdYear: year,
  createdQuarter: quarter,
  context: { projectPaperId, projectId, revisionKind },
  options:
    revisionKind === 'minor'
      ? [
          {
            id: 'revise',
            label: '按意见小修并回投',
            hint: '成本低 · 通过率高',
            outcome: '已安排小修回投，等待编辑确认。',
            effects: { stats: { funding: -800, morale: -1 } },
            meta: { action: 'revise', reviewQuarters: 1, acceptBonus: 0.12 },
          },
          {
            id: 'downgrade',
            label: '小改后降档改投',
            hint: '更稳 · 收益下降',
            outcome: '已调整策略，选择更稳的刊会。',
            effects: { stats: { funding: -1200, morale: -1 } },
            meta: { action: 'downgrade', reviewQuarters: 1 },
          },
          {
            id: 'withdraw',
            label: '暂时撤稿，先补实验',
            hint: '短期止损 · 课题士气下降',
            outcome: '已撤稿，课题组需要重新规划。',
            effects: { stats: { morale: -3 } },
            meta: { action: 'withdraw' },
          },
        ]
      : [
          {
            id: 'major',
            label: '硬刚大修并回投',
            hint: '成本高 · 仍有不确定性',
            outcome: '已开启大修冲刺，团队进入加班模式。',
            effects: { stats: { funding: -2600, morale: -2 } },
            meta: { action: 'revise', reviewQuarters: 2, acceptBonus: 0.18 },
          },
          {
            id: 'downgrade',
            label: '降档改投（换赛道）',
            hint: '更稳 · 但浪费部分周期',
            outcome: '已选择降档改投，重新进入外审。',
            effects: { stats: { funding: -1800, morale: -1 } },
            meta: { action: 'downgrade', reviewQuarters: 1 },
          },
          {
            id: 'withdraw',
            label: '放弃当前稿件',
            hint: '止损 · 但士气受挫',
            outcome: '已放弃当前稿件，准备把经验投入下一题。',
            effects: { stats: { morale: -4 } },
            meta: { action: 'withdraw' },
          },
        ],
});

const formatVenueLabel = (paper: Pick<ProjectPaper, 'venueType' | 'venueTier'>) => {
  const typeLabel = paper.venueType === 'journal' ? '期刊' : paper.venueType === 'conference' ? '会议' : '刊会';
  const tierLabel = paper.venueTier ?? '?';
  return `${typeLabel} ${tierLabel}`;
};

const rewardsByTier: Record<PaperVenueTier, { reputation: number; funding: number }> = {
  A: { reputation: 3, funding: 12000 },
  B: { reputation: 2, funding: 8000 },
  C: { reputation: 1, funding: 5000 },
};

const settleProjectPapers = ({
  projectPapers,
  students,
  mentorStats,
  currentStamp,
  decisionStamp,
}: {
  projectPapers: ProjectPaper[];
  students: StudentPersona[];
  mentorStats: MentorStats;
  currentStamp: { year: number; quarter: MentorStats['quarter'] };
  decisionStamp: { year: number; quarter: MentorStats['quarter'] };
}): {
  updatedPapers: ProjectPaper[];
  updatedStudents: StudentPersona[];
  statDelta: StatDelta;
  decisions: DecisionEvent[];
  events: LogEvent[];
} => {
  const events: LogEvent[] = [];
  const decisions: DecisionEvent[] = [];
  const statDelta: StatDelta = {};
  const studentDeltaById: Record<string, StudentDelta> = {};

  const addStatDelta = (key: keyof StatDelta, amount: number) => {
    statDelta[key] = (statDelta[key] ?? 0) + amount;
  };

  const mergeStudentDelta = (studentId: string, delta: StudentDelta) => {
    const current = studentDeltaById[studentId] ?? {};
    studentDeltaById[studentId] = {
      diligence: (current.diligence ?? 0) + (delta.diligence ?? 0),
      talent: (current.talent ?? 0) + (delta.talent ?? 0),
      luck: (current.luck ?? 0) + (delta.luck ?? 0),
      stress: (current.stress ?? 0) + (delta.stress ?? 0),
      mentalState: (current.mentalState ?? 0) + (delta.mentalState ?? 0),
      contribution: (current.contribution ?? 0) + (delta.contribution ?? 0),
      pendingPapers: (current.pendingPapers ?? 0) + (delta.pendingPapers ?? 0),
      totalPapers: (current.totalPapers ?? 0) + (delta.totalPapers ?? 0),
    };
  };

  const resolveLeadStudent = (paper: ProjectPaper) =>
    paper.leadStudentId ? students.find((student) => student.id === paper.leadStudentId) ?? null : null;

  const baseAcceptance: Record<PaperVenueTier, number> = { A: 0.18, B: 0.28, C: 0.42 };
  const baseRevision: Record<PaperVenueTier, number> = { A: 0.55, B: 0.45, C: 0.35 };
  const baseMajorRevision: Record<PaperVenueTier, number> = { A: 0.65, B: 0.5, C: 0.35 };

  const updatedPapers: ProjectPaper[] = projectPapers.map((paper): ProjectPaper => {
    if (paper.status !== 'underReview') return paper;
    if (!paper.decisionDueYear || !paper.decisionDueQuarter) return paper;
    if (!isQuarterReached(currentStamp, { year: paper.decisionDueYear, quarter: paper.decisionDueQuarter })) return paper;

    const venueTier = isPaperVenueTier(paper.venueTier) ? paper.venueTier : 'C';
    const lead = resolveLeadStudent(paper);
    const academiaBoost = mentorStats.academia.value / 260;
    const leadBoost = lead ? (lead.talent + lead.diligence) / 650 : 0;
    const revisionBoost = paper.revisionRound * 0.06;
    const stressPenalty = lead ? lead.stress / 650 : 0;

    const acceptChance = clampValue(baseAcceptance[venueTier] + academiaBoost + leadBoost + revisionBoost - stressPenalty, 0.06, 0.85);
    let revisionChance = clampValue(baseRevision[venueTier] - paper.revisionRound * 0.08, 0.15, 0.75);
    if (acceptChance + revisionChance > 0.95) revisionChance = 0.95 - acceptChance;

    const roll = Math.random();
    const venueLabel = formatVenueLabel(paper);

    if (roll < acceptChance) {
      const reward = rewardsByTier[venueTier];
      addStatDelta('reputation', reward.reputation);
      addStatDelta('funding', reward.funding);
      addStatDelta('morale', 2);
      events.push({
        title: '课题论文接收',
        detail: `课题「${paper.projectTitle}」投稿至 ${venueLabel} 已接收（声望 +${reward.reputation}，经费 +￥${reward.funding.toLocaleString()}）。`,
      });
      if (paper.leadStudentId) {
        mergeStudentDelta(paper.leadStudentId, { pendingPapers: -1, totalPapers: 1, mentalState: 4, stress: -5 });
      }
      return {
        ...paper,
        status: 'accepted',
        decisionDueYear: undefined,
        decisionDueQuarter: undefined,
      };
    }

    if (roll < acceptChance + revisionChance) {
      const majorChance = clampValue(baseMajorRevision[venueTier] - paper.revisionRound * 0.18, 0.15, 0.75);
      const revisionKind = Math.random() < majorChance ? 'major' : 'minor';
      events.push({
        title: '课题论文返修',
        detail: `课题「${paper.projectTitle}」投稿至 ${venueLabel} 收到${revisionKind === 'minor' ? '小修' : '大修'}意见。`,
      });
      if (paper.leadStudentId) {
        mergeStudentDelta(paper.leadStudentId, { mentalState: -2, stress: 3 });
      }
      decisions.push(
        buildProjectRevisionDecision({
          projectPaperId: paper.id,
          projectId: paper.projectId,
          projectTitle: paper.projectTitle,
          revisionKind,
          year: decisionStamp.year,
          quarter: decisionStamp.quarter,
        }),
      );
      return {
        ...paper,
        status: 'awaitingRevision',
        lastRevisionKind: revisionKind,
        decisionDueYear: undefined,
        decisionDueQuarter: undefined,
      };
    }

    addStatDelta('morale', -2);
    events.push({
      title: '课题论文拒稿',
      detail: `课题「${paper.projectTitle}」投稿至 ${venueLabel} 遭到拒稿。`,
    });
    if (paper.leadStudentId) {
      mergeStudentDelta(paper.leadStudentId, { pendingPapers: -1, mentalState: -5, stress: 4 });
    }

    return {
      ...paper,
      status: 'rejected',
      decisionDueYear: undefined,
      decisionDueQuarter: undefined,
    };
  });

  const updatedStudents = students.map((student) => {
    const delta = studentDeltaById[student.id];
    if (!delta) return student;
    return applyStudentDelta(student, delta);
  });

  return { updatedPapers, updatedStudents, statDelta, decisions, events };
};

const buildStudentPaperFallbackDecision = ({
  student,
  mentorStats,
  year,
  quarter,
}: {
  student: StudentPersona;
  mentorStats: MentorStats;
  year: number;
  quarter: MentorStats['quarter'];
}): DecisionEvent => {
  const baseAcceptChance = calcPaperAcceptanceChance(student, mentorStats);

  type FallbackPaperOutcome = { outcome: string; effects: { stats: StatDelta; student: StudentDelta } };

  const sampleOutcome = (tier: PaperVenueTier): FallbackPaperOutcome => {
    const tierMultiplier = tier === 'A' ? 0.75 : tier === 'B' ? 1 : 1.25;
    const acceptChance = clampValue(baseAcceptChance * tierMultiplier, 0.05, 0.85);
    const reviseChance = tier === 'A' ? 0.45 : tier === 'B' ? 0.35 : 0.25;
    const roll = Math.random();

    if (roll < acceptChance) {
      return {
        outcome: '稿件顺利被接收，团队士气大涨。',
        effects: {
          stats: { reputation: tier === 'A' ? 2 : 1, morale: 2, funding: 3000 },
          student: { pendingPapers: -1, totalPapers: 1, mentalState: 6, stress: -4 },
        },
      };
    }

    if (roll < acceptChance + reviseChance) {
      return {
        outcome: '收到外审返修意见，稿件仍在流程中。',
        effects: {
          stats: { funding: -800, morale: -1 },
          student: { mentalState: -2, stress: 4, pendingPapers: 0 },
        },
      };
    }

    return {
      outcome: '不幸退稿，需要调整策略再战。',
      effects: {
        stats: { morale: -2 },
        student: { pendingPapers: -1, mentalState: -4, stress: 3 },
      },
    };
  };

  const optionA = sampleOutcome('A');
  const optionB = sampleOutcome('B');
  let optionC = sampleOutcome('C');
  let safety = 0;
  while ((optionC.effects?.student?.pendingPapers ?? 0) === 0 && safety < 6) {
    safety += 1;
    optionC = sampleOutcome('C');
  }
  if ((optionC.effects?.student?.pendingPapers ?? 0) === 0) {
    optionC = {
      outcome: '稳妥方案落地，稿件结束流程。',
      effects: {
        stats: { reputation: 1, morale: 1 },
        student: { pendingPapers: -1, totalPapers: Math.random() < 0.6 ? 1 : 0, mentalState: 3, stress: -2 },
      },
    };
  }

  return {
    id: `dec-student-paper-${student.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'studentPaperEvent',
    title: '学生论文进展',
    prompt: `${student.name} 有一篇论文到了关键节点：要选择投稿等级/处理返修策略。`,
    createdYear: year,
    createdQuarter: quarter,
    context: { studentId: student.id },
    options: [
      {
        id: 'A',
        label: '冲 A 档刊会',
        hint: '风险高 · 潜在收益大',
        ...optionA,
      },
      {
        id: 'B',
        label: '投 B 档期刊',
        hint: '稳中求进 · 周期更长',
        ...optionB,
      },
      {
        id: 'C',
        label: '转投 C 档稳妥刊会',
        hint: '成功率更高 · 收益较低',
        ...optionC,
      },
    ],
  };
};

const normalizeStudentTraits = (student: StudentPersona) => {
  const resolvedTraits = resolveStudentTraits(student.traits);
  return { ...student, traits: resolvedTraits };
};

const getTraitDelta = (min: number, max: number) => {
  if (min >= 80) return 3;
  if (min >= 70) return 2;
  if (min >= 60) return 1;
  if (max <= 25) return -3;
  if (max <= 35) return -2;
  if (max <= 50) return -1;
  return 0;
};

const collectTraitInfluence = (traits: StudentTrait[]) => {
  const deltas: Partial<Record<StudentStatKey, number>> = {};
  traits.forEach((trait) => {
    const bounds = trait.statBounds;
    if (!bounds) return;
    Object.entries(bounds).forEach(([key, value]) => {
      const statKey = key as StudentStatKey;
      const [min, max] = value;
      const delta = getTraitDelta(min, max);
      if (!delta) return;
      deltas[statKey] = (deltas[statKey] ?? 0) + delta;
    });
  });
  return deltas;
};

const calcMentorDelta = (value: number, step: number, minDelta: number, maxDelta: number) => {
  const delta = Math.round((value - 50) / step);
  return clampValue(delta, minDelta, maxDelta);
};

const applyMentorInfluence = (mentee: StudentPersona, mentor: StudentPersona) => {
  const mentorTraits = (mentor.traits ?? [])
    .map((traitId) => studentTraitById.get(traitId))
    .filter((trait): trait is StudentTrait => Boolean(trait));

  const traitDeltas = collectTraitInfluence(mentorTraits);
  const next = { ...mentee };

  const diligenceDelta = calcMentorDelta(mentor.diligence, 15, -2, 3);
  const talentDelta = calcMentorDelta(mentor.talent, 15, -2, 3);
  const luckDelta = calcMentorDelta(mentor.luck, 18, -1, 2);
  const mentalDelta = calcMentorDelta(mentor.mentalState, 15, -2, 2);
  const stressDelta = calcMentorDelta(mentor.stress, 18, -2, 2);

  next.diligence = clampValue(next.diligence + diligenceDelta + (traitDeltas.diligence ?? 0), 0, 100);
  next.talent = clampValue(next.talent + talentDelta + (traitDeltas.talent ?? 0), 0, 100);
  next.luck = clampValue(next.luck + luckDelta + (traitDeltas.luck ?? 0), 0, 100);
  next.mentalState = clampValue(next.mentalState + mentalDelta + (traitDeltas.mentalState ?? 0), 0, 100);
  next.stress = clampValue(next.stress + stressDelta + (traitDeltas.stress ?? 0), 0, 100);

  return next;
};

const buildMentorshipPairs = (students: StudentPersona[]) => {
  const studentIds = new Set(students.map((student) => student.id));
  const pairs: Array<{ mentorId: string; menteeId: string }> = [];
  const usedMentors = new Set<string>();

  students.forEach((mentee) => {
    const mentorId = mentee.mentorId;
    if (!mentorId) return;
    if (mentorId === mentee.id) return;
    if (!studentIds.has(mentorId)) return;
    if (usedMentors.has(mentorId)) return;
    pairs.push({ mentorId, menteeId: mentee.id });
    usedMentors.add(mentorId);
  });

  return pairs;
};

const applyMentorshipInfluence = (students: StudentPersona[]) => {
  const pairs = buildMentorshipPairs(students);
  const menteeIds = new Set(pairs.map((pair) => pair.menteeId));
  const studentMap = new Map(students.map((student) => [student.id, { ...student }]));

  pairs.forEach(({ mentorId, menteeId }) => {
    const mentor = studentMap.get(mentorId);
    const mentee = studentMap.get(menteeId);
    if (!mentor || !mentee) return;
    const updatedMentee = applyMentorInfluence(mentee, mentor);
    updatedMentee.isBeingMentored = true;
    updatedMentee.mentorId = mentorId;
    studentMap.set(menteeId, updatedMentee);
  });

  return Array.from(studentMap.values()).map((student) => {
    if (menteeIds.has(student.id)) return student;
    return { ...student, isBeingMentored: false, mentorId: undefined };
  });
};
const familyNames = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '吴', '周'];
const givenNameChars = ['子', '文', '浩', '琪', '轩', '瑶', '宁', '辰', '雨', '航'];

const generateRandomName = () => {
  const family = familyNames[Math.floor(Math.random() * familyNames.length)];
  const given = givenNameChars[Math.floor(Math.random() * givenNameChars.length)];
  const given2 = Math.random() < 0.4 ? givenNameChars[Math.floor(Math.random() * givenNameChars.length)] : '';
  return `${family}${given}${given2}`;
};

const genderOptions = ['男', '女', '非二元'];
const genderPool = genderOptions;

const almaOptions = ['QS Top 10', '清北 / 国内 TOP2', '华五', 'C9', '985', '211', '双非'];

const disciplines: Discipline[] = [
  { label: '理学', en: 'Science', icon: 'SCI', accent: '#1d4ed8' },
  { label: '工学', en: 'Engineering', icon: 'ENG', accent: '#0f766e' },
  { label: '农学', en: 'Agriculture', icon: 'AGR', accent: '#15803d' },
  { label: '文学', en: 'Humanities', icon: 'HUM', accent: '#be123c' },
  { label: '艺术学', en: 'Arts', icon: 'ART', accent: '#7e22ce' },
  { label: '医学', en: 'Medical', icon: 'MED', accent: '#0f766e' },
  { label: '管理学', en: 'Management', icon: 'MGT', accent: '#c2410c' },
  { label: '教育学', en: 'Education', icon: 'EDU', accent: '#6d28d9' },
  { label: '经济学', en: 'Economics', icon: 'ECO', accent: '#b45309' },
  { label: '法学', en: 'Law', icon: 'LAW', accent: '#0369a1' },
  { label: '信息科学', en: 'Information Science', icon: 'INF', accent: '#0e7490' },
];

const departmentsByDiscipline: Record<string, Department[]> = {
  理学: [
    {
      title: '数学科学学院',
      desc: 'Mathematics Science',
      icon: 'MATH',
      accent: '#1d4ed8',
      note: '“院庆节目是全体老师默写《高等代数》。 ”',
    },
    {
      title: '物理学院',
      desc: 'Physics Department',
      icon: 'PHYS',
      accent: '#0ea5e9',
      note: '“实验楼的门被学生焊死过两次，理由是防止能量泄露。 ”',
    },
  ],
  工学: [
    {
      title: '机械工程学院',
      desc: 'Mechanical Engineering',
      icon: 'ME',
      accent: '#0f766e',
      note: '“工具间比图书馆安静，因为机床比图书管理员更凶。 ”',
    },
    {
      title: '电子信息工程学院',
      desc: 'Electronic Information',
      icon: 'EE',
      accent: '#1d4ed8',
      note: '“每次断电都被认为是创新教学——体验模拟信号。 ”',
    },
  ],
  农学: [
    {
      title: '作物科学学院',
      desc: 'Crop Science',
      icon: 'AG',
      accent: '#15803d',
      note: '“田间实验的进度，以天气心情为准。 ”',
    },
    {
      title: '动物科学学院',
      desc: 'Animal Science',
      icon: 'AN',
      accent: '#22c55e',
      note: '“实验动物的名字都已经在朋友圈官宣。 ”',
    },
  ],
  文学: [
    {
      title: '中文系',
      desc: 'Chinese Literature',
      icon: 'CN',
      accent: '#be123c',
      note: '“标点符号也要写出情绪。 ”',
    },
    {
      title: '外国语学院',
      desc: 'Foreign Languages',
      icon: 'FL',
      accent: '#db2777',
      note: '“论文摘要先写三种语言。 ”',
    },
  ],
  艺术学: [
    {
      title: '美术学院',
      desc: 'Fine Arts',
      icon: 'FA',
      accent: '#7e22ce',
      note: '“展墙是最好的论文评审。 ”',
    },
    {
      title: '设计学院',
      desc: 'Design',
      icon: 'DS',
      accent: '#9333ea',
      note: '“改稿的版本号已经不够用了。 ”',
    },
  ],
  医学: [
    {
      title: '临床医学院',
      desc: 'Clinical Medicine',
      icon: 'MD',
      accent: '#0f766e',
      note: '“查房时间是所有日程的主宰。 ”',
    },
    {
      title: '公共卫生学院',
      desc: 'Public Health',
      icon: 'PH',
      accent: '#14b8a6',
      note: '“流调表格比论文还厚。 ”',
    },
  ],
  管理学: [
    {
      title: '工商管理学院',
      desc: 'Business Administration',
      icon: 'BA',
      accent: '#c2410c',
      note: '“案例库更新速度快过股价。 ”',
    },
    {
      title: '公共管理学院',
      desc: 'Public Administration',
      icon: 'PA',
      accent: '#ea580c',
      note: '“制度设计是门玄学。 ”',
    },
  ],
  教育学: [
    {
      title: '教育学院',
      desc: 'Education',
      icon: 'ED',
      accent: '#6d28d9',
      note: '“课堂观察记录比实验日志更细。 ”',
    },
    {
      title: '心理与认知学院',
      desc: 'Psychology',
      icon: 'PS',
      accent: '#8b5cf6',
      note: '“实验排队时间等同一学期。 ”',
    },
  ],
  经济学: [
    {
      title: '经济学院',
      desc: 'Economics',
      icon: 'EC',
      accent: '#b45309',
      note: '“每一个假设都要能上黑板。 ”',
    },
    {
      title: '金融学院',
      desc: 'Finance',
      icon: 'FI',
      accent: '#d97706',
      note: '“建模时连咖啡都需要贴现。 ”',
    },
  ],
  法学: [
    {
      title: '法学院',
      desc: 'Law',
      icon: 'LW',
      accent: '#0369a1',
      note: '“判例库比书架还深。 ”',
    },
    {
      title: '国际法学院',
      desc: 'International Law',
      icon: 'IL',
      accent: '#0284c7',
      note: '“条约细则写到手酸。 ”',
    },
  ],
  信息科学: [
    {
      title: '计算机学院',
      desc: 'Computer Science',
      icon: 'CS',
      accent: '#0e7490',
      note: '“模型训练时显卡是第一生产力。 ”',
    },
    {
      title: '软件学院',
      desc: 'Software Engineering',
      icon: 'SE',
      accent: '#0891b2',
      note: '“需求变更比版本发布还勤。 ”',
    },
  ],
};

const moraleActivities = [
  { id: 'walk', label: '校园慢走', cost: 0, gain: 6 },
  { id: 'tea', label: '下午茶', cost: 380, gain: 10 },
  { id: 'massage', label: '理疗按摩', cost: 1200, gain: 18 },
  { id: 'retreat', label: '周末短途旅行', cost: 3800, gain: 28 },
  { id: 'concert', label: '音乐会放松', cost: 2200, gain: 22 },
  { id: 'retreat2', label: '静修冥想', cost: 1600, gain: 20 },
  { id: 'gym', label: '健身课程', cost: 900, gain: 14 },
  { id: 'museum', label: '博物馆参观', cost: 260, gain: 8 },
  { id: 'bookstore', label: '书店淘书', cost: 480, gain: 9 },
  { id: 'hotpot', label: '团队小聚火锅', cost: 1500, gain: 16 },
  { id: 'park', label: '公园野餐', cost: 120, gain: 7 },
];

type SettingsModalProps = {
  onClose: () => void;
  onReset: () => void;
  mentorName: string;
  isResetting: boolean;
};

const SettingsModal = ({ onClose, onReset, mentorName, isResetting }: SettingsModalProps) => (
  <div className="modal-backdrop">
    <div className="settings-modal">
      <header className="settings-head">
        <h3>设置</h3>
        <button className="icon-button ghost" type="button" onClick={onClose}>
          关闭
        </button>
      </header>
      <div className="settings-body">
        <p>当前存档：{mentorName} 导师</p>
        <button className="danger" type="button" onClick={onReset} disabled={isResetting}>
          {isResetting ? '重置中...' : '重置进度'}
        </button>
      </div>
    </div>
  </div>
);

type OnboardingModalProps = {
  onClose: () => void;
};

const OnboardingModal = ({ onClose }: OnboardingModalProps) => (
  <div className="modal-backdrop larger">
    <div className="onboarding-modal">
      <header className="onboarding-head">
        <div>
          <p>入职须知</p>
          <small>Tenure-Track 生存指南</small>
        </div>
        <button className="icon-button ghost" type="button" onClick={onClose}>
          关闭
        </button>
      </header>
      <div className="onboarding-body">
        <section className="onboarding-section">
          <h3>核心目标</h3>
          <p>6 年内晋升，否则将被学校解聘。</p>
        </section>
        <section className="onboarding-section">
          <h3>关键资源</h3>
          <p>经费、心态、声望与论文是核心指标。</p>
        </section>
        <section className="onboarding-section">
          <h3>学年安排</h3>
          <p>Q1 申项目、Q2 毕业、Q3 招生、Q4 评审。</p>
        </section>
      </div>
      <footer className="onboarding-footer">
        <button className="primary" type="button" onClick={onClose}>
          我已了解
        </button>
      </footer>
    </div>
  </div>
);

type DecisionModalProps = {
  decision: DecisionEvent;
  queueCount: number;
  onClose: () => void;
  onChoose: (optionId: string) => void;
};

const DecisionModal = ({ decision, queueCount, onClose, onChoose }: DecisionModalProps) => (
  <div className="modal-backdrop larger">
    <div className="decision-modal">
      <header className="decision-head">
        <div>
          <p className="eyebrow small">待处理 {queueCount}</p>
          <h3>{decision.title}</h3>
        </div>
        <button className="icon-button ghost" type="button" onClick={onClose}>
          稍后处理
        </button>
      </header>
      <div className="decision-body">
        <p className="decision-prompt">{decision.prompt}</p>
        <div className="decision-options">
          {decision.options.map((option) => (
            <button
              key={option.id}
              className="decision-option"
              type="button"
              onClick={() => onChoose(option.id)}
            >
              <div className="decision-option-main">
                <strong>{option.label}</strong>
                {option.hint && <span className="muted-text">{option.hint}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

type ProfilePayload = {
  mentor: string;
  biography: string;
  researchAreas: string[];
  recruitmentNeeds: string[];
  achievements: string[];
  quote: string;
  motivation?: string;
};

type EventItem = {
  id: string;
  title: string;
  detail: string;
};

type StatDelta = Partial<{
  morale: number;
  academia: number;
  admin: number;
  integrity: number;
  funding: number;
  reputation: number;
}>;

type StudentDelta = Partial<{
  diligence: number;
  talent: number;
  luck: number;
  stress: number;
  mentalState: number;
  contribution: number;
  pendingPapers: number;
  totalPapers: number;
}>;

type DecisionOption = {
  id: string;
  label: string;
  hint?: string;
  outcome: string;
  effects?: {
    stats?: StatDelta;
    student?: StudentDelta;
  };
  meta?: Record<string, unknown>;
};

type DecisionEvent =
  | {
      id: string;
      kind: 'projectVenue';
      title: string;
      prompt: string;
      options: DecisionOption[];
      createdYear: number;
      createdQuarter: MentorStats['quarter'];
      context: { projectPaperId: string; projectId: string };
    }
  | {
      id: string;
      kind: 'projectRevision';
      title: string;
      prompt: string;
      options: DecisionOption[];
      createdYear: number;
      createdQuarter: MentorStats['quarter'];
      context: { projectPaperId: string; projectId: string; revisionKind: 'minor' | 'major' };
    }
  | {
      id: string;
      kind: 'studentPaperEvent';
      title: string;
      prompt: string;
      options: DecisionOption[];
      createdYear: number;
      createdQuarter: MentorStats['quarter'];
      context: { studentId: string };
    };

const applyMentorDelta = (stats: MentorStats, delta: StatDelta) => ({
  ...stats,
  morale: delta.morale ? { ...stats.morale, value: clampValue(stats.morale.value + delta.morale, 0, stats.morale.max) } : stats.morale,
  academia: delta.academia
    ? { ...stats.academia, value: clampValue(stats.academia.value + delta.academia, 0, stats.academia.max) }
    : stats.academia,
  admin: delta.admin ? { ...stats.admin, value: clampValue(stats.admin.value + delta.admin, 0, stats.admin.max) } : stats.admin,
  integrity: delta.integrity
    ? { ...stats.integrity, value: clampValue(stats.integrity.value + delta.integrity, 0, stats.integrity.max) }
    : stats.integrity,
  funding: delta.funding ? Math.max(stats.funding + delta.funding, 0) : stats.funding,
  reputation: delta.reputation ? stats.reputation + delta.reputation : stats.reputation,
});

const applyStudentDelta = (student: StudentPersona, delta: StudentDelta): StudentPersona => ({
  ...student,
  diligence:
    delta.diligence === undefined ? student.diligence : clampValue(student.diligence + delta.diligence, 0, 100),
  talent: delta.talent === undefined ? student.talent : clampValue(student.talent + delta.talent, 0, 100),
  luck: delta.luck === undefined ? student.luck : clampValue(student.luck + delta.luck, 0, 100),
  stress: delta.stress === undefined ? student.stress : clampValue(student.stress + delta.stress, 0, 100),
  mentalState:
    delta.mentalState === undefined ? student.mentalState : clampValue(student.mentalState + delta.mentalState, 0, 100),
  contribution:
    delta.contribution === undefined ? student.contribution : clampValue(student.contribution + delta.contribution, 0, 250),
  pendingPapers:
    delta.pendingPapers === undefined ? student.pendingPapers : Math.max(student.pendingPapers + delta.pendingPapers, 0),
  totalPapers:
    delta.totalPapers === undefined ? student.totalPapers : Math.max(student.totalPapers + delta.totalPapers, 0),
});

const isPaperVenueType = (value: unknown): value is PaperVenueType => value === 'conference' || value === 'journal';
const isPaperVenueTier = (value: unknown): value is PaperVenueTier => value === 'A' || value === 'B' || value === 'C';

const downgradeVenueTier = (tier: PaperVenueTier | undefined): PaperVenueTier => {
  if (tier === 'A') return 'B';
  return 'C';
};

const studentTypeLabel: Record<string, string> = {
  MASTER: '\u7814',
  PHD: '\u535A',
  UNDERGRAD: '\u672C',
  YOUNG_TEACHER: '\u9752',
};

const formatYearLabel = (year: number) => {
  const map: Record<number, string> = { 1: '\u4E00', 2: '\u4E8C', 3: '\u4E09', 4: '\u56DB', 5: '\u4E94', 6: '\u516D' };
  return map[year] ?? String(year);
};

const getMentorTitle = (year: number) => {
  if (year >= 6) return '教授';
  if (year >= 4) return '副教授';
  return '讲师';
};

const getTraitDisplays = (traits: string[] | undefined) =>
  (traits ?? [])
    .map((traitId) => {
      const trait = studentTraitById.get(traitId);
      if (!trait) return null;
      return { name: trait.name, polarity: trait.polarity, category: trait.category };
    })
    .filter(
      (trait): trait is { name: string; polarity: StudentTrait['polarity']; category: TraitCategory } =>
        Boolean(trait),
    );

const getTraitStack = (traits: string[] | undefined) => {
  const resolved = getTraitDisplays(traits);
  const mainTrait = resolved.find((trait) => trait.category === 'main');
  const subTraits = resolved.filter((trait) => trait.category === 'sub');
  return { mainTrait, subTraits };
};

const getStudentStatusLabel = (student: StudentPersona) => {
  if (student.mentalState >= 85 && student.stress <= 30) return '状态稳定';
  if (student.stress >= 70 && student.mentalState <= 50) return '身心吃紧';
  if (student.stress >= 70) return '压力偏高';
  if (student.mentalState <= 45) return '心态低迷';
  if (student.mentalState >= 75) return '状态在线';
  return '状态波动';
};

const formatStudentStage = (student: StudentPersona) => {
  const prefix = studentTypeLabel[student.studentType] ?? '研';
  return `${prefix}${formatYearLabel(student.year ?? 1)}`;
};

function App() {
  const defaultDiscipline = disciplines[0].label;
  const storedState = getStoredState();
  const storedTeamMembers = getStoredTeamMembers();
  const initialDiscipline = storedState?.selectedDiscipline ?? defaultDiscipline;
  const initialDepartments = departmentsByDiscipline[initialDiscipline] ?? [];
  const initialDepartment = initialDepartments.some((dept) => dept.title === storedState?.selectedDepartment)
    ? storedState?.selectedDepartment
    : initialDepartments[0]?.title ?? '';
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState(initialDiscipline);
  const [selectedDepartment, setSelectedDepartment] = useState(initialDepartment);
  const [name, setName] = useState(() => storedState?.name ?? generateRandomName());
  const [gender, setGender] = useState(() => storedState?.gender ?? genderPool[Math.floor(Math.random() * genderPool.length)]);
  const [almaMater, setAlmaMater] = useState(() => storedState?.almaMater ?? almaOptions[0]);
  const [researchFocus, setResearchFocus] = useState<string>(() => storedState?.researchFocus ?? researchDirections[0]);
  const [stage, setStage] = useState<'application' | 'briefing'>(() =>
    storedState?.stage === 'briefing' ? 'briefing' : 'application',
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stats, setStats] = useState<MentorStats>(() => storedState?.stats ?? defaultStats);
  const [profileData, setProfileData] = useState<ProfilePayload | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<StudentPersona[]>(
    () => storedState?.teamMembers ?? storedTeamMembers ?? [],
  );
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamBootstrapped, setTeamBootstrapped] = useState(() =>
    Boolean(storedState?.teamMembers?.length || storedTeamMembers?.length),
  );
  const [isResetting, setIsResetting] = useState(false);
  const [moraleMessage, setMoraleMessage] = useState<string | null>(null);
  const [activityUses, setActivityUses] = useState(0);
  const [activitySeed, setActivitySeed] = useState<{ year: number; quarter: number } | null>(null);
  const [activityPool, setActivityPool] = useState<
    Array<{ id: string; label: string; cost: number; gain: number }>
  >([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ResearchProject[]>(() => storedState?.projects ?? []);
  const [projectPapers, setProjectPapers] = useState<ProjectPaper[]>(
    () => storedState?.projectPapers ?? [],
  );
  const [grantApplications, setGrantApplications] = useState<GrantState[]>(
    () => storedState?.grantApplications ?? [],
  );
  const [projectDraftTitle, setProjectDraftTitle] = useState('');
  const [projectDraftCategory, setProjectDraftCategory] = useState<ResearchProject['category']>('校内课题');
  const [projectTitleLoading, setProjectTitleLoading] = useState(false);
  const [eventLog, setEventLog] = useState<EventItem[]>(() => {
    try {
      const raw = localStorage.getItem('mentorSim.eventLog');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as EventItem[];
      }
    } catch (error) {
      console.warn('Failed to parse event log', error);
    }
    return [
      {
        id: 'seed-1',
        title: '教学安排',
        detail: '本学期新增研一课程《学术研究方法》，请确认授课安排。',
      },
      {
        id: 'seed-2',
        title: '项目申请提醒',
        detail: '学院将于本季度开放校级科研项目申报。',
      },
      {
        id: 'seed-3',
        title: '团队状态',
        detail: '当前仅招募研一学生，建议完善研究方向描述。',
      },
    ];
  });
  const comfortCost = 500;
  const [pendingDecisions, setPendingDecisions] = useState<DecisionEvent[]>(    
    () => storedState?.pendingDecisions ?? [],
  );
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);

  const activeDecision = useMemo(() => {
    if (!pendingDecisions.length) return null;
    if (activeDecisionId) {
      return pendingDecisions.find((item) => item.id === activeDecisionId) ?? pendingDecisions[0];
    }
    return pendingDecisions[0];
  }, [pendingDecisions, activeDecisionId]);

  const projectPaperSummary = useMemo(
    () =>
      projectPapers.reduce(
        (acc, paper) => ({
          ...acc,
          [paper.status]: acc[paper.status] + 1,
        }),
        {
          awaitingVenue: 0,
          underReview: 0,
          awaitingRevision: 0,
          accepted: 0,
          rejected: 0,
        } satisfies Record<ProjectPaperStatus, number>,
      ),
    [projectPapers],
  );

  const currentDepartments = useMemo(
    () => departmentsByDiscipline[selectedDiscipline] ?? [],
    [selectedDiscipline],
  );
  const activeDepartment = currentDepartments.find((dept) => dept.title === selectedDepartment);
  const mentorTitle = getMentorTitle(stats.year);
  const achievements =
    profileData?.achievements?.length
      ? profileData.achievements
      : [
          '领衔数学科学学院团队，完成多项算力调度绿色数据中心课题试点，推动学院在算力与绿色技术方向的实战落地。',
          '在教学领域获学院认可的教学创新奖，以创新课堂设计与实践提升教学效果。',
          '本季度团队协作评分达标，形成可复用的研究节奏。',
        ];
  const recruitmentNeeds =
    profileData?.recruitmentNeeds?.length
      ? profileData.recruitmentNeeds
      : ['研一学生 · 算法方向', '研一学生 · 数据方向', '研一学生 · 交叉研究方向'];
  const motivationText =
    profileData?.motivation ??
    profileData?.quote ??
    '把焦虑写成计划，把困难拆成日历。每周留出一次复盘，把实验的每一次失败都写成下一次的准备。对学生的期待要具体，对自己的目标要分层：今天完成一页文献，明天打磨一个实验，后天给团队一个明确的节奏。哪怕进展很慢，也要保持可复用的过程与稳定的心态。';
  const briefBio =
    profileData?.biography ??
    `聚焦${researchFocus}相关方向，结合行业需求推进应用落地，在团队协作与资源统筹中发挥专业优势。`;
  const statList = [
    { label: '心态', value: stats.morale.value, max: stats.morale.max, color: stats.morale.color },
    { label: '学术', value: stats.academia.value, max: stats.academia.max, color: stats.academia.color },
    { label: '行政', value: stats.admin.value, max: stats.admin.max, color: stats.admin.color },
    { label: '纪要', value: stats.integrity.value, max: stats.integrity.max, color: stats.integrity.color },
  ];
  const freeActivityLimit = 3;
  const remainingFreeUses = Math.max(freeActivityLimit - activityUses, 0);
  const grantRules: Array<{
    type: GrantType;
    openQuarter: MentorStats['quarter'];
    cost: number;
    reward: number;
  }> = [
    { type: '国自然', openQuarter: 1, cost: 12000, reward: 200000 },
    { type: '国社科', openQuarter: 2, cost: 9000, reward: 160000 },
  ];

  const pushEvent = useCallback((title: string, detail: string) => {
    setEventLog((prev) => [
      ...prev,
      { id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, detail },
    ]);
  }, []);

  useEffect(() => {
    if (stage !== 'briefing') return;
    if (teamMembers.length < 2) return;
    const seen = new Set<string>();
    let removed = 0;
    const deduped = teamMembers.filter((student) => {
      if (seen.has(student.id)) {
        removed += 1;
        return false;
      }
      seen.add(student.id);
      return true;
    });
    if (!removed) return;
    setTeamMembers(deduped);
    pushEvent('数据修复', `已清理 ${removed} 个重复学生条目。`);
  }, [stage, teamMembers, pushEvent]);

  const handleOpenDecisionQueue = useCallback(() => {
    if (!pendingDecisions.length) return;
    setActiveDecisionId(pendingDecisions[0].id);
  }, [pendingDecisions]);

  const handleDecisionChoose = useCallback(
    (decision: DecisionEvent, optionId: string) => {
      const option = decision.options.find((item) => item.id === optionId);
      if (!option) return;

      pushEvent(decision.title, option.outcome);

      if (option.effects?.stats) {
        setStats((prev) => applyMentorDelta(prev, option.effects?.stats ?? {}));
      }

      const studentTargetId = (() => {
        if (decision.kind === 'studentPaperEvent') return decision.context.studentId;
        if (decision.kind === 'projectVenue' || decision.kind === 'projectRevision') {
          return projectPapers.find((paper) => paper.id === decision.context.projectPaperId)?.leadStudentId ?? null;
        }
        return null;
      })();

      if (studentTargetId && option.effects?.student) {
        setTeamMembers((prev) =>
          prev.map((student) => (student.id === studentTargetId ? applyStudentDelta(student, option.effects?.student ?? {}) : student)),
        );
      }

      if (decision.kind === 'projectVenue') {
        const venueType = option.meta?.venueType;
        const venueTier = option.meta?.venueTier;
        const reviewQuarters = option.meta?.reviewQuarters;
        if (!isPaperVenueType(venueType) || !isPaperVenueTier(venueTier)) {
          setTeamMessage('投稿策略数据缺失，已跳过。');
        } else {
          const reviewOffset = typeof reviewQuarters === 'number' && reviewQuarters > 0 ? reviewQuarters : 1;
          const due = addQuarters({ year: stats.year, quarter: stats.quarter }, reviewOffset);
          setProjectPapers((prev) =>
            prev.map((paper) =>
              paper.id === decision.context.projectPaperId
                ? {
                    ...paper,
                    venueType,
                    venueTier,
                    status: 'underReview',
                    submittedYear: stats.year,
                    submittedQuarter: stats.quarter,
                    decisionDueYear: due.year,
                    decisionDueQuarter: due.quarter,
                  }
                : paper,
            ),
          );
          if (studentTargetId) {
            setTeamMembers((prev) =>
              prev.map((student) =>
                student.id === studentTargetId
                  ? applyStudentDelta(student, { pendingPapers: 1, mentalState: -2, stress: 3 })
                  : student,
              ),
            );
          }
        }
      }

      if (decision.kind === 'projectRevision') {
        const action = option.meta?.action;
        const reviewQuarters = option.meta?.reviewQuarters;
        const reviewOffset = typeof reviewQuarters === 'number' && reviewQuarters > 0 ? reviewQuarters : 1;
        const due = addQuarters({ year: stats.year, quarter: stats.quarter }, reviewOffset);

        setProjectPapers((prev) =>
          prev.map((paper) => {
            if (paper.id !== decision.context.projectPaperId) return paper;
            if (action === 'withdraw') {
              return { ...paper, status: 'rejected', decisionDueYear: undefined, decisionDueQuarter: undefined };
            }
            if (action === 'downgrade') {
              return {
                ...paper,
                venueTier: downgradeVenueTier(paper.venueTier),
                status: 'underReview',
                decisionDueYear: due.year,
                decisionDueQuarter: due.quarter,
              };
            }
            if (action === 'revise') {
              return {
                ...paper,
                status: 'underReview',
                decisionDueYear: due.year,
                decisionDueQuarter: due.quarter,
                revisionRound: paper.revisionRound + 1,
                lastRevisionKind: decision.context.revisionKind,
              };
            }
            return paper;
          }),
        );

        if (action === 'withdraw' && studentTargetId) {
          setTeamMembers((prev) =>
            prev.map((student) =>
              student.id === studentTargetId
                ? applyStudentDelta(student, { pendingPapers: -1, mentalState: -2, stress: 2 })
                : student,
            ),
          );
        }
      }

      const remaining = pendingDecisions.filter((item) => item.id !== decision.id);
      setPendingDecisions(remaining);
      setActiveDecisionId(remaining[0]?.id ?? null);
    },
    [pendingDecisions, projectPapers, pushEvent, stats.year, stats.quarter],
  );

  const getGrantState = (type: GrantType) =>
    grantApplications.find((item) => item.type === type && item.appliedYear === stats.year);

  const handleApplyGrant = (type: GrantType) => {
    const rule = grantRules.find((item) => item.type === type);
    if (!rule) return;
    if (stats.quarter !== rule.openQuarter) {
      setTeamMessage(`${type} 仅在第 ${rule.openQuarter} 季度开放申请。`);
      return;
    }
    if (stats.funding < rule.cost) {
      setTeamMessage('经费不足，无法提交课题申请。');
      return;
    }
    if (getGrantState(type)) {
      setTeamMessage(`${type} 本年度已申请过。`);
      return;
    }
    const base = type === '国自然' ? 0.35 : 0.3;
    const academiaBoost = stats.academia.value / 200;
    const adminBoost = stats.admin.value / 250;
    const chance = Math.min(0.85, Math.max(0.15, base + academiaBoost + adminBoost));
    const success = Math.random() < chance;
    const status: GrantState['status'] = success ? 'approved' : 'rejected';
    setStats((prev) => ({
      ...prev,
      funding: prev.funding - rule.cost + (success ? rule.reward : 0),
      reputation: prev.reputation + (success ? 2 : 0),
    }));
    setGrantApplications((prev) => [...prev, { type, appliedYear: stats.year, status }]);
    const detail = success
      ? `${type} 申请通过，获得经费 ${Math.round(rule.reward / 10000)} 万。`
      : `${type} 申请未通过，需要完善材料再战。`;
    setTeamMessage(detail);
    pushEvent('课题申请', detail);
  };

  const requestProjectTitle = async () => {
    setProjectTitleLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discipline: selectedDiscipline,
          department: selectedDepartment,
          researchFocus,
          category: projectDraftCategory,
        }),
      });
      if (!res.ok) throw new Error('Project title response not ok');
      const data = await res.json();
      const title = String(data?.title ?? '').trim();
      return title || pickFallbackProjectTitle();
    } catch (error) {
      console.error('Project title generation failed', error);
      return pickFallbackProjectTitle();
    } finally {
      setProjectTitleLoading(false);
    }
  };

  const createProject = async () => {
    if (projectTitleLoading) return;
    let title = projectDraftTitle.trim();
    if (!title) {
      title = await requestProjectTitle();
    }
    if (!title) {
      setTeamMessage('课题名称生成失败，请稍后再试。');
      return;
    }
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next: ResearchProject = {
      id,
      title,
      category: projectDraftCategory,
      progress: { literature: 0, experiment: 0, results: 0 },
      assignedStudentIds: [],
      createdYear: stats.year,
      createdQuarter: stats.quarter,
      completed: false,
    };
    setProjects((prev) => [next, ...prev]);
    setProjectDraftTitle('');
    setTeamMessage(`已创建课题：${next.title}`);
    pushEvent('课题创建', `新课题「${next.title}」已进入研究排期。`);
  };

  const queueStudentPaperDecision = useCallback(
    async (
      student: StudentPersona,
      stamp: { year: number; quarter: MentorStats['quarter'] },
      mentorSnapshot: MentorStats,
    ) => {
      const asInt = (value: unknown, min: number, max: number) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
        return Math.round(clampValue(value, min, max));
      };

      const normalizeStatDelta = (raw: unknown): StatDelta | undefined => {
        if (!raw || typeof raw !== 'object') return undefined;
        const obj = raw as Record<string, unknown>;
        const next: StatDelta = {};
        const morale = asInt(obj.morale, -6, 6);
        const academia = asInt(obj.academia, -4, 6);
        const admin = asInt(obj.admin, -4, 6);
        const integrity = asInt(obj.integrity, -4, 6);
        const funding = asInt(obj.funding, -15000, 25000);
        const reputation = asInt(obj.reputation, -2, 3);

        if (morale) next.morale = morale;
        if (academia) next.academia = academia;
        if (admin) next.admin = admin;
        if (integrity) next.integrity = integrity;
        if (funding) next.funding = funding;
        if (reputation) next.reputation = reputation;
        return Object.keys(next).length ? next : undefined;
      };

      const normalizeStudentDelta = (raw: unknown): StudentDelta | undefined => {
        if (!raw || typeof raw !== 'object') return undefined;
        const obj = raw as Record<string, unknown>;
        const next: StudentDelta = {};
        const stress = asInt(obj.stress, -10, 12);
        const mentalState = asInt(obj.mentalState, -12, 12);
        const pendingPapers = asInt(obj.pendingPapers, -1, 1);
        const totalPapers = asInt(obj.totalPapers, 0, 1);
        const contribution = asInt(obj.contribution, -60, 30);

        if (stress) next.stress = stress;
        if (mentalState) next.mentalState = mentalState;
        if (pendingPapers) next.pendingPapers = pendingPapers;
        if (totalPapers) next.totalPapers = totalPapers;
        if (contribution) next.contribution = contribution;
        return Object.keys(next).length ? next : undefined;
      };

      const buildFromApiPayload = (payload: unknown): DecisionEvent | null => {
        if (!payload || typeof payload !== 'object') return null;
        const obj = payload as Record<string, unknown>;
        const title = String(obj.title ?? '').trim() || '学生论文进展';
        const prompt = String(obj.prompt ?? '').trim() || `${student.name} 的论文有新进展，需要你拍板。`;
        const rawOptions = Array.isArray(obj.options) ? (obj.options as unknown[]) : [];
        const options = rawOptions
          .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const optionObj = item as Record<string, unknown>;
            const id = String(optionObj.id ?? ['A', 'B', 'C'][index] ?? '').trim();
            const label = String(optionObj.label ?? '').trim();
            const outcome = String(optionObj.outcome ?? '').trim();
            if (!id || !label || !outcome) return null;
            const hint = typeof optionObj.hint === 'string' ? optionObj.hint.trim() : undefined;
            const effectsObj = optionObj.effects as Record<string, unknown> | undefined;
            const statsDelta = normalizeStatDelta(effectsObj?.stats);
            const studentDelta = normalizeStudentDelta(effectsObj?.student);
            const effects =
              statsDelta || studentDelta
                ? {
                    ...(statsDelta ? { stats: statsDelta } : {}),
                    ...(studentDelta ? { student: studentDelta } : {}),
                  }
                : undefined;
            return { id, label, hint, outcome, effects } satisfies DecisionOption;
          })
          .filter(Boolean) as DecisionOption[];

        if (!options.length) return null;
        return {
          id: `dec-student-paper-${student.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'studentPaperEvent',
          title,
          prompt,
          options,
          createdYear: stamp.year,
          createdQuarter: stamp.quarter,
          context: { studentId: student.id },
        };
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/events/student-paper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: {
              id: student.id,
              name: student.name,
              studentType: student.studentType,
              year: student.year,
              traits: student.traits,
              pendingPapers: student.pendingPapers,
              totalPapers: student.totalPapers,
              contribution: student.contribution,
            },
            mentor: {
              name,
              researchFocus,
              selectedDiscipline,
              selectedDepartment,
            },
            year: stamp.year,
            quarter: stamp.quarter,
          }),
        });
        if (!res.ok) throw new Error('Student paper event response not ok');
        const data = await res.json();
        const decision = buildFromApiPayload(data);
        if (!decision) throw new Error('Invalid student paper event payload');
        setPendingDecisions((prev) => [...prev, decision]);
        setActiveDecisionId((prev) => prev ?? decision.id);
        pushEvent('学生论文事件', `${student.name} 有新的投稿/返修抉择。`);
      } catch (error) {
        console.warn('Student paper event generation failed, fallback.', error);
        const fallbackDecision = buildStudentPaperFallbackDecision({
          student,
          mentorStats: mentorSnapshot,
          year: stamp.year,
          quarter: stamp.quarter,
        });
        setPendingDecisions((prev) => [...prev, fallbackDecision]);
        setActiveDecisionId((prev) => prev ?? fallbackDecision.id);
        pushEvent('学生论文事件', `${student.name} 有新的论文抉择（已使用本地模板）。`);
      }
    },
    [name, researchFocus, selectedDepartment, selectedDiscipline, pushEvent],
  );

  const handleAssignStudentToProject = (projectId: string, studentId: string) => {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        if (project.assignedStudentIds.includes(studentId)) return project;
        return { ...project, assignedStudentIds: [...project.assignedStudentIds, studentId] };
      }),
    );
    const studentName = teamMembers.find((student) => student.id === studentId)?.name ?? '';
    pushEvent('课题分配', `${studentName} 加入课题组。`);
  };

  const handleRemoveStudentFromProject = (projectId: string, studentId: string) => {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          assignedStudentIds: project.assignedStudentIds.filter((id) => id !== studentId),
        };
      }),
    );
  };

  const advanceProjects = useCallback(
    (source: ResearchProject[], students: StudentPersona[]) => {
      const studentMap = new Map(students.map((student) => [student.id, student]));
      const completedTitles: string[] = [];
      const completedProjects: ResearchProject[] = [];
      const updated = source.map((project) => {
        if (project.completed) return project;
        const memberStats = project.assignedStudentIds
          .map((id) => studentMap.get(id))
          .filter(Boolean) as StudentPersona[];
        const base = memberStats.length ? 4 : 0;
        const boost = memberStats.reduce((sum, member) => sum + Math.round(member.diligence / 40), 0);
        const nextLiterature = clampValue(project.progress.literature + base + boost, 0, 100);
        const nextExperiment = clampValue(project.progress.experiment + base + boost, 0, 100);
        const nextResults = clampValue(project.progress.results + base + boost, 0, 100);
        const completed = nextLiterature >= 100 && nextExperiment >= 100 && nextResults >= 100;
        const nextProject: ResearchProject = {
          ...project,
          progress: {
            literature: nextLiterature,
            experiment: nextExperiment,
            results: nextResults,
          },
          completed,
        };
        if (completed && !project.completed) {
          completedTitles.push(project.title);
          completedProjects.push(nextProject);
        }
        return nextProject;
      });
      return { updated, completedTitles, completedProjects };
    },
    [],
  );

  const handleDisciplineSelect = (label: string) => {
    setSelectedDiscipline(label);
    const firstDept = departmentsByDiscipline[label]?.[0];
    if (firstDept) {
      setSelectedDepartment(firstDept.title);
    } else {
      setSelectedDepartment('');
    }
  };

  const randomizeIdentity = () => {
    setName(generateRandomName());
    setGender(genderPool[Math.floor(Math.random() * genderPool.length)]);
    setAlmaMater(almaOptions[Math.floor(Math.random() * almaOptions.length)]);
    setResearchFocus(researchDirections[Math.floor(Math.random() * researchDirections.length)]);
  };

  const canRecruitThisQuarter = stats.quarter === 3;

  const applyFirstYearRules = useCallback(
    (students: StudentPersona[]): StudentPersona[] => {
      const enforceMasterYearOne = stats.year < 6;
      const isFirstYear = stats.year === 1;
      const isFirstQuarter = isFirstYear && stats.quarter === 1;
      const normalized = students.map((student) => {
        let adjusted: StudentPersona = student;
        if (enforceMasterYearOne) {
          adjusted = {
            ...student,
            studentType: 'MASTER',
            year: 1,
            pendingPapers: 0,
            totalPapers: 0,
            contribution: 0,
            isYoungTeacher: false,
            stress: Math.min(student.stress, 20),
            mentalState: 100,
          };
        } else if (isFirstYear) {
          adjusted = {
            ...student,
            studentType: isFirstQuarter
              ? 'MASTER'
              : student.studentType === 'YOUNG_TEACHER'
                ? 'MASTER'
                : student.studentType,
            year: 1,
            pendingPapers: 0,
            totalPapers: 0,
            contribution: 0,
            stress: Math.min(student.stress, 20),
            mentalState: 100,
          };
        }
        return normalizeStudentTraits(adjusted);
      });
      return normalized.map((student) => ({ ...student, isBeingMentored: false, mentorId: undefined }));
    },
    [stats.year, stats.quarter],
  );
  const loadTeamSnapshot = useCallback(async () => {
    if (stage !== 'briefing') return;
    setTeamLoading(true);
    setTeamError(null);
    setTeamMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/students`);
      if (!res.ok) throw new Error('Failed to load students');
      const raw: StudentPersona[] = await res.json();
      const data = applyFirstYearRules(raw);
      setTeamMembers(data);
      setTeamBootstrapped(true);
    } catch (error) {
      console.error('Student snapshot fetch failed', error);
      setTeamError('无法加载研究团队，请稍后再试。');
    } finally {
      setTeamLoading(false);
    }
  }, [stage, applyFirstYearRules]);

  const fetchTeamMembers = useCallback(
    async (desiredCount = TEAM_DEFAULT_COUNT, mode: 'initial' | 'recruit' = 'initial') => {
      if (stage !== 'briefing') return;
      setTeamLoading(true);
      setTeamError(null);
      setTeamMessage(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentor: name,
            department: selectedDepartment,
            researchFocus,
            count: desiredCount,
            year: stats.year,
            quarter: stats.quarter,
            mode,
          }),
        });
        if (!res.ok) throw new Error('Failed to load students');
        const raw: StudentPersona[] = await res.json();
        const data = applyFirstYearRules(raw);
        if (mode === 'recruit' && data.length) {
          const newlyPassed = data.map((student) => {
            const traits = getTraitStack(student.traits);
            const mainLabel = traits.mainTrait?.name ?? '待定';
            return `面试通过！${student.name} 正式加入。成分: ${mainLabel}`;
          });
          newlyPassed.forEach((detail) => pushEvent('面试通过', detail));
        }
        if (mode === 'recruit') {
          setTeamMembers((prev) => [...prev, ...data]);
          const added = data.length;
          const message = added > 0 ? `成功招募 ${added} 名学术成员。` : '团队阵容已刷新。';
          setTeamMessage(message);
          pushEvent('团队扩充', message);
          if (data.length) {
            const names = data.map((student) => student.name).join('、');
            pushEvent('招募完成', `已发起面试：${names}`);
          }
        } else {
          setTeamMembers(data);
        }
        setTeamBootstrapped(true);
      } catch (error) {
        console.error('Student fetch failed', error);
        setTeamError('无法加载研究团队，请稍后再试。');
      } finally {
        setTeamLoading(false);
      }
    },
    [stage, name, selectedDepartment, researchFocus, stats.year, stats.quarter, applyFirstYearRules, pushEvent],
  );

  const handleRecruit = async () => {
    if (!canRecruitThisQuarter) {
      setTeamMessage('只有第三季度才能开启招募。');
      return;
    }
    await fetchTeamMembers(1, 'recruit');
  };

  const composeProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    setShowOnboarding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          gender,
          almaMater,
          researchFocus,
          discipline: selectedDiscipline,
          department: selectedDepartment,
        }),
      });
      if (!res.ok) throw new Error('Failed to compose profile');
      const data: ProfilePayload = await res.json();
      setProfileData(data);
      if (data.researchAreas?.length) setResearchFocus(data.researchAreas[0]);
    } catch (error) {
      console.error('Compose profile failed', error);
      setProfileError('无法加载导师资料，请稍后再试。');
      throw error;
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await composeProfile();
      setStats(buildInitialStats(almaMater));
      setStage('briefing');
      setShowOnboarding(true);
    } catch {
      // errors already handled via profileError
    }
  };

  const handleEndQuarter = () => {
    const nextStats = applyQuarterEffects(stats);
    const teamSnapshot = teamMembers.length
      ? applyMentorshipInfluence(teamMembers).map((student) => ({
          ...student,
          hasWhippedThisQuarter: false,
          hasComfortedThisQuarter: false,
        }))
      : teamMembers;

    const { updated, completedTitles, completedProjects } = advanceProjects(projects, teamSnapshot);
    if (completedTitles.length) {
      completedTitles.forEach((title) => pushEvent('课题完成', `课题「${title}」阶段成果已完成。`));
    }

    const paperSettlement = settleResearchPapers({
      students: teamSnapshot,
      mentorStats: stats,
      projects: updated,
    });
    paperSettlement.events.forEach((event) => pushEvent(event.title, event.detail));

    const projectPaperSettlement = settleProjectPapers({
      projectPapers,
      students: paperSettlement.updatedStudents,
      mentorStats: stats,
      currentStamp: { year: stats.year, quarter: stats.quarter },
      decisionStamp: { year: nextStats.year, quarter: nextStats.quarter },
    });
    projectPaperSettlement.events.forEach((event) => pushEvent(event.title, event.detail));

    const newProjectPapers: ProjectPaper[] = completedProjects.map((project) => {
      const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        id,
        projectId: project.id,
        projectTitle: project.title,
        leadStudentId: pickProjectLeadStudentId(project, teamSnapshot),
        status: 'awaitingVenue',
        revisionRound: 0,
      };
    });

    const newProjectDecisions = newProjectPapers.map((paper) =>
      buildProjectVenueDecision({
        projectPaperId: paper.id,
        projectId: paper.projectId,
        projectTitle: paper.projectTitle,
        year: nextStats.year,
        quarter: nextStats.quarter,
      }),
    );

    if (newProjectPapers.length) {
      newProjectPapers.forEach((paper) =>
        pushEvent('成果投稿待办', `课题「${paper.projectTitle}」已生成论文稿件，等待选择投稿等级。`),
      );
    }

    setProjectPapers([...newProjectPapers, ...projectPaperSettlement.updatedPapers]);
    setTeamMembers(projectPaperSettlement.updatedStudents);
    setProjects(updated);

    const combinedQuarterDelta: StatDelta = {
      ...projectPaperSettlement.statDelta,
      funding: (projectPaperSettlement.statDelta.funding ?? 0) + paperSettlement.fundingDelta,
      reputation:
        (projectPaperSettlement.statDelta.reputation ?? 0) +
        completedTitles.length +
        paperSettlement.reputationDelta,
    };

    setStats(applyMentorDelta(nextStats, combinedQuarterDelta));

    const decisionsToAdd = [...newProjectDecisions, ...projectPaperSettlement.decisions];
    if (decisionsToAdd.length) {
      setPendingDecisions((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueAdds = decisionsToAdd.filter((item) => !existingIds.has(item.id));
        return uniqueAdds.length ? [...prev, ...uniqueAdds] : prev;
      });
      const nextDecisionId =
        activeDecisionId ?? pendingDecisions[0]?.id ?? decisionsToAdd[0]?.id ?? null;
      setActiveDecisionId(nextDecisionId);
    }

    const decisionStudent = paperSettlement.decisionStudentId
      ? projectPaperSettlement.updatedStudents.find((student) => student.id === paperSettlement.decisionStudentId) ?? null
      : null;
    if (decisionStudent) {
      void queueStudentPaperDecision(decisionStudent, { year: nextStats.year, quarter: nextStats.quarter }, stats);
    }
    pushEvent('季度结算', `已结束第 ${stats.year} 年第 ${stats.quarter} 季度。`);
  };

  const handleResetProgress = async () => {
    if (isResetting) return;
    const confirmed = window.confirm('将清空当前导师的所有季度与学生进度，确定重新开始吗？');
    if (!confirmed) return;
    setIsResetting(true);
    let success = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('reset failed');
      success = true;
    } catch (error) {
      console.error('Reset request failed', error);
    } finally {
      setIsResetting(false);
    }
    if (!success) return;
    setStage('application');
    setActiveTab('home');
    setShowOnboarding(false);
    setProfileData(null);
    setProfileError(null);
    setProfileLoading(false);
    setStats(buildInitialStats(almaMater));
    setTeamMembers([]);
    setProjects([]);
    setProjectPapers([]);
    setGrantApplications([]);
    setPendingDecisions([]);
    setActiveDecisionId(null);
    setTeamMessage(null);
    setTeamError(null);
    setTeamBootstrapped(false);
    setEventLog([]);
    localStorage.removeItem('mentorSim.eventLog');
    localStorage.removeItem(STORED_STATE_KEY);
    localStorage.removeItem(STORED_TEAM_KEY);
    setModalOpen(false);
  };

  const handleSelectMentor = (mentorId: string) => {
    if (selectedMentorId === mentorId) {
      setSelectedMentorId(null);
    setTeamMessage('已取消导师选择。');
    pushEvent('导师选择', '已取消导师选择。');
    return;
  }
  setSelectedMentorId(mentorId);
  setTeamMessage('已选择导师，请选择受指导对象。');
  pushEvent('导师选择', '已选择导师，请选择受指导对象。');
  };

  const hasMentorshipCycle = (mentorId: string, menteeId: string) => {
    const studentMap = new Map(teamMembers.map((student) => [student.id, student]));
    let cursor = mentorId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === menteeId) return true;
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const next = studentMap.get(cursor)?.mentorId;
      if (!next) break;
      cursor = next;
    }
    return false;
  };

  const handleAssignMentor = (menteeId: string) => {
    if (!selectedMentorId || selectedMentorId === menteeId) {
      setTeamMessage('请先选择一名导师，再选择受指导对象。');
      return;
    }
    if (teamMembers.some((student) => student.mentorId === selectedMentorId)) {
      setTeamMessage('该导师已在指导其他学生。');
      return;
    }
    if (hasMentorshipCycle(selectedMentorId, menteeId)) {
      setTeamMessage('该分配会形成循环指导，已阻止。');
      return;
    }
    const menteeName = teamMembers.find((student) => student.id === menteeId)?.name;
    setTeamMembers((prev) =>
      prev.map((student) => {
        if (student.id === menteeId) {
          return { ...student, isBeingMentored: true, mentorId: selectedMentorId };
        }
        return student;
      }),
    );
    const message = menteeName ? `已为 ${menteeName} 分配指导。` : '已完成分配指导。';
    setTeamMessage(message);
    pushEvent('导师分配', message);
    setSelectedMentorId(null);
  };

  const handleClearMentorships = () => {
    if (!teamMembers.some((student) => student.mentorId)) {
      setTeamMessage('当前没有任何指导关系。');
      return;
    }
    const confirmed = window.confirm('将清空所有学生的指导关系，确定吗？');
    if (!confirmed) return;
    setSelectedMentorId(null);
    setTeamMembers((prev) => prev.map((student) => ({ ...student, isBeingMentored: false, mentorId: undefined })));
    setTeamMessage('已清空全部指导关系。');
    pushEvent('导师分配', '已清空全部指导关系。');
  };

  const pickReaction = (reactions: string[]) =>
    reactions.length ? reactions[Math.floor(Math.random() * reactions.length)] : '';

  const handleComfortStudent = (studentId: string) => {
    const target = teamMembers.find((student) => student.id === studentId);
    if (!target) return;
    if (target.hasComfortedThisQuarter) {
      setTeamMessage(`${target.name} 本季度已安抚过。`);
      return;
    }
    if (stats.funding < comfortCost) {
      setTeamMessage('经费不足，无法安抚学生。');
      return;
    }
    const success = target.mentalState <= 80 || target.stress >= 60 || Math.random() < 0.7;
    const mentalGain = success ? 8 : 3;
    const stressDrop = success ? 6 : 2;
    const reaction = pickReaction(success ? target.comfortReactions.success : target.comfortReactions.fail);
    setStats((prev) => ({
      ...prev,
      funding: Math.max(prev.funding - comfortCost, 0),
    }));
    setTeamMembers((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;
        return {
          ...student,
          mentalState: clampValue(student.mentalState + mentalGain, 0, 100),
          stress: clampValue(student.stress - stressDrop, 0, 100),
          hasComfortedThisQuarter: true,
        };
      }),
    );
    const message = reaction
      ? `安抚${success ? '有效' : '一般'}：${target.name} ${reaction}`
      : `已安抚 ${target.name}。`;
    setTeamMessage(message);
    pushEvent('安抚学生', message);
  };

  const handleWhipStudent = (studentId: string) => {
    const target = teamMembers.find((student) => student.id === studentId);
    if (!target) return;
    if (target.hasWhippedThisQuarter) {
      setTeamMessage(`${target.name} 本季度已激励过。`);
      return;
    }
    const success = target.stress <= 65 || target.mentalState >= 55 || Math.random() < 0.7;
    const contributionGain = success ? 8 : 3;
    const diligenceGain = success ? 3 : 1;
    const stressGain = success ? 6 : 8;
    const mentalDrop = success ? 4 : 6;
    const reaction = pickReaction(success ? target.whipReactions.success : target.whipReactions.fail);
    setTeamMembers((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;
        return {
          ...student,
          contribution: clampValue(student.contribution + contributionGain, 0, 100),
          diligence: clampValue(student.diligence + diligenceGain, 0, 100),
          stress: clampValue(student.stress + stressGain, 0, 100),
          mentalState: clampValue(student.mentalState - mentalDrop, 0, 100),
          hasWhippedThisQuarter: true,
        };
      }),
    );
    const message = reaction
      ? `激励${success ? '奏效' : '一般'}：${target.name} ${reaction}`
      : `已激励 ${target.name}。`;
    setTeamMessage(message);
    pushEvent('激励学生', message);
  };

  const handleMoraleActivity = (activity: { id: string; label: string; cost: number; gain: number }) => {
    setMoraleMessage(null);
    if (activity.cost === 0 && activityUses >= freeActivityLimit) {
      setMoraleMessage('本季度免费活动次数已用完，请下季度再安排。');
      return;
    }
    if (activity.cost > stats.funding) {
      setMoraleMessage('经费不足，无法安排该活动。');
      return;
    }
    setStats((prev) => ({
      ...prev,
      funding: prev.funding - activity.cost,
      morale: {
        ...prev.morale,
        value: Math.min(prev.morale.max, prev.morale.value + activity.gain),
      },
    }));
    if (activity.cost === 0) setActivityUses((prev) => prev + 1);
    const activityNote =
      activity.cost > 0
        ? `已安排「${activity.label}」，心态 +${activity.gain}，经费 -${activity.cost}。`
        : `已安排「${activity.label}」，心态 +${activity.gain}。`;
    setMoraleMessage(activityNote);
    pushEvent('心态活动', activityNote);
  };

  const refreshActivityPool = useCallback(() => {
    const fixed = moraleActivities.find((activity) => activity.id === 'walk');
    const pool = moraleActivities.filter((activity) => activity.id !== 'walk');
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, 3);
    setActivityPool(fixed ? [fixed, ...picked] : picked);
  }, []);

  useEffect(() => {
    if (stage !== 'briefing') return;
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/profile`);
        if (!res.ok) throw new Error('Profile response not ok');
        const data: ProfilePayload = await res.json();
        setProfileData(data);
        if (data.mentor) setName(data.mentor);
        if (data.researchAreas?.length) setResearchFocus(data.researchAreas[0]);
      } catch (error) {
        console.error('Failed to fetch profile data', error);
        setProfileError('无法加载导师资料，请稍后再试。');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [stage]);

  useEffect(() => {
    if (stage === 'application') {
      setTeamMembers([]);
      setTeamMessage(null);
      setTeamError(null);
      setTeamBootstrapped(false);
      return;
    }
    if (teamMembers.length) return;
    loadTeamSnapshot();
  }, [stage, loadTeamSnapshot, teamMembers.length]);

  useEffect(() => {
    if (stage !== 'briefing' || !teamBootstrapped) return;
    if (teamMembers.length) return;
    loadTeamSnapshot();
  }, [stats.year, stats.quarter, stage, teamBootstrapped, loadTeamSnapshot, teamMembers.length]);

  useEffect(() => {
    if (stage !== 'briefing') return;
    const needsRefresh =
      !activitySeed || activitySeed.year !== stats.year || activitySeed.quarter !== stats.quarter;
    if (!needsRefresh) return;
    setActivityUses(0);
    refreshActivityPool();
    setActivitySeed({ year: stats.year, quarter: stats.quarter });
  }, [stats.year, stats.quarter, stage, refreshActivityPool, activitySeed]);

  useEffect(() => {
    try {
      localStorage.setItem('mentorSim.eventLog', JSON.stringify(eventLog));
    } catch (error) {
      console.warn('Failed to persist event log', error);
    }
  }, [eventLog]);

  useEffect(() => {
    try {
      const payload = {
        stage,
        name,
        gender,
        almaMater,
        researchFocus,
        selectedDiscipline,
        selectedDepartment,
        stats,
        teamMembers,
        projects,
        projectPapers,
        grantApplications,
        pendingDecisions,
      };
      localStorage.setItem(STORED_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist state', error);
    }
  }, [
    stage,
    name,
    gender,
    almaMater,
    researchFocus,
    selectedDiscipline,
    selectedDepartment,
    stats,
    teamMembers,
    projects,
    projectPapers,
    grantApplications,
    pendingDecisions,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(STORED_TEAM_KEY, JSON.stringify(teamMembers));
    } catch (error) {
      console.warn('Failed to persist team', error);
    }
  }, [teamMembers]);
  const applicationView = (
    <div className="app-shell">
      <div className="glow" aria-hidden="true" />
      <div className="browser">
        <header className="browser-bar">
          <div className="browser-controls">
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
          </div>
          <div className="browser-address">https://job.univ.edu.cn/apply</div>
          <button className="icon-button" type="button" onClick={() => setModalOpen(true)} aria-label="settings">
            设置
          </button>
        </header>

        <section className="form-panel">
          <header className="form-header">
            <p className="eyebrow">教职申请系统</p>
            <h1>请选择目标院系并开始你的 Tenure-Track 之旅</h1>
          </header>

          <section className="card identity">
            <div className="card-head">
              <div>
                <p className="eyebrow small">0. 个人信息 (Identity)</p>
                <h2>{name} 老师</h2>
              </div>
              <button className="link-button" type="button" onClick={randomizeIdentity}>
                随机重置
              </button>
            </div>
            <div className="identity-grid compact">
              <label className="field">
                <span>姓名</span>
                <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="field">
                <span>性别</span>
                <select className="text-input" value={gender} onChange={(event) => setGender(event.target.value)}>
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>毕业院校</span>
                <select className="text-input" value={almaMater} onChange={(event) => setAlmaMater(event.target.value)}>
                  {almaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <small className="field-hint">后续匹配流程将根据院校档次给予额外加成。</small>
              </label>
              <label className="field">
                <span>研究方向</span>
                <input
                  className="text-input"
                  value={researchFocus}
                  onChange={(event) => setResearchFocus(event.target.value)}
                />
              </label>
              <label className="field">
                <span>校区位置</span>
                <input className="text-input" value="浦江主校区" readOnly />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow small">1. 学科大类 (Discipline)</p>
                <h2>确定你的学术标签</h2>
              </div>
            </div>
            <div className="chip-row">
              {disciplines.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  className={`chip ${selectedDiscipline === item.label ? 'selected' : ''}`}
                  onClick={() => handleDisciplineSelect(item.label)}
                  style={{ '--delay': `${0.05 * index}s` } as CSSProperties}
                >
                  <span className="chip-icon" style={{ color: item.accent }}>
                    {item.icon}
                  </span>
                  <div>
                    <p>{item.label}</p>
                    <small>{item.en}</small>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <p className="eyebrow small">2. 选择院系 (Department)</p>
                <h2>偏好的院系与合作资源</h2>
              </div>
            </div>
            <div className="dept-grid">
              {currentDepartments.map((dept, index) => (
                <button
                  key={dept.title}
                  type="button"
                  className={`dept-card ${selectedDepartment === dept.title ? 'selected' : ''}`}
                  onClick={() => setSelectedDepartment(dept.title)}
                  style={{ '--delay': `${0.08 * index}s` } as CSSProperties}
                >
                  <span className="dept-icon" style={{ color: dept.accent }}>
                    {dept.icon}
                  </span>
                  <div>
                    <p>{dept.title}</p>
                    <small>{dept.desc}</small>
                  </div>
                </button>
              ))}
            </div>
            <div className="note-box">
              <p className="note-title">院系特色</p>
              <p className="note-body">{activeDepartment?.note ?? '请选择院系以查看对应吐槽。'}</p>
            </div>
          </section>

          <button className="submit-btn" type="button" onClick={handleSubmit}>
            提交申请
          </button>
          <p className="hint-text">点击提交即代表你已阅读并接受“递进月规程”协议。</p>
        </section>
      </div>
    </div>
  );
  const dashboardView = (
    <div className="dashboard-shell">
      <div className="dashboard-layout">
        <div className="dashboard-frame">
          <header className="browser-bar">
            <div className="browser-controls">
              <span className="dot red" />
              <span className="dot amber" />
              <span className="dot green" />
            </div>
            <div className="browser-address">https://www.univ.edu.cn/faculty/{name}</div>
            <button className="icon-button" type="button" onClick={() => setModalOpen(true)} aria-label="settings">
              设置
            </button>
          </header>
          <div className="dashboard-board">
          <aside className="dashboard-side">
            <div className="avatar-block">
              <div className="avatar-box">{name.slice(0, 1)}</div>
              <h3>{name} 老师</h3>
              <p className="muted-text">
                {mentorTitle} · {selectedDepartment || '计算机与技术学院'}
              </p>
              <div className="sidebar-meta">
                <span>第{stats.year}年</span>
                <span>Q{stats.quarter}</span>
              </div>
            </div>
            <div className="sidebar-card">
              <h4>联系方式</h4>
              <p>邮箱：{name}@univ.edu.cn</p>
              <p>办公电话：+86 10 6287 1123</p>
              <p>办公室：东区 · A3-402</p>
            </div>
            <div className="sidebar-card sidebar-metrics">
              <h4>核心指标</h4>
              <div className="stat-list compact">
                {statList.map((stat) => (
                  <div key={stat.label} className="stat-row">
                    <div className="stat-row-head">
                      <span>{stat.label}</span>
                      <span>{stat.value}</span>
                    </div>
                    <div className="stat-bar">
                      <span style={{ width: `${Math.round((stat.value / stat.max) * 100)}%`, background: stat.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="resource-summary compact">
                <div>
                  <span>经费：</span>
                  <strong>￥{stats.funding.toLocaleString()}</strong>
                </div>
                <div>
                  <span>声望：</span>
                  <strong>{stats.reputation}</strong>
                </div>
              </div>
            </div>
            <div className="sidebar-card activity-card">
              <h4>心态提升活动</h4>
              <p className="muted-text">本季度活动已锁定，免费活动剩余 {remainingFreeUses} 次</p>
              <div className="activity-list">
                {activityPool.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className={`activity-button ${activity.cost > 0 ? 'paid' : 'free'}`}
                    onClick={() => handleMoraleActivity(activity)}
                    disabled={activity.cost === 0 && remainingFreeUses === 0}
                  >
                    <span>{activity.label}</span>
                  </button>
                ))}
              </div>
              {moraleMessage && <p className="hint-text">{moraleMessage}</p>}
            </div>
            <div className="sidebar-actions">
              <button className="ghost" type="button" onClick={() => setShowOnboarding(true)}>
                入职须知
              </button>
              <button className="ghost" type="button" onClick={() => setModalOpen(true)}>
                系统设置
              </button>
            </div>
          </aside>

          <main className="dashboard-main">
            <header className="dashboard-head">
              <div>
                <p className="eyebrow">https://www.univ.edu.cn/faculty/{name}</p>
                <h1>{name} 老师</h1>
                <p>
                  {mentorTitle}，{selectedDepartment || '计算机与技术学院'} · 当前任务：第 {stats.year} 年·第
                  {stats.quarter} 季度
                </p>
              </div>
              <div className="dashboard-meta">
                <span>第{stats.year} 年 · 第{stats.quarter} 季度</span>
                <div className="meta-actions">
                  {pendingDecisions.length > 0 && (
                    <button className="ghost" type="button" onClick={handleOpenDecisionQueue}>
                      待处理 {pendingDecisions.length}
                    </button>
                  )}
                  <button className="primary" type="button">
                    发布公告
                  </button>
                  <button className="icon-button" type="button" onClick={() => setModalOpen(true)} aria-label="settings">
                    设置
                  </button>
                </div>
              </div>
            </header>

            <nav className="dashboard-tabs">
              {[
                { label: '首页', key: 'home' },
                { label: '团队', key: 'team' },
                { label: '科研', key: 'research' },
                { label: '课题组设置', key: 'equipment' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(tab.key as DashboardTab)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

          {activeTab === 'home' && (
            <div className="home-grid">
              <section className="info-card profile-card">
                <div className="profile-head">
                  <div>
                    <h3>个人简介</h3>
                    <p className="muted-text">职级：{mentorTitle} · 年度目标：稳住心态与学术产出</p>
                  </div>
                  <span className="badge stage">第{stats.year}年</span>
                </div>
                <p>{briefBio}</p>
                {profileError && <p className="error-text">{profileError}</p>}
              </section>
              <section className="info-card">
                <h3>阶段成果</h3>
                <ul className="text-list">
                  {achievements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="info-card list-card">
                <h3>招募需求</h3>
                <ul className="text-list">
                  {recruitmentNeeds.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="info-card achievement-card">
                <h3>主要成就</h3>
                <p className="achievement-text">{achievements.join('；')}</p>
              </section>
              <section className="info-card quote-wide motivation-card">
                <p className="quote-text">{motivationText}</p>
              </section>
            </div>
          )}

            {activeTab === 'team' && (
              <section className="info-card team-shell">
                <div className="team-head">
                  <div>
                    <p className="eyebrow">研究团队</p>
                    <h3>当前编制 · {teamMembers.length || '待建'} 人</h3>
                    <p className="team-note">
                      当前季度：第{stats.year}年·第{stats.quarter}季度，
                      {canRecruitThisQuarter ? '可立即发起新一轮招募。' : '仅第三季度允许扩充核心岗位。'}
                    </p>
                  </div>
                  <div className="team-actions">
                    <button
                      className="primary"
                      type="button"
                      onClick={handleRecruit}
                      disabled={!canRecruitThisQuarter || teamLoading}
                    >
                      招募学术
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      onClick={handleClearMentorships}
                      disabled={!teamMembers.some((student) => student.mentorId) || teamLoading}
                    >
                      清空指导
                    </button>
                  </div>
                </div>
                {teamMessage && <p className="success-text">{teamMessage}</p>}
                {teamError && <p className="error-text">{teamError}</p>}
              {(teamLoading || (!teamLoading && teamMembers.length > 0)) && (
                <div className="team-grid">
                  {teamMembers.map((student) => {
                    const traitStack = getTraitStack(student.traits);
                    const mentoringTarget = teamMembers.find((member) => member.mentorId === student.id);
                    const mentorSource = student.mentorId
                      ? teamMembers.find((member) => member.id === student.mentorId)
                      : null;
                    return (
                    <article
                      key={student.id}
                      className={`student-card${student.talent >= 90 ? ' gold' : ''}${
                        selectedMentorId === student.id ? ' selected' : ''
                      }`}
                    >
                      <div className="student-action-bar">
                        <button
                          className="student-action comfort"
                          type="button"
                          title={
                            stats.funding < comfortCost
                              ? '经费不足，无法安抚'
                              : student.hasComfortedThisQuarter
                                ? '本季度已安抚'
                                : `安抚（-￥${comfortCost}，心态提升）`
                          }
                          onClick={() => handleComfortStudent(student.id)}
                          disabled={stats.funding < comfortCost || student.hasComfortedThisQuarter}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                          </svg>
                        </button>
                        <button
                          className="student-action whip"
                          type="button"
                          title={student.hasWhippedThisQuarter ? '本季度已激励' : '激励（进度提升，压力上升）'}
                          onClick={() => handleWhipStudent(student.id)}
                          disabled={student.hasWhippedThisQuarter}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <div className="student-head">
                        <div className="student-title-row">
                          <h4>{student.name}</h4>
                          <div className="student-meta">
                            <span>在投 {student.pendingPapers}</span>
                            <span>发表 {student.totalPapers}</span>
                          </div>
                        </div>
                        <div className="student-sub-row">
                          <div className="student-stage-stack">
                            <div className="stage-row">
                              <span className="badge stage">{formatStudentStage(student)}</span>
                              <span className="status-text">{getStudentStatusLabel(student)}</span>
                            </div>
                            <span className="dept-text">{student.department}</span>
                          </div>
                          {traitStack.mainTrait && (
                            <span className={`badge tag-main ${traitStack.mainTrait.polarity}`}>
                              {traitStack.mainTrait.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="student-actions">
                        {selectedMentorId ? (
                          selectedMentorId === student.id ? (
                            <button className="ghost" type="button" onClick={() => handleSelectMentor(student.id)}>
                              取消导师
                            </button>
                          ) : (
                            <button className="primary" type="button" onClick={() => handleAssignMentor(student.id)}>
                              分配指导
                            </button>
                          )
                        ) : mentoringTarget ? (
                          <button className="ghost" type="button" disabled>
                            正在指导{mentoringTarget.name}
                          </button>
                        ) : mentorSource ? (
                          <button className="ghost" type="button" onClick={() => handleSelectMentor(student.id)}>
                            正在被{mentorSource.name}指导
                          </button>
                        ) : (
                          <button className="ghost" type="button" onClick={() => handleSelectMentor(student.id)}>
                            分配指导
                          </button>
                        )}
                      </div>
                      {student.bio && <div className="student-story">{student.bio}</div>}
                      <div className="student-bottom">
                        {traitStack.subTraits.length > 0 && (
                          <div className="student-traits">
                            {traitStack.subTraits.map((trait) => (
                              <span key={trait.name} className="trait-chip sub-trait">
                                {trait.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="student-progress">
                          <div className="progress-item">
                            <div className="progress-head">
                              <span>论文进度</span>
                              <span>{student.contribution}/100</span>
                            </div>
                            <div className="progress-bar paper">
                              <span style={{ width: `${Math.min(Math.max(student.contribution, 0), 100)}%` }} />
                            </div>
                          </div>
                          <div className="progress-row">
                            <div className="progress-item">
                              <div className="progress-head">
                                <span>压力</span>
                                <span>{student.stress}/100</span>
                              </div>
                              <div className="progress-bar stress">
                                <span style={{ width: `${Math.min(Math.max(student.stress, 0), 100)}%` }} />
                              </div>
                            </div>
                            <div className="progress-item">
                              <div className="progress-head">
                                <span>心态</span>
                                <span>{student.mentalState}/100</span>
                              </div>
                              <div className="progress-bar mental">
                                <span style={{ width: `${Math.min(Math.max(student.mentalState, 0), 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="student-footer">
                        <div className="student-stats-row">
                          <div className="mini-stat">
                            <span className="label">天赋</span>
                            <span className="value">{student.talent}</span>
                          </div>
                          <div className="mini-stat">
                            <span className="label">勤奋</span>
                            <span className="value">{student.diligence}</span>
                          </div>
                          <div className="mini-stat">
                            <span className="label">运势</span>
                            <span className="value">{student.luck}</span>
                          </div>
                        </div>
                        <div className="mentor-status">{student.isBeingMentored ? '接受指导中...' : '自主科研中'}</div>
                        </div>
                      </div>
                    </article>
                    );
                  })}
                  {teamLoading && (
                    <article className="student-card loading">
                      <div className="student-action-bar">
                        <button className="student-action comfort" type="button" title="安抚" disabled>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                          </svg>
                        </button>
                        <button className="student-action whip" type="button" title="鞭策" disabled>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <div className="student-head">
                        <div className="student-title-row">
                          <h4>面试中</h4>
                          <div className="student-meta">
                            <span>在投 --</span>
                            <span>发表 --</span>
                          </div>
                        </div>
                        <div className="student-sub-row">
                          <div className="student-stage-stack">
                            <div className="stage-row">
                              <span className="badge stage">研一</span>
                              <span className="status-text">档案整理</span>
                            </div>
                            <span className="dept-text">候选人筛选</span>
                          </div>
                          <span className="badge tag-main neutral">待定</span>
                        </div>
                      </div>
                      <div className="student-actions">
                        <button className="ghost" type="button" disabled>
                          分配指导
                        </button>
                      </div>
                      <div className="student-story">面试中，正在了解候选人的研究经历与团队适配度。</div>
                      <div className="student-bottom">
                        <div className="student-traits">
                          <span className="trait-chip sub-trait">面试进行中</span>
                          <span className="trait-chip sub-trait">档案整理中</span>
                        </div>
                        <div className="student-progress">
                          <div className="progress-item">
                            <div className="progress-head">
                              <span>论文进度</span>
                              <span>--</span>
                            </div>
                            <div className="progress-bar paper">
                              <span style={{ width: '0%' }} />
                            </div>
                          </div>
                          <div className="progress-row">
                            <div className="progress-item">
                              <div className="progress-head">
                                <span>压力</span>
                                <span>--</span>
                              </div>
                              <div className="progress-bar stress">
                                <span style={{ width: '0%' }} />
                              </div>
                            </div>
                            <div className="progress-item">
                              <div className="progress-head">
                                <span>心态</span>
                                <span>--</span>
                              </div>
                              <div className="progress-bar mental">
                                <span style={{ width: '0%' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="student-footer">
                        <div className="student-stats-row">
                          <div className="mini-stat">
                            <span className="label">天赋</span>
                            <span className="value">--</span>
                          </div>
                          <div className="mini-stat">
                            <span className="label">勤奋</span>
                            <span className="value">--</span>
                          </div>
                          <div className="mini-stat">
                            <span className="label">运势</span>
                            <span className="value">--</span>
                          </div>
                        </div>
                        <div className="mentor-status">学生面试中...</div>
                        </div>
                      </div>
                    </article>
                  )}
                </div>
              )}
                {!teamLoading && !teamMembers.length && (
                  <p className="hint-text">暂无成员，点击“招募学术”生成第一批学生。</p>
                )}
              </section>
            )}

            {activeTab === 'research' && (
              <section className="info-card research-shell">
                <div className="research-head">
                  <div>
                    <p className="eyebrow">科研面板</p>
                    <h3>本季度研究节奏</h3>
                    <p className="team-note">围绕 {researchFocus} 展开交叉研究与阶段产出。</p>
                  </div>
                  <button className="primary" type="button" onClick={createProject} disabled={projectTitleLoading}>
                    {projectTitleLoading ? '生成中...' : '创建新课题'}
                  </button>
                </div>
                <div className="research-grid">
                  <div className="research-card grant-card">
                    <h4>国自然 / 国社科</h4>
                    <div className="grant-list">
                      {grantRules.map((rule) => {
                        const state = getGrantState(rule.type);
                        const isOpen = stats.quarter === rule.openQuarter;
                        return (
                          <div key={rule.type} className="grant-item">
                            <div>
                              <strong>{rule.type}</strong>
                              <p className="muted-text">
                                开放季度：Q{rule.openQuarter} · 申报费 ￥{rule.cost.toLocaleString()} · 经费奖励 {Math.round(rule.reward / 10000)} 万
                              </p>
                              {state && (
                                <p className="muted-text">
                                  当前状态：{state.status === 'approved' ? '已通过' : state.status === 'rejected' ? '未通过' : '待评审'}
                                </p>
                              )}
                            </div>
                            <button
                              className="ghost"
                              type="button"
                              onClick={() => handleApplyGrant(rule.type)}
                              disabled={!isOpen || Boolean(state)}
                            >
                              {state ? '已申请' : isOpen ? '提交申请' : '未开放'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="research-card project-paper-card">
                    <h4>课题论文</h4>
                    <div className="student-meta paper-meta">
                      <span>待选 {projectPaperSummary.awaitingVenue}</span>
                      <span>外审 {projectPaperSummary.underReview}</span>
                      <span>返修 {projectPaperSummary.awaitingRevision}</span>
                      <span>接收 {projectPaperSummary.accepted}</span>
                    </div>
                    {projectPapers.length ? (
                      <div className="project-paper-list">
                        {projectPapers.slice(0, 4).map((paper) => {
                          const statusLabel =
                            paper.status === 'awaitingVenue'
                              ? '待选刊会'
                              : paper.status === 'underReview'
                                ? '外审中'
                                : paper.status === 'awaitingRevision'
                                  ? '待返修决策'
                                  : paper.status === 'accepted'
                                    ? '已接收'
                                    : '已拒稿';
                          const badgeClass =
                            paper.status === 'accepted'
                              ? 'status'
                              : paper.status === 'rejected'
                                ? 'danger'
                                : 'stage';
                          const dueLabel =
                            paper.decisionDueYear && paper.decisionDueQuarter
                              ? ` · 预计 ${paper.decisionDueYear} 年 Q${paper.decisionDueQuarter} 出结果`
                              : '';
                          const revisionLabel = paper.revisionRound ? ` · 返修轮次 ${paper.revisionRound}` : '';
                          const venueLabel =
                            paper.venueType && paper.venueTier ? ` · ${formatVenueLabel(paper)}` : ' · 未选择刊会';

                          return (
                            <div key={paper.id} className="project-paper-item">
                              <div className="project-paper-head">
                                <strong>{paper.projectTitle}</strong>
                                <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                              </div>
                              <p className="muted-text">
                                {venueLabel}
                                {revisionLabel}
                                {dueLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted-text">暂无课题论文，结题后自动生成投稿流程。</p>
                    )}
                  </div>
                  <div className="research-card project-list-card">
                    <h4>课题列表</h4>
                    {projects.length ? (
                      <div className="project-list">
                        {projects.map((project) => {
                          const assigned = project.assignedStudentIds
                            .map((id) => teamMembers.find((student) => student.id === id))
                            .filter(Boolean) as StudentPersona[];
                          return (
                            <div key={project.id} className="project-item">
                              <div className="project-head">
                                <div>
                                  <strong>{project.title}</strong>
                                  <p className="muted-text">
                                    {project.category} · 创建于第 {project.createdYear} 年 Q{project.createdQuarter}
                                  </p>
                                </div>
                                <span className={`badge ${project.completed ? 'status' : 'stage'}`}>
                                  {project.completed ? '已完成' : '进行中'}
                                </span>
                              </div>
                              <div className="progress-list compact">
                                {[
                                  { label: '文献综述', value: project.progress.literature },
                                  { label: '实验设计', value: project.progress.experiment },
                                  { label: '结果整理', value: project.progress.results },
                                ].map((item) => (
                                  <div key={item.label} className="progress-row">
                                    <span>{item.label}</span>
                                    <div className="progress-bar">
                                      <span style={{ width: `${item.value}%` }} />
                                    </div>
                                    <em>{item.value}%</em>
                                  </div>
                                ))}
                              </div>
                              <div className="project-team">
                                <div className="project-team-list">
                                  {assigned.length ? (
                                    assigned.map((member) => (
                                      <button
                                        key={member.id}
                                        className="chip tiny"
                                        type="button"
                                        onClick={() => handleRemoveStudentFromProject(project.id, member.id)}
                                      >
                                        {member.name}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="muted-text">尚未分配学生。</span>
                                  )}
                                </div>
                                <div className="project-assign">
                                  <select
                                    className="text-input"
                                    value=""
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (!value) return;
                                      handleAssignStudentToProject(project.id, value);
                                    }}
                                  >
                                    <option value="">添加学生</option>
                                    {teamMembers.map((student) => (
                                      <option key={student.id} value={student.id}>
                                        {student.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted-text">暂无课题，点击上方按钮创建。</p>
                    )}
                  </div>
                  <div className="research-card project-create-card">
                    <h4>课题创建</h4>
                    <div className="project-form">
                      <label className="field">
                        <span>课题名称</span>
                        <input
                          className="text-input"
                          value={projectDraftTitle}
                          onChange={(event) => setProjectDraftTitle(event.target.value)}
                          placeholder="留空将自动生成"
                        />
                      </label>
                      <label className="field">
                        <span>课题类型</span>
                        <select
                          className="text-input"
                          value={projectDraftCategory}
                          onChange={(event) =>
                            setProjectDraftCategory(event.target.value as ResearchProject['category'])
                          }
                        >
                          <option value="校内课题">校内课题</option>
                          <option value="横向合作">横向合作</option>
                          <option value="自由探索">自由探索</option>
                        </select>
                      </label>
                      <button className="primary" type="button" onClick={createProject} disabled={projectTitleLoading}>
                        {projectTitleLoading ? '生成中...' : '提交课题'}
                      </button>
                      <p className="muted-text">提示：分配学生后，季度结算会自动推进进度。</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'equipment' && (
              <section className="info-card equipment-shell">
                <div className="research-head">
                  <div>
                    <p className="eyebrow">课题组设置</p>
                    <h3>资源与流程配置</h3>
                    <p className="team-note">课程、经费、硬件与日常管理安排。</p>
                  </div>
                  <button className="ghost" type="button">
                    申请经费
                  </button>
                </div>
                <div className="equipment-grid">
                  <div className="equipment-card">
                    <h4>实验室配置</h4>
                    <ul className="text-list">
                      <li>GPU 服务器 × 3</li>
                      <li>数据采集终端 × 12</li>
                      <li>学术资料库权限 × 1</li>
                    </ul>
                  </div>
                  <div className="equipment-card">
                    <h4>会议与教学</h4>
                    <ul className="text-list">
                      <li>每周组会：周三 19:00</li>
                      <li>文献阅读：周五 16:00</li>
                      <li>助教培训：隔周一次</li>
                    </ul>
                  </div>
                  <div className="equipment-card">
                    <h4>预算进度</h4>
                    <div className="progress-list">
                      {[
                        { label: '设备采购', value: 62 },
                        { label: '差旅与会议', value: 28 },
                        { label: '学生补助', value: 44 },
                      ].map((item) => (
                        <div key={item.label} className="progress-row">
                          <span>{item.label}</span>
                          <div className="progress-bar">
                            <span style={{ width: `${item.value}%` }} />
                          </div>
                          <em>{item.value}%</em>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>

        </div>
        </div>
        <aside className="dashboard-right">
          <div className="timeline-card">
            <div className="timeline-head">
              <h4>新消息</h4>
              <span className="badge status small">已更新</span>
            </div>
            <div className="timeline-body">
              {eventLog.map((item) => (
                <div key={item.id} className="timeline-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="timeline-card">
            <h4>下一步</h4>
            <ul className="text-list">
              <li>提交本季度研究计划</li>
              <li>安排第一次组会</li>
              <li>整理申请材料</li>
            </ul>
          </div>
          <button className="end-quarter stick-bottom" type="button" onClick={handleEndQuarter}>
            结束本季度
          </button>
        </aside>
      </div>
    </div>
  );

  return (
    <>
      {stage === 'application' ? applicationView : dashboardView}
      {stage === 'briefing' && activeDecision && (
        <DecisionModal
          decision={activeDecision}
          queueCount={pendingDecisions.length}
          onClose={() => setActiveDecisionId(null)}
          onChoose={(optionId) => handleDecisionChoose(activeDecision, optionId)}
        />
      )}
      {profileLoading && stage === 'application' && (
        <div className="loading-overlay">
          <div className="loading-card">
            <p>正在生成导师档案...</p>
            <p>系统已打开《入职须知》，请先阅读规则并稍候。</p>
          </div>
        </div>
      )}
      {isModalOpen && (
        <SettingsModal
          onClose={() => setModalOpen(false)}
          onReset={handleResetProgress}
          mentorName={name}
          isResetting={isResetting}
        />
      )}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </>
  );
}

export default App;








