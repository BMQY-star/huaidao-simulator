import { llmClient } from '../lib/llmClient.js'

const systemPrompt = '你是高校模拟器的课题名称生成助手。只输出严格 JSON，不要额外解释。'

const buildTitlePrompt = ({ discipline, department, researchFocus, category }) => {
  const safeDiscipline = discipline || '交叉学科'
  const safeDepartment = department || '学院'
  const safeFocus = researchFocus || '交叉研究'
  const safeCategory = category || '校内课题'
  return `${safeDiscipline}${safeDepartment}生成一个${safeCategory}课题名称，方向聚焦${safeFocus}。只返回 JSON：{ "title": "课题名称" }
要求：1) 10-18 个汉字为主；2) 不包含英文与标点；3) 风格正式学术但可读。`
}

const fallbackTitles = [
  '跨域数据稀疏建模与协同优化',
  '复杂系统稳态调控与鲁棒推理',
  '绿色算力调度与能耗协同机制',
  '多源信息融合驱动的智能决策',
  '非结构数据可信治理与评估',
  '模型对齐与安全可控路径研究',
  '高维表示压缩与快速检索方法',
  '跨场景迁移学习与应用落地',
]

const extractJson = (text) => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch (error) {
    console.warn('[ProjectTitle] Failed to parse JSON payload.', error)
    return null
  }
}

export async function generateProjectTitle({ discipline, department, researchFocus, category }) {
  try {
    const response = await llmClient.generateText({
      systemPrompt,
      userPrompt: buildTitlePrompt({ discipline, department, researchFocus, category }),
    })
    const parsed = extractJson(response)
    const title = parsed?.title?.trim()
    if (title) return title
    return fallbackTitles[Math.floor(Math.random() * fallbackTitles.length)]
  } catch (error) {
    console.warn('[ProjectTitle] generation failed, fallback to sample.', error)
    return fallbackTitles[Math.floor(Math.random() * fallbackTitles.length)]
  }
}
