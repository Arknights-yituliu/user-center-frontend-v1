<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { UC_BASE_URL } from '../../api/BASE_URL'
import { createMessage } from '../../utils/message'

const sections = [
  { id: 'conventions', label: '1. 通用约定' },
  { id: 'save', label: '2. 保存配置（save）' },
  { id: 'save-if-match', label: '3. 条件更新（save-if-match）' },
  { id: 'read', label: '4. 读取配置' },
  { id: 'delete', label: '5. 删除配置' },
  { id: 'quota', label: '6. 查询配额' },
  { id: 'errors', label: '7. 常见错误' },
  { id: 'sync', label: '8. 推荐同步流程' },
]

/** save 接口（无条件保存）请求字段：expectedHash 不参与校验，仅做覆盖式写入 */
const saveRequestFields = [
  ['id', 'integer / null', '否', '为空=新建；非空=按 id 覆盖更新，目标必须属于当前用户和当前 OAuth 客户端'],
  ['category', 'string', '是', '配置分类，1-32 个字符'],
  ['version', 'string', '是', '配置版本，1-32 个字符'],
  ['name', 'string', '是', '配置名称，1-32 个字符'],
  ['source', 'string', '否', '配置来源，最多 32 个字符'],
  ['note', 'string', '否', '备注，最多 32 个字符'],
  ['config', 'object / string', '是', '配置内容，不能为 null'],
  ['expectedHash', 'string / null', '否', 'save 接口不使用：创建时携带非空值返回 HTTP 400；更新时携带一律忽略'],
]

/** save-if-match 接口（CAS 条件更新）请求字段：id 与 expectedHash 均必填，不承担创建 */
const matchRequestFields = [
  ['id', 'integer', '是', '读取接口返回的配置 ID，必须属于当前用户和当前 OAuth 客户端'],
  ['category', 'string', '是', '配置分类，1-32 个字符，须与原记录一致'],
  ['version', 'string', '是', '配置版本，1-32 个字符，须与原记录一致'],
  ['name', 'string', '是', '配置名称，1-32 个字符，须与原记录一致'],
  ['source', 'string', '否', '配置来源，最多 32 个字符'],
  ['note', 'string', '否', '备注，最多 32 个字符'],
  ['config', 'object / string', '是', '配置内容，不能为 null'],
  ['expectedHash', 'string', '是', '目标记录的最新 64 位 SHA-256 hash，由读取接口或上次保存响应返回'],
]

const errorCodes = [
  ['400', '10002', '字段缺失、格式错误、更新时修改了身份字段，或 save-if-match 缺少 id / expectedHash', '修正请求后重试'],
  ['409', '10005', 'save 创建目标已存在、按 id 覆盖的目标不存在，或 save-if-match 携带过期 hash', '重新读取配置并处理冲突'],
  ['200', '10001', '删除的配置不存在或不属于当前 OAuth 客户端', '停止操作并重新读取配置列表'],
  ['200', '10004', '用户配置总量超过当前配额', '删除不需要的配置或申请提额'],
  ['200', '80001', 'access token 缺失、无效或登录状态失效', '重新获取有效 access token'],
  ['200', '40001', '服务端内部错误', '稍后重试并保留请求信息'],
]

/** 防并发条件更新（save-if-match）推荐流程：以读取到的 id 与 hash 作为 CAS 提交基线 */
const syncSteps = [
  ['读取', '调用读取接口获得目标配置的 id、内容和 hash'],
  ['编辑', '在本地基于该版本编辑配置'],
  ['保存', '调用 save-if-match，将读取到的 id 和 hash 分别作为 id、expectedHash'],
  ['更新基线', '保存成功后用响应中的新 hash 替换本地旧 hash'],
  ['处理冲突', '收到 HTTP 409 时重新读取配置，不使用旧 hash 循环重试'],
]

/** 无条件保存（save）的使用要点：新建传 id=null，覆盖更新按 id 直接写入 */
const saveFlowNotes = [
  '新建：调用 POST /oauth2/config/save，id 为空（省略或传 null），可省略 expectedHash 或显式传 null。',
  '覆盖更新：同样调用 save，id 传目标配置 ID，无需 expectedHash；适合可容忍“最后写入者胜出”的同步场景。',
]

const params = reactive({
  baseUrl: UC_BASE_URL,
  category: 'editor',
  version: 'v1',
  name: 'default',
})
const activeSection = ref('conventions')

