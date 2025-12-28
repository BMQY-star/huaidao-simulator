import express from 'express'
import cors from 'cors'

import { generateProfileFromLLM } from './services/profileGenerator.js'
import { generateStudentPersonas } from './services/studentGenerator.js'
import { generateProjectTitle } from './services/projectTitleGenerator.js'

const app = express()
const PORT = Number(process.env.API_PORT || process.env.PORT || 4000)

app.use(cors())
app.use(express.json())

const seedProfile = {
  mentor: '庄杼',
  biography:
    '本人庄杼，主要研究方向围绕博弈论 · 智能博导以及跨学院的交叉课题，擅长把复杂的问题转化为具象的教学内容并传递给学生。同时，我负责学院的若干资源协调工作，当前目标是在 6 年内完成副高职称评审，并保持心态、声望与资源的均衡。',
  researchAreas: ['博弈论 · 智能博导', '大语言模型多模态控制', '生成式教育场景实验', '跨院系协作与治理技术'],
  recruitmentNeeds: [
    '具备申报国家项目经验，能够带领学生快速起步（越快越好）',
    '擅长 Python/R/PyTorch，支持科研算力管理与实验复现',
    '对科研伦理有敬畏心，愿意与导师一起维护学术声誉',
  ],
  achievements: [
    '曾以第一作者身份在 CCF-A 级会议发表论文一篇（神经网络方向）',
    '博士阶段在国家奖学金等待遇上保持连续三年的“优等”记录',
    '获得学院“教学创新奖”，擅长构建可重复的实验课程项目',
  ],
  quote:
    '在这个教研室中，我们不仅仅是传授知识，更是将未来灌注到每一位年轻学者的身上。坐拥不同时区的邮箱，与世界各地共振，通过科研与教学的双向奔赴，我们能感受到知识如何打破边界、如何塑造新的时代。让我们一起，即便在最繁琐的教务中，也要找到一缕一点点就能照亮前路的光。',
}

let currentProfile = { ...seedProfile }
let currentStudents = []

const buildBiographySeed = (formData) => {
  const {
    name,
    gender,
    almaMater,
    discipline,
    department,
    researchFocus,
  } = formData
  const dept = department || '学院'
  const disc = discipline || '跨学科学院'
  return `本人${name || '导师'}, ${gender || '讲师'}，现任${dept}讲师，主要研究${researchFocus ||
    '交叉研究方向'}。毕业院校：${almaMater || '未知院校'}。我负责${disc}下的教学与科研协调，希望在6年内完成副高评审，并保持心态、声望、资源的均衡发展。`
}

const buildAreas = (formData) => {
  const areas = new Set([
    formData.researchFocus,
    `${formData.discipline || '跨学科'}交叉研究`,
    '学生自驱/AI 辅导',
    '科研治理与资源共享',
  ])
  return [...areas].filter(Boolean)
}

const buildRecruitment = (formData) => [
  `希望学生具备 ${formData.researchFocus || '相关'} 的基础知识，能够迅速投入实验。`,
  `优先考虑熟悉 ${formData.department || '学院'} 项目生态、乐于团队协作的申请者。`,
  '愿意与导师在科研伦理与数智工具上保持高标准，共担口碑。',
]

const buildAchievements = (formData) => [
  `带领${formData.department || '学院'}团队完成多项 ${formData.researchFocus || '交叉'} 课题试点。`,
  '在教学领域获得学院认可的“教学创新奖”。',
  '持续贡献跨学科项目管理经验。',
]

app.get('/api/profile', (_req, res) => {
  console.log('[API] GET /api/profile', new Date().toISOString())
  res.json(currentProfile)
})

app.post('/api/profile', async (req, res) => {
  const formData = req.body || {}
  const seed = {
    biographySeed: buildBiographySeed(formData),
    areas: buildAreas(formData),
    recruitment: buildRecruitment(formData),
    achievements: buildAchievements(formData),
  }

  try {
    console.log('[API] POST /api/profile from form', new Date().toISOString())
    const generated = await generateProfileFromLLM(seed)
    currentProfile = {
      mentor: formData.name || seedProfile.mentor,
      ...generated,
    }
    res.json(currentProfile)
  } catch (error) {
    console.error('Profile generation failed', error)
    res.status(500).json({ error: '生成失败，请稍后再试。' })
  }
})

app.post('/api/profile/generate', async (req, res) => {
  const seed = {
    biographySeed: req.body?.biographySeed || currentProfile.biography,
    areas: req.body?.areas || currentProfile.researchAreas,
    recruitment: req.body?.recruitmentNeeds || currentProfile.recruitmentNeeds,
    achievements: req.body?.achievements || currentProfile.achievements,
  }

  try {
    console.log('[API] POST /api/profile/generate', new Date().toISOString())
    const generated = await generateProfileFromLLM(seed)
    console.log('[API] Profile generated from LLM')
    currentProfile = {
      mentor: currentProfile.mentor,
      ...generated,
    }
    res.json(currentProfile)
  } catch (error) {
    console.error('Profile generation failed', error)
    res.status(500).json({ error: '生成失败，请稍后再试。' })
  }
})

app.get('/api/students', (_req, res) => {
  console.log('[API] GET /api/students', new Date().toISOString())
  res.json(currentStudents)
})

app.post('/api/students', async (req, res) => {
  const payload = {
    mentor: req.body?.mentor || currentProfile.mentor,
    department: req.body?.department,
    researchFocus: req.body?.researchFocus || currentProfile.researchAreas?.[0],
    count: req.body?.count,
    mode: req.body?.mode,
  }
  try {
    console.log('[API] POST /api/students', new Date().toISOString())
    const generated = await generateStudentPersonas(payload)
    if (payload.mode === 'recruit' && currentStudents.length) {
      currentStudents = [...currentStudents, ...generated]
    } else {
      currentStudents = generated
    }
    res.json(currentStudents)
  } catch (error) {
    console.error('Student generation failed', error)
    res.status(500).json({ error: '生成学生画像失败，请稍后再试。' })
  }
})

app.post('/api/projects/title', async (req, res) => {
  const payload = {
    discipline: req.body?.discipline,
    department: req.body?.department,
    researchFocus: req.body?.researchFocus,
    category: req.body?.category,
  }
  try {
    console.log('[API] POST /api/projects/title', new Date().toISOString())
    const title = await generateProjectTitle(payload)
    res.json({ title })
  } catch (error) {
    console.error('Project title generation failed', error)
    res.status(500).json({ error: '课题名称生成失败，请稍后再试。' })
  }
})

app.post('/api/reset', (_req, res) => {
  console.log('[API] POST /api/reset', new Date().toISOString())
  currentProfile = { ...seedProfile }
  currentStudents = []
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`)
})
