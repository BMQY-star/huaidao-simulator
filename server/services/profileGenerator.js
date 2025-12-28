import { llmClient } from '../lib/llmClient.js'

const defaultSystemPrompt =
  'You are an expert narrative designer for a tenure-track faculty simulator. Respond in Chinese.'

const parseList = (text) =>
  text
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\-\d\.、\s]+/, '').trim())
    .filter(Boolean)

const buildSectionPrompts = ({ biographySeed, areas, recruitment, achievements }) => ({
  biography: {
    prompt: `请用第一人称撰写一段 150-220 字的个人简历风格简介，语气真实克制、略带自嘲，保留“本人X、毕业背景、联合培养/实习经历、博士期间能力、入职讲师现状”等结构，不要空泛口号：${biographySeed}`,
    parser: (text) => text.trim(),
    fallback: biographySeed,
  },
  researchAreas: {
    prompt: `根据这些研究线索，列出 4 个精炼的研究方向，每行一个：${areas.join('；')}`,
    parser: parseList,
    fallback: areas,
  },
  recruitmentNeeds: {
    prompt: `根据这些信息，列出 3 条招生要求，每条一句话，用 1. 占行表达：${recruitment.join('；')}`,
    parser: parseList,
    fallback: recruitment,
  },
  achievements: {
    prompt: `根据以下成就素材，整理成 3 条主要成就，用项目符号列出：${achievements.join('；')}`,
    parser: parseList,
    fallback: achievements,
  },
  quote: {
    prompt: `请写一句导师风格的激励语，用中文，引号内输出即可。背景：${biographySeed}`,
    parser: (text) => text.replace(/^["“]+|["”]+$/g, '').trim(),
    fallback: biographySeed,
  },
  motivation: {
    prompt: `请写一段 150-300 字的自我激励，第一人称，语气宏大而克制，强调在数据驱动时代的使命感与技术敬畏，避免出现具体姓名或“老师”称谓。背景：${biographySeed}`,
    parser: (text) => text.trim(),
    fallback: biographySeed,
  },
})

export async function generateProfileFromLLM(payload) {
  const sections = buildSectionPrompts(payload)
  const entries = Object.entries(sections)

  const results = await Promise.all(
    entries.map(async ([key, config]) => {
      try {
        const response = await llmClient.generateText({
          systemPrompt: defaultSystemPrompt,
          userPrompt: config.prompt,
        })
        const parsed = config.parser(response)
        return [key, parsed && parsed.length ? parsed : config.fallback]
      } catch (error) {
        console.warn(`[ProfileGenerator] section ${key} failed, using fallback.`, error)
        return [key, config.fallback]
      }
    }),
  )

  return Object.fromEntries(results)
}