function valueOrPlaceholder(value: string, placeholder: string): string {
  return value.trim() || placeholder
}

const baseUrl = computed(() =>
  valueOrPlaceholder(params.baseUrl, '{UC_BASE_URL}').replace(/\/+$/, ''),
)
const category = computed(() => valueOrPlaceholder(params.category, '{CATEGORY}'))
const version = computed(() => valueOrPlaceholder(params.version, '{VERSION}'))
const configName = computed(() => valueOrPlaceholder(params.name, '{NAME}'))
const queryString = computed(() => {
  const query = new URLSearchParams({
    category: category.value,
    version: version.value,
    name: configName.value,
  })
  return query.toString()
})

const saveRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/config/save
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}`,
)
/** save-if-match 条件更新端点：仅当 expectedHash 与目标当前 content_hash 一致才落库 */
const matchRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/config/save-if-match
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}`,
)
const listRequest = computed(
  () => `GET ${baseUrl.value}/oauth2/config/list?${queryString.value}
Authorization: Bearer {ACCESS_TOKEN}`,
)
const deleteRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/config/delete
Content-Type: application/json
Authorization: Bearer {ACCESS_TOKEN}`,
)
const quotaRequest = computed(
  () => `GET ${baseUrl.value}/oauth2/config/quota
Authorization: Bearer {ACCESS_TOKEN}`,
)

const createPayload = computed(
  () => `{
  "id": null,
  "category": "${category.value}",
  "version": "${version.value}",
  "name": "${configName.value}",
  "source": "web",
  "note": "首次同步",
  "config": {
    "theme": "dark",
    "fontSize": 14
  },
  "expectedHash": null
}`,
)

/** save 覆盖更新请求体：按 id 直接覆盖，save 接口不使用 expectedHash */
const overwritePayload = computed(
  () => `{
  "id": 123,
  "category": "${category.value}",
  "version": "${version.value}",
  "name": "${configName.value}",
  "source": "web",
  "note": "自动同步",
  "config": {
    "theme": "light",
    "fontSize": 16
  }
}`,
)

const updatePayload = computed(
  () => `{
  "id": 123,
  "category": "${category.value}",
  "version": "${version.value}",
  "name": "${configName.value}",
  "source": "web",
  "note": "自动同步",
  "config": {
    "theme": "light",
    "fontSize": 16
  },
  "expectedHash": "2b7e151628aed2a6abf7158809cf4f3c762e7160f38b4da56a784d9045190cfe"
}`,
)

const saveResponse = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "id": 123,
    "hash": "5f70bf18a08660b84f3f4f4f25c4a32f5f728c01e98b767a7c8a153f67e85972"
  }
}`

const conflictResponse = `{
  "code": 10005,
  "msg": "配置已被更新",
  "data": {
    "currentHash": "c19d3f7b40d5d193e6dc1faa4f26b18d73f8a70bff94e59f3d47a50e64f7f031"
  }
}`

const listResponse = computed(
  () => `{
  "code": 200,
  "msg": "操作成功",
  "data": [
    {
      "id": 123,
      "clientId": "example-client",
      "category": "${category.value}",
      "version": "${version.value}",
      "name": "${configName.value}",
      "source": "web",
      "note": "自动同步",
      "config": { "theme": "light", "fontSize": 16 },
      "hash": "5f70bf18a08660b84f3f4f4f25c4a32f5f728c01e98b767a7c8a153f67e85972",
      "createTime": "2026-09-03T10:00:00",
      "updateTime": "2026-09-03T10:05:00"
    }
  ]
}`,
)

const deletePayload = `{
  "id": 123
}`

const quotaResponse = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "usedBytes": 102400,
    "limitBytes": 512000,
    "remainingBytes": 409600
  }
}`

async function copyText(text: string, label = '代码'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    createMessage({ text: `${label}已复制`, type: 'success' })
  } catch {
    createMessage({ text: '复制失败，请手动选中复制', type: 'error' })
  }
}

function resetParameters(): void {
  params.baseUrl = UC_BASE_URL
  params.category = 'editor'
  params.version = 'v1'
  params.name = 'default'
}

function scrollToSection(id: string): void {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', `${window.location.pathname}#${id}`)
}

let observer: IntersectionObserver | null = null

