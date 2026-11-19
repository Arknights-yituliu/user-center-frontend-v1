<script setup lang="ts">
import { onBeforeUnmount, reactive } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'
import { TCL_BASE_URL } from '../api/BASE_URL'

interface ReadResult {
  path: string
  status: number | null
  body: unknown
}

interface GameTest {
  game: 'arknights' | 'endfield'
  title: string
  token: string
  loading: boolean
  message: string
  results: ReadResult[]
}

const tests = reactive<GameTest[]>([
  { game: 'arknights', title: '明日方舟', token: '', loading: false, message: '', results: [] },
  { game: 'endfield', title: '终末地', token: '', loading: false, message: '', results: [] },
])

/**
 * 各游戏的数据读取接口
 *
 * /projects 现在签发的是 PAT（`tlc_pat_` 前缀），只能用 `/pat/**` 消费；`/oauth2/**` 不认 PAT。
 * 消费面目前只提供明日方舟，终末地仍只有 OAuth 版接口（需要 access_token，PAT 打过去会 80001）。
 */
const readPaths: Record<GameTest['game'], string> = {
  arknights: '/pat/ak-accounts/operators',
  endfield: '/oauth2/ef-accounts/player-data',
}
const controllers = new Set<AbortController>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSuccess(result: ReadResult): boolean {
  return (
    result.status !== null &&
    result.status >= 200 &&
    result.status < 300 &&
    isRecord(result.body) &&
    result.body.code === 200
  )
}

function formatJson(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

async function testRead(item: GameTest): Promise<void> {
  const token = item.token.trim().replace(/^Bearer\s+/i, '')
  if (item.loading || !token) return
  const controller = new AbortController()
  controllers.add(controller)
  item.loading = true
  item.results = []
  item.message = '正在读取…'

  async function read(path: string): Promise<ReadResult> {
    // 只使用待测试的 PAT，避免站内会话或 Cookie 影响测试结果。
    const response = await axios.get<unknown>(`${TCL_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: false,
      timeout: 15000,
      signal: controller.signal,
      validateStatus: () => true,
    })
    const result = { path, status: response.status, body: response.data }
    item.results.push(result)
    return result
  }

  try {
    const result = await read(readPaths[item.game])
    item.message = isSuccess(result) ? '默认数据读取成功。' : '读取失败，请查看返回 JSON。'
  } catch (error) {
    if (controller.signal.aborted) return
    item.message = '读取失败。'
    item.results.push({
      path: '请求错误',
      status: null,
      body: { error: error instanceof Error ? error.message : '网络请求失败' },
    })
  } finally {
    controllers.delete(controller)
    item.loading = false
  }
}

onBeforeUnmount(() => {
  for (const controller of controllers) controller.abort()
})
</script>

<template>
  <v-container>
    <h1>读取 Token 测试</h1>
    <p><RouterLink to="/projects">返回工具列表生成 Token</RouterLink></p>
    <p>粘贴对应游戏的读 Token，测试数据读取接口。下方直接展示完整返回 JSON。</p>

    <section v-for="item in tests" :key="item.game" :data-game="item.game">
      <h2>{{ item.title }}</h2>
      <p>
        数据读取接口：
        <code>GET {{ TCL_BASE_URL }}{{ readPaths[item.game] }}</code>
      </p>
      <p v-if="item.game === 'endfield'">
        终末地暂未提供 PAT 消费面，此接口只认 OAuth access_token；用 PAT 调用会返回 80001。
      </p>
      <form @submit.prevent="testRead(item)">
        <v-textarea
          v-model="item.token"
          :label="`${item.title}读 Token`"
          rows="2"
          variant="outlined"
          autocomplete="off"
          spellcheck="false"
          :disabled="item.loading"
          hide-details
        />
        <v-btn type="submit" :loading="item.loading" :disabled="item.loading || !item.token.trim()">
          测试读取
        </v-btn>
      </form>
      <p role="status">{{ item.message }}</p>
      <div v-for="(result, index) in item.results" :key="index">
        <p>
          {{ result.path
          }}<template v-if="result.status !== null"> · HTTP {{ result.status }}</template>
        </p>
        <div
          class="json-preview"
          role="region"
          :aria-label="`${item.title}接口返回 JSON`"
          tabindex="0"
        >
          <pre>{{ formatJson(result.body) }}</pre>
        </div>
      </div>
    </section>
  </v-container>
</template>

<style scoped>
.json-preview {
  height: 400px;
  overflow: auto;
  padding: 12px 16px;
  border: 1px solid var(--site-line);
  border-radius: 4px;
  background: #1e1e1e;
  color: #fff;
}

.json-preview pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
