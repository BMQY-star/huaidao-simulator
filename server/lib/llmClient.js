import { TextDecoder } from 'node:util'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fetchFn =
  globalThis.fetch ??
  ((...args) => import('node-fetch').then(({ default: fetchModule }) => fetchModule(...args)))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, '..', 'config', 'llmConfig.json')

const loadConfig = () => {
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    console.error('[LLMClient] Failed to load config JSON, fallback to env.', error)
    return {}
  }
}

const { apiUrl, apiKey, model } = loadConfig()

const LLM_API_URL = apiUrl || process.env.LLM_API_URL || 'http://111.119.221.189:9600/openai/v1/responses'
const LLM_API_KEY = apiKey || process.env.LLM_API_KEY
const LLM_MODEL = model || process.env.LLM_MODEL || 'gpt-5.1-codex-max'

export class LLMClient {
  constructor({ apiUrl: url = LLM_API_URL, apiKey: key = LLM_API_KEY, model: mdl = LLM_MODEL } = {}) {
    this.apiUrl = url
    this.apiKey = key
    this.model = mdl
  }

  buildPayload({ systemPrompt, userPrompt }) {
    return {
      model: this.model,
      stream: true,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt ?? 'You are a helpful assistant.' }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
    }
  }

  async collectStream(stream) {
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let result = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line || line === '[DONE]') continue
        const payload = line.startsWith('data:') ? line.slice(5).trim() : line
        if (!payload) continue
        try {
          const event = JSON.parse(payload)
          if (event.type === 'response.output_text.delta') result += event.delta || ''
        } catch {
          // ignore malformed chunk
        }
      }
    }

    return result
  }

  async generateText({ systemPrompt, userPrompt }) {
    if (!userPrompt) throw new Error('userPrompt is required')
    if (!this.apiKey) throw new Error('LLM_API_KEY is required (set env/config)')

    const response = await fetchFn(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(this.buildPayload({ systemPrompt, userPrompt })),
    })

    if (!response.ok || !response.body) {
      const text = await response.text()
      throw new Error(`LLM request failed: ${response.status} ${text}`)
    }

    return this.collectStream(response.body)
  }
}

export const llmClient = new LLMClient()