onMounted(async () => {
  await nextTick()
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]?.target.id) activeSection.value = visible[0].target.id
    },
    { rootMargin: '-88px 0px -68% 0px', threshold: 0 },
  )
  sections.forEach(({ id }) => {
    const element = document.getElementById(id)
    if (element) observer?.observe(element)
  })

  const hash = window.location.hash.slice(1)
  if (hash && sections.some((section) => section.id === hash)) {
    window.setTimeout(() => scrollToSection(hash), 0)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main class="config-guide-page">
    <header class="guide-header">
      <div>
        <div class="guide-kicker">
          <v-icon icon="mdi-cloud-sync-outline" size="16"></v-icon>
          OAuth 配置同步指南
        </div>
        <h1>OAuth 用户配置接口</h1>
        <p>使用 access token 为当前用户保存、读取和同步应用配置</p>
      </div>
    </header>

    <div class="scope-strip" role="note">
      <span class="scope-icon"><v-icon icon="mdi-shield-account-outline" size="22"></v-icon></span>
      <div>
        <strong>服务端自动按用户与 OAuth 客户端隔离配置</strong>
        <p>uid 和 client_id 均从 access token 获取，调用方不能通过请求参数指定。</p>
      </div>
      <div class="scope-tags">
        <v-chip size="small" color="primary" variant="tonal">JSON</v-chip>
        <v-chip size="small" color="warning" variant="tonal">CAS</v-chip>
        <v-chip size="small" color="success" variant="tonal">用户级配额</v-chip>
      </div>
    </div>

    <section class="parameter-panel" aria-labelledby="config-parameter-title">
      <div class="parameter-heading">
        <div>
          <h2 id="config-parameter-title">配置请求参数</h2>
          <p>下方请求 URL 和 JSON 示例会随输入实时更新。</p>
        </div>
        <v-btn
          icon="mdi-refresh"
          variant="text"
          size="small"
          aria-label="重置配置参数"
          title="重置配置参数"
          @click="resetParameters"
        ></v-btn>
      </div>
      <div class="parameter-grid">
        <v-text-field
          v-model="params.baseUrl"
          label="UserCenter 服务地址"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="params.category"
          label="配置分类 category"
          maxlength="32"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="params.version"
          label="配置版本 version"
          maxlength="32"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="params.name"
          label="配置名称 name"
          maxlength="32"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
      </div>
    </section>

    <div class="mobile-section-picker">
      <label for="config-guide-section">当前章节</label>
      <select
        id="config-guide-section"
        :value="activeSection"
        @change="scrollToSection(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="section in sections" :key="section.id" :value="section.id">
          {{ section.label }}
        </option>
      </select>
    </div>

    <div class="guide-layout">
      <aside class="guide-toc" aria-label="文档目录">
        <div class="toc-title">配置接口</div>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ active: activeSection === section.id }"
          @click="scrollToSection(section.id)"
        >
          {{ section.label }}
        </button>
      </aside>

      <article class="guide-content">
        <section id="conventions" class="doc-section">
          <div class="section-heading">
            <span>01</span>
            <div>
              <h2>通用约定</h2>
              <p>所有接口使用同一套令牌认证和响应结构。</p>
            </div>
          </div>
          <h3>认证</h3>
          <div class="auth-line">
            <v-icon icon="mdi-key-outline" color="primary"></v-icon
            ><code>Authorization: Bearer &lt;access_token&gt;</code>
          </div>
          <p>
            服务端从令牌中取得用户 <code>uid</code> 和 OAuth 客户端
            <code>client_id</code>。接入方只能读写当前 OAuth 客户端名下的配置。
          </p>
          <h3>统一响应</h3>
          <div class="response-grid">
            <div>
              <code>code</code><span>integer</span>
              <p>业务状态码，200 表示成功</p>
            </div>
            <div>
              <code>msg</code><span>string</span>
              <p>结果说明</p>
            </div>
            <div>
              <code>data</code><span>object / array / null</span>
              <p>响应数据</p>
            </div>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-alert-decagram-outline"></v-icon>
            <div>
              <strong>始终检查响应体中的 code</strong>
              <p>HTTP 200 不代表业务成功；同时正确处理文档明确返回的 HTTP 400 与 409。</p>
            </div>
          </div>
        </section>

        <section id="save" class="doc-section">
          <div class="section-heading">
            <span>02</span>
            <div>
              <h2>保存配置（save）</h2>
              <p>无条件创建或覆盖更新（last-write-wins），不做并发控制。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 保存端点</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制保存请求"
                title="复制请求"
                @click="copyText(saveRequest, '保存请求')"
              ></v-btn>
            </div>
            <pre><code>{{ saveRequest }}</code></pre>
          </div>
          <p>
            <code>id</code> 为空（省略或传 <code>null</code>）→ 新建配置；<code>id</code>
            非空 → 按 <code>id</code> 直接覆盖更新（last-write-wins）：不校验内容 hash，不要求携带
            <code>expectedHash</code>（携带也会被忽略）。需要防止并发覆盖的应用请改用第 3 节的
            <code>POST /oauth2/config/save-if-match</code>。
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>字段</th>
                  <th>类型</th>
                  <th>必填</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="field in saveRequestFields" :key="field[0]">
                  <td>
                    <code>{{ field[0] }}</code>
                  </td>
                  <td>{{ field[1] }}</td>
                  <td>{{ field[2] }}</td>
                  <td>{{ field[3] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-alert-decagram-outline"></v-icon>
            <div>
              <strong>save 不校验 expectedHash</strong>
              <p>
                创建时携带非空 <code>expectedHash</code> 会返回 HTTP 400；更新时携带一律被忽略，总是以本次内容覆盖。
              </p>
            </div>
          </div>

          <div class="example-columns">
            <div>
              <h3>首次创建</h3>
              <div class="code-example">
                <div class="code-toolbar">
                  <span>JSON · id 为空</span
                  ><v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="x-small"
                    aria-label="复制创建示例"
                    title="复制示例"
                    @click="copyText(createPayload, '创建示例')"
                  ></v-btn>
                </div>
                <pre><code>{{ createPayload }}</code></pre>
              </div>
            </div>
            <div>
              <h3>覆盖更新</h3>
              <div class="code-example">
                <div class="code-toolbar">
                  <span>JSON · 按 id 覆盖</span
                  ><v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="x-small"
                    aria-label="复制覆盖示例"
                    title="复制示例"
                    @click="copyText(overwritePayload, '覆盖示例')"
                  ></v-btn>
                </div>
                <pre><code>{{ overwritePayload }}</code></pre>
              </div>
            </div>
          </div>

          <h3>保存成功</h3>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP 200 · 返回新 hash</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制保存响应"
                title="复制响应"
                @click="copyText(saveResponse, '保存响应')"
              ></v-btn>
            </div>
            <pre><code>{{ saveResponse }}</code></pre>
          </div>
          <p>
            接入方应保存响应中的新 <code>hash</code>：save 接口本身不校验它，但后续使用 save-if-match
            防并发或再次读取时仍需最新 hash。
          </p>

          <h3>冲突与失败</h3>
          <div class="conflict-layout">
            <div class="code-example">
              <div class="code-toolbar">
                <span>HTTP 409 Conflict</span
                ><v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  aria-label="复制冲突响应"
                  title="复制响应"
                  @click="copyText(conflictResponse, '冲突响应')"
                ></v-btn>
              </div>
              <pre><code>{{ conflictResponse }}</code></pre>
            </div>
            <div class="conflict-action">
              <v-icon icon="mdi-source-branch-sync" size="28"></v-icon
              ><strong>不要携带旧 hash 循环重试</strong>
              <p>
                创建冲突时 <code>currentHash</code> 为已存在记录的内容 hash；按 id 覆盖的目标不存在或不属于当前
                OAuth 客户端时 <code>currentHash</code> 为 null。重新读取配置后决定新建或覆盖。
              </p>
            </div>
          </div>
          <p>
            按 <code>id</code> 覆盖时，<code>category</code>、<code>version</code>、<code>name</code>
            必须与目标记录一致，否则返回 HTTP 400。
          </p>
        </section>

        <section id="save-if-match" class="doc-section">
          <div class="section-heading">
            <span>03</span>
            <div>
              <h2>条件更新（save-if-match）</h2>
              <p>CAS 语义的按 id 条件更新，防止并发覆盖，不承担创建。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · CAS 端点</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制条件更新请求"
                title="复制请求"
                @click="copyText(matchRequest, '条件更新请求')"
              ></v-btn>
            </div>
            <pre><code>{{ matchRequest }}</code></pre>
          </div>
          <ul class="plain-list">
            <li><code>id</code> 与 <code>expectedHash</code> 均必填，缺少任一字段返回 HTTP 400。</li>
            <li>
              仅当目标记录当前的 <code>content_hash</code> 等于请求中的 <code>expectedHash</code>
              时才落库，并返回新 <code>hash</code>。
            </li>
            <li>
              hash 不一致（被其他请求先更新）或目标记录已被删除时返回 HTTP 409（<code>code=10005</code>），
              <code>data.currentHash</code> 为服务端最新 hash（已删除则为 <code>null</code>）。
            </li>
          </ul>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>字段</th>
                  <th>类型</th>
                  <th>必填</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="field in matchRequestFields" :key="field[0]">
                  <td>
                    <code>{{ field[0] }}</code>
                  </td>
                  <td>{{ field[1] }}</td>
                  <td>{{ field[2] }}</td>
                  <td>{{ field[3] }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>更新示例</h3>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · expectedHash 用上次读取的 hash</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制条件更新示例"
                title="复制示例"
                @click="copyText(updatePayload, '条件更新示例')"
              ></v-btn>
            </div>
            <pre><code>{{ updatePayload }}</code></pre>
          </div>

          <h3>成功响应</h3>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP 200 · 返回新 hash</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制成功响应"
                title="复制响应"
                @click="copyText(saveResponse, '成功响应')"
              ></v-btn>
            </div>
            <pre><code>{{ saveResponse }}</code></pre>
          </div>
          <p>
            接入方应保存响应中的新 <code>hash</code>，并在下一次条件更新时作为 <code>expectedHash</code> 传回。
          </p>

          <h3>冲突响应</h3>
          <div class="conflict-layout">
            <div class="code-example">
              <div class="code-toolbar">
                <span>HTTP 409 Conflict</span
                ><v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  aria-label="复制冲突响应"
                  title="复制响应"
                  @click="copyText(conflictResponse, '冲突响应')"
                ></v-btn>
              </div>
              <pre><code>{{ conflictResponse }}</code></pre>
            </div>
            <div class="conflict-action">
              <v-icon icon="mdi-source-branch-sync" size="28"></v-icon
              ><strong>出现冲突时不要直接重试覆盖</strong>
              <p>
                重新读取最新配置，根据新内容决定覆盖、合并或提示用户。目标记录已被删除时
                <code>currentHash</code> 为 null。
              </p>
            </div>
          </div>
        </section>

        <section id="read" class="doc-section">
          <div class="section-heading">
            <span>04</span>
            <div>
              <h2>读取配置</h2>
              <p>按分类查询，并可使用版本与名称精确筛选。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 查询请求</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制读取请求"
                title="复制请求"
                @click="copyText(listRequest, '读取请求')"
              ></v-btn>
            </div>
            <pre><code>{{ listRequest }}</code></pre>
          </div>
          <div class="query-fields">
            <div><code>category</code><b>必填</b><span>配置分类</span></div>
            <div><code>version</code><b>可选</b><span>精确匹配版本</span></div>
            <div><code>name</code><b>可选</b><span>精确匹配名称</span></div>
          </div>
          <p>
            结果只包含当前 OAuth 客户端名下的配置，并按更新时间倒序返回。没有匹配记录时
            <code>data</code> 为 <code>[]</code>。
          </p>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · 成功响应</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制读取响应"
                title="复制响应"
                @click="copyText(listResponse, '读取响应')"
              ></v-btn>
            </div>
            <pre><code>{{ listResponse }}</code></pre>
          </div>
          <div class="callout info">
            <v-icon icon="mdi-database-search-outline"></v-icon>
            <div>
              <strong>无条件覆盖与防并发</strong>
              <p>
                无条件覆盖更新仅需目标记录的 <code>id</code>；需要防并发时，再以记录的 <code>hash</code>
                作为 <code>expectedHash</code> 调用 save-if-match。
              </p>
            </div>
          </div>
        </section>

        <section id="delete" class="doc-section">
          <div class="section-heading">
            <span>05</span>
            <div>
              <h2>删除配置</h2>
              <p>删除为物理删除且不可恢复，不使用 CAS。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 删除请求</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制删除请求"
                title="复制请求"
                @click="copyText(`${deleteRequest}\n\n${deletePayload}`, '删除请求')"
              ></v-btn>
            </div>
            <pre><code>{{ deleteRequest }}

{{ deletePayload }}</code></pre>
          </div>
          <ul class="plain-list">
            <li><code>id</code> 必填，使用读取接口返回的配置 ID。</li>
            <li>只能删除当前用户、当前 OAuth 客户端名下的配置。</li>
            <li>删除成功后，配置占用字节数会从用户已用配额中扣除。</li>
            <li>返回 <code>code=10001</code> 时停止操作并重新读取，不要尝试其他客户端的 ID。</li>
          </ul>
          <div class="response-inline">
            <code>{ "code": 200, "msg": "操作成功", "data": null }</code>
          </div>
        </section>

        <section id="quota" class="doc-section">
          <div class="section-heading">
            <span>06</span>
            <div>
              <h2>查询配额</h2>
              <p>配额按用户统计，覆盖该用户在全部 OAuth 客户端下的配置。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 配额请求</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制配额请求"
                title="复制请求"
                @click="copyText(quotaRequest, '配额请求')"
              ></v-btn>
            </div>
            <pre><code>{{ quotaRequest }}</code></pre>
          </div>
          <div class="quota-panel">
            <div class="quota-summary">
              <div><small>已使用</small><strong>100 KB</strong></div>
              <div><small>总配额</small><strong>500 KB</strong></div>
              <div><small>剩余</small><strong class="success-text">400 KB</strong></div>
            </div>
            <v-progress-linear
              :model-value="20"
              color="primary"
              bg-color="grey-lighten-2"
              height="8"
              rounded
            ></v-progress-linear>
            <p>接口数值单位始终为 byte；仅在展示时换算为 KB 或 MB，保存前判断以服务端结果为准。</p>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · 配额响应</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制配额响应"
                title="复制响应"
                @click="copyText(quotaResponse, '配额响应')"
              ></v-btn>
            </div>
            <pre><code>{{ quotaResponse }}</code></pre>
          </div>
          <p>
            从未保存配置的用户默认返回
            <code>usedBytes=0</code
            >、<code>limitBytes=512000</code>、<code>remainingBytes=512000</code>。
          </p>
        </section>

        <section id="errors" class="doc-section">
          <div class="section-heading">
            <span>07</span>
            <div>
              <h2>常见错误</h2>
              <p>根据 HTTP 状态和业务 code 共同决定恢复策略。</p>
            </div>
          </div>
          <div class="table-wrap error-table">
            <table>
              <thead>
                <tr>
                  <th>HTTP</th>
                  <th>code</th>
                  <th>含义</th>
                  <th>处理建议</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in errorCodes" :key="item[1]">
                  <td>{{ item[0] }}</td>
                  <td>
                    <code>{{ item[1] }}</code>
                  </td>
                  <td>{{ item[2] }}</td>
                  <td>{{ item[3] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="sync" class="doc-section">
          <div class="section-heading">
            <span>08</span>
            <div>
              <h2>推荐同步流程</h2>
              <p>按是否需要防并发覆盖，选择 save-if-match 或 save。</p>
            </div>
          </div>
          <h3>8.1 防并发条件更新（save-if-match）</h3>
          <ol class="sync-flow">
            <li v-for="(step, index) in syncSteps" :key="step[0]">
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ step[0] }}</strong>
                <p>{{ step[1] }}</p>
              </div>
            </li>
          </ol>
          <h3>8.2 无条件保存（save）</h3>
          <ul class="plain-list">
            <li v-for="note in saveFlowNotes" :key="note">{{ note }}</li>
          </ul>
        </section>
      </article>
    </div>
  </main>
</template>

<style scoped>
.config-guide-page {
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding: 26px 28px 64px;
  color: #1d2129;
}
.guide-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}
.guide-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  font-weight: 600;
}
.guide-header h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: 0;
}
.guide-header p {
  margin: 5px 0 0;
  color: #86909c;
  font-size: 14px;
}
.scope-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 70px;
  padding: 14px 18px;
  border: 1px solid rgb(var(--v-theme-primary) / 0.22);
  border-left: 3px solid rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.05);
}
.scope-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 6px;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.12);
}
.scope-strip strong {
  font-size: 14px;
  font-weight: 600;
}
.scope-strip p {
  margin: 2px 0 0;
  color: #4e5969;
  font-size: 12px;
}
.scope-tags {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}
.parameter-panel {
  margin: 18px 0 22px;
  padding: 18px;
  border: 1px solid #e5e6eb;
  background: #fff;
}
.parameter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 15px;
}
.parameter-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
}
.parameter-heading p {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 12px;
}
.parameter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.guide-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}
.guide-toc {
  position: sticky;
  top: 20px;
  display: grid;
  padding: 8px 0;
  border-left: 1px solid #e5e6eb;
}
.toc-title {
  padding: 4px 15px 9px;
  color: #86909c;
  font-size: 12px;
  font-weight: 600;
}
.guide-toc button {
  position: relative;
  width: 100%;
  padding: 7px 15px;
  border: 0;
  color: #4e5969;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.guide-toc button:before {
  content: '';
  position: absolute;
  inset: 0 auto 0 -1px;
  width: 2px;
  background: transparent;
}
.guide-toc button:hover {
  color: #1d2129;
  background: #f2f3f5;
}
.guide-toc button.active {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
  background: rgb(var(--v-theme-primary) / 0.06);
}
.guide-toc button.active:before {
  background: rgb(var(--v-theme-primary));
}
.mobile-section-picker {
  display: none;
}
.guide-content {
  min-width: 0;
  border: 1px solid #e5e6eb;
  background: #fff;
}
.doc-section {
  scroll-margin-top: 20px;
  padding: 30px 34px 36px;
  border-bottom: 1px solid #e5e6eb;
}
.doc-section:last-child {
  border-bottom: 0;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin-bottom: 22px;
}
.section-heading > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  flex: 0 0 36px;
  border: 1px solid rgb(var(--v-theme-primary) / 0.3);
  border-radius: 4px;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.06);
  font-family: Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
}
.section-heading h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: 0;
}
.section-heading p {
  margin: 4px 0 0;
  color: #86909c;
  font-size: 13px;
}
.doc-section h3 {
  margin: 24px 0 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
}
.doc-section > p {
  margin: 14px 0;
  color: #4e5969;
  font-size: 14px;
  line-height: 1.8;
}
code {
  padding: 1px 4px;
  border-radius: 3px;
  color: #344054;
  background: #f2f3f5;
  font-family: Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
}
.auth-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
}
.response-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid #e5e6eb;
  border-left: 1px solid #e5e6eb;
}
.response-grid > div {
  display: grid;
  gap: 4px;
  padding: 13px;
  border-right: 1px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
}
.response-grid code {
  width: max-content;
}
.response-grid span {
  color: #86909c;
  font-size: 11px;
}
.response-grid p {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
}
.callout {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 18px;
  padding: 13px 14px;
  border-left: 3px solid;
}
.callout strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.callout p {
  margin: 3px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 1.65;
}
.callout.warning {
  border-color: #ff7d00;
  color: #8f4d00;
  background: #fff7e8;
}
.callout.info {
  border-color: #168cff;
  color: #0b63b6;
  background: #edf6ff;
}
.callout.danger {
  border-color: #f53f3f;
  color: #b71d20;
  background: #fff1f0;
}
.table-wrap {
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid #e5e6eb;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 10px 13px;
  border-bottom: 1px solid #e5e6eb;
  color: #4e5969;
  line-height: 1.55;
  text-align: left;
  vertical-align: top;
}
th {
  color: #1d2129;
  background: #f7f8fa;
  font-weight: 600;
  white-space: nowrap;
}
tr:last-child td {
  border-bottom: 0;
}
.code-example {
  width: 100%;
  min-width: 0;
  margin: 16px 0;
  overflow: hidden;
  border: 1px solid #d7dce2;
  border-radius: 4px;
  background: #151b23;
}
.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid #2c3440;
  color: #aeb9c7;
  background: #202833;
  font-size: 11px;
}
.code-toolbar :deep(.v-btn) {
  color: #d4dbe4;
}
pre {
  max-height: 440px;
  margin: 0;
  padding: 17px;
  overflow: auto;
  color: #d7e0ea;
  font-family: Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.65;
  tab-size: 2;
}
pre code {
  padding: 0;
  color: inherit;
  background: transparent;
  font-size: inherit;
}
.example-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.example-columns > div,
.conflict-layout > div {
  min-width: 0;
}
.example-columns h3 {
  margin-bottom: -7px;
}
.example-columns pre {
  height: 350px;
}
.conflict-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(210px, 1fr);
  align-items: stretch;
  gap: 14px;
}
.conflict-layout .code-example {
  margin-bottom: 0;
}
.conflict-action {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding: 20px;
  border: 1px solid #ffd591;
  color: #8f4d00;
  background: #fff7e8;
}
.conflict-action strong {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 600;
}
.conflict-action p {
  margin: 5px 0 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 1.65;
}
.query-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid #e5e6eb;
  border-left: 1px solid #e5e6eb;
}
.query-fields > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px;
  padding: 12px;
  border-right: 1px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
}
.query-fields b {
  color: rgb(var(--v-theme-primary));
  font-size: 11px;
  font-weight: 600;
}
.query-fields span {
  grid-column: 1/-1;
  color: #86909c;
  font-size: 12px;
}
.plain-list {
  display: grid;
  gap: 8px;
  margin: 15px 0;
  padding-left: 19px;
  color: #4e5969;
  font-size: 13px;
  line-height: 1.65;
}
.response-inline {
  padding: 12px 14px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
  overflow-wrap: anywhere;
}
.response-inline code {
  padding: 0;
  background: transparent;
}
.quota-panel {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
}
.quota-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 14px;
}
.quota-summary > div {
  display: grid;
  gap: 2px;
}
.quota-summary small {
  color: #86909c;
  font-size: 11px;
}
.quota-summary strong {
  font-size: 16px;
  font-weight: 600;
}
.success-text {
  color: #067d31;
}
.quota-panel > p {
  margin: 10px 0 0;
  color: #86909c;
  font-size: 11px;
}
.error-table th:nth-child(-n + 2),
.error-table td:nth-child(-n + 2) {
  width: 78px;
}
.sync-flow {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sync-flow li {
  position: relative;
  display: flex;
  gap: 12px;
  min-height: 72px;
}
.sync-flow li:before {
  content: '';
  position: absolute;
  inset: 29px auto 3px 14px;
  width: 1px;
  background: #c9cdd4;
}
.sync-flow li:last-child {
  min-height: 50px;
}
.sync-flow li:last-child:before {
  display: none;
}
.sync-flow li > span {
  display: grid;
  width: 29px;
  height: 29px;
  flex: 0 0 29px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgb(var(--v-theme-primary));
  font-size: 12px;
  font-weight: 700;
}
.sync-flow strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.sync-flow p {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 1.55;
}
@media (max-width: 900px) {
  .config-guide-page {
    padding: 22px 20px 52px;
  }
  .guide-layout {
    grid-template-columns: 1fr;
  }
  .guide-toc {
    display: none;
  }
  .mobile-section-picker {
    position: sticky;
    z-index: 3;
    top: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding: 9px 12px;
    border: 1px solid #e5e6eb;
    background: #fff;
  }
  .mobile-section-picker label {
    color: #86909c;
    font-size: 12px;
  }
  .mobile-section-picker select {
    min-width: 0;
    height: 34px;
    padding: 0 32px 0 10px;
    border: 1px solid #c9cdd4;
    border-radius: 3px;
    color: #1d2129;
    background: #fff;
    font-family: inherit;
    font-size: 13px;
  }
  .doc-section {
    scroll-margin-top: 62px;
  }
  .example-columns,
  .conflict-layout {
    grid-template-columns: 1fr;
  }
  .example-columns pre {
    height: auto;
  }
}
@media (max-width: 700px) {
  .config-guide-page {
    padding: 16px 12px 40px;
  }
  .guide-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .guide-header h1 {
    font-size: 22px;
  }
  .scope-strip {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 13px;
  }
  .scope-tags {
    width: auto;
    margin-left: 52px;
    flex-wrap: wrap;
  }
  .parameter-panel {
    padding: 14px;
  }
  .parameter-grid,
  .response-grid,
  .query-fields {
    grid-template-columns: 1fr;
  }
  .guide-content {
    border-right: 0;
    border-left: 0;
  }
  .doc-section {
    padding: 25px 16px 30px;
  }
  .section-heading {
    margin-bottom: 18px;
  }
  .section-heading h2 {
    font-size: 18px;
  }
  .table-wrap {
    margin-right: -16px;
    margin-left: -16px;
    border-right: 0;
    border-left: 0;
  }
  th,
  td {
    min-width: 95px;
    padding: 9px 11px;
  }
  pre {
    padding: 14px;
    font-size: 11px;
  }
  .quota-summary {
    gap: 10px;
  }
  .quota-summary strong {
    font-size: 14px;
  }
  .auth-line {
    align-items: flex-start;
  }
  .auth-line code {
    overflow-wrap: anywhere;
  }
}
</style>
