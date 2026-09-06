<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { UC_BASE_URL } from '../../api/BASE_URL'
import { createMessage } from '../../utils/message'

const route = useRoute()

const sections = [
  { id: 'prepare', label: '1. 接入准备' },
  { id: 'boundary', label: '2. 安全边界' },
  { id: 'flow', label: '3. 调用顺序' },
  { id: 'pkce', label: '4. 服务端 PKCE' },
  { id: 'authorize', label: '5. 发起授权' },
  { id: 'token', label: '6. 换取令牌' },
  { id: 'userinfo', label: '7. 用户信息与会话' },
  { id: 'refresh', label: '8. 刷新与吊销' },
  { id: 'errors', label: '9. 错误处理' },
  { id: 'checklist', label: '10. 上线检查' },
]

const flowSteps = [
  ['生成安全参数', '业务后端生成 state、code_verifier 和 code_challenge'],
  ['保存服务端会话', '将 state 与 code_verifier 绑定当前浏览器会话并短时保存'],
  ['浏览器跳转授权', '业务后端让浏览器导航至 GET /oauth2/authorize'],
  ['UserCenter 完成授权', 'UserCenter 处理登录和用户授权确认'],
  ['回调业务后端', '浏览器携带 code、state 返回登记的回调地址'],
  ['校验并消费 state', '业务后端原子消费 state，阻止回放'],
  ['服务端兑换令牌', '携带 client_secret 和 code_verifier 调用 token 端点'],
  ['建立业务会话', '查询 UserInfo 后向浏览器签发自己的安全会话 Cookie'],
  ['维护令牌生命周期', '业务后端按需刷新，并在退出时吊销令牌'],
]

const errorCodes = [
  ['90001', '客户端不存在或所有者已停用', '停止登录并联系管理员'],
  ['90002', '回调地址不匹配', '检查 redirect_uri 是否与登记值完全一致'],
  ['90003', 'scope 未授权', '只申请已批准的 scope'],
  ['90004', '授权码无效或过期', '重新发起授权'],
  ['90005', '授权码已使用', '重新授权，不要重试旧 code'],
  ['90006', 'grant type 未登记', '检查客户端授权类型配置'],
  ['90007', '客户端密钥校验失败', '检查密钥是否缺失、错误或已经轮换'],
  ['90008', 'PKCE 校验失败', '检查本次授权保存的 code_verifier'],
  ['90009', '令牌无效或已过期（含 refresh token 已被吊销）', '清除令牌并重新授权'],
  ['90013', '客户端待审批或已被管理员封禁', '联系管理员完成审批或解除封禁'],
]

const checklist = reactive([
  { text: 'client_secret 只保存在可信后端或密钥管理系统', done: false },
  { text: '生产环境 OAuth 接口和回调地址均使用 HTTPS', done: false },
  { text: '每次授权都生成新的 state 和 PKCE 参数', done: false },
  { text: 'state、code_verifier 与当前浏览器会话绑定并短时保存', done: false },
  { text: '回调后先原子消费 state，再兑换授权码', done: false },
  { text: '授权和换码使用完全相同的 redirect_uri', done: false },
  { text: '换码、刷新和吊销均在业务后端完成', done: false },
  { text: '使用 client_secret_post，不使用 HTTP Basic Authentication', done: false },
  { text: '浏览器只持有业务系统自己的安全会话', done: false },
  { text: '业务成功与否按响应体 code 判断', done: false },
  { text: '刷新成功后更新本地 access token；refresh token 固定复用，无需替换', done: false },
  { text: '密钥轮换后所有后端实例同步切换到新密钥', done: false },
])

function queryText(name: string): string {
  const value = route.query[name]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function sanitizeScopes(value: string): string {
  return value
    .split(/[\s,，]+/)
    .filter((scope) => scope && scope !== 'user.email')
    .join(',')
}

const integration = reactive({
  baseUrl: queryText('baseUrl') || UC_BASE_URL,
  clientId: queryText('clientId'),
  redirectUri: queryText('redirectUri'),
  scopes: sanitizeScopes(queryText('scopes')) || 'user.read',
})
const sourceClientName = queryText('clientName')
const activeSection = ref('prepare')
const completedChecks = computed(() => checklist.filter((item) => item.done).length)
const checklistProgress = computed(() => (completedChecks.value / checklist.length) * 100)

function valueOrPlaceholder(value: string, placeholder: string): string {
  return value.trim() || placeholder
}

const baseUrl = computed(() =>
  valueOrPlaceholder(integration.baseUrl, '{UC_BASE_URL}').replace(/\/+$/, ''),
)
const clientId = computed(() => valueOrPlaceholder(integration.clientId, '{CLIENT_ID}'))
const redirectUri = computed(() => valueOrPlaceholder(integration.redirectUri, '{REDIRECT_URI}'))
const scopes = computed(() => sanitizeScopes(integration.scopes) || 'user.read')
const encodedRedirectUri = computed(() =>
  integration.redirectUri.trim()
    ? encodeURIComponent(integration.redirectUri.trim())
    : '{URL_ENCODED_REDIRECT_URI}',
)

const authorizeRequest = computed(
  () => `GET ${baseUrl.value}/oauth2/authorize
    ?response_type=code
    &client_id=${clientId.value}
    &redirect_uri=${encodedRedirectUri.value}
    &scope=${scopes.value}
    &state={STATE}
    &code_challenge={CODE_CHALLENGE}
    &code_challenge_method=S256`,
)
const callbackSuccess = computed(
  () => `${redirectUri.value}?code={AUTHORIZATION_CODE}&state={STATE}`,
)
const callbackDenied = computed(() => `${redirectUri.value}?error=access_denied&state={STATE}`)
const tokenRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=${clientId.value}
&client_secret={CLIENT_SECRET}
&code={AUTHORIZATION_CODE}
&redirect_uri=${encodedRedirectUri.value}
&code_verifier={CODE_VERIFIER}`,
)
const userinfoRequest = computed(
  () => `GET ${baseUrl.value}/oauth2/userinfo
Authorization: Bearer {ACCESS_TOKEN}`,
)
const refreshRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id=${clientId.value}
&client_secret={CLIENT_SECRET}
&refresh_token={REFRESH_TOKEN}`,
)
const revokeRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/revoke
Content-Type: application/x-www-form-urlencoded

client_id=${clientId.value}
&client_secret={CLIENT_SECRET}
&token={TOKEN}`,
)

const pkceCode = `import { createHash, randomBytes } from "node:crypto";

function createAuthorizationState() {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url");

  return { state, codeVerifier, codeChallenge };
}

const authorization = createAuthorizationState();

// 绑定当前浏览器会话，设置较短有效期，回调成功后一次性删除。
await authorizationStore.save(authorization.state, {
  codeVerifier: authorization.codeVerifier,
  redirectUri: process.env.OAUTH_REDIRECT_URI
}, 300);`

const tokenResponse = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "access_token": "access_token_value",
    "token_type": "Bearer",
    "expires_in": 7200,
    "refresh_token": "refresh_token_value",
    "scope": "user.read"
  }
}`

// 刷新令牌成功响应：仅返回新的 access token，refresh_token 与 scope 未变均不返回
const refreshResponse = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "access_token": "access_token_value_2",
    "token_type": "Bearer",
    "expires_in": 7200
  }
}`

const userinfoResponse = `{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "uid": 10001,
    "userName": "orange-user",
    "nickname": "Orange",
    "avatar": "https://example.com/avatar.png"
  }
}`

const errorResponse = `{
  "code": 90007,
  "msg": "客户端密钥校验失败",
  "data": null
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
  integration.baseUrl = UC_BASE_URL
  integration.clientId = ''
  integration.redirectUri = ''
  integration.scopes = 'user.read'
}

function markAllChecks(): void {
  const done = completedChecks.value !== checklist.length
  checklist.forEach((item) => (item.done = done))
}

function scrollToSection(id: string): void {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', `${route.path}${window.location.search}#${id}`)
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

  const hash = route.hash.slice(1)
  if (hash && sections.some((section) => section.id === hash)) {
    window.setTimeout(() => scrollToSection(hash), 0)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main class="server-guide-page">
    <header class="guide-header">
      <div>
        <div class="guide-kicker">
          <v-icon icon="mdi-server-security" size="16"></v-icon>服务端 OAuth2 指南
        </div>
        <h1>加密客户端 OAuth2 接入</h1>
        <p>适用于能够安全保存客户端密钥的后端服务或 BFF</p>
      </div>
      <v-btn to="/user/oauth-clients" variant="outlined" color="primary" prepend-icon="mdi-api"
        >客户端管理</v-btn
      >
    </header>

    <div class="security-strip" role="note">
      <span class="security-icon"><v-icon icon="mdi-key-chain" size="22"></v-icon></span>
      <div>
        <strong>client_secret、UserCenter 令牌和 PKCE verifier 必须留在可信后端</strong>
        <p>浏览器只参与页面跳转，并持有业务系统自己的安全会话。</p>
      </div>
      <div class="security-tags">
        <v-chip size="small" color="primary" variant="tonal">client_secret_post</v-chip
        ><v-chip size="small" color="success" variant="tonal">PKCE S256</v-chip>
      </div>
    </div>

    <section class="parameter-panel" aria-labelledby="server-parameter-title">
      <div class="parameter-heading">
        <div>
          <h2 id="server-parameter-title">填写接入参数</h2>
          <p>请求示例会实时更新；为安全起见，本页不接收或保存真实 client_secret。</p>
        </div>
        <div class="parameter-actions">
          <v-chip v-if="sourceClientName" color="success" size="small" variant="tonal"
            >已载入：{{ sourceClientName }}</v-chip
          ><v-btn
            icon="mdi-refresh"
            variant="text"
            size="small"
            aria-label="重置接入参数"
            title="重置接入参数"
            @click="resetParameters"
          ></v-btn>
        </div>
      </div>
      <div class="parameter-grid">
        <v-text-field
          v-model="integration.baseUrl"
          label="UserCenter 服务地址"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="integration.clientId"
          label="加密客户端 ID"
          placeholder="创建客户端后获得"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="integration.redirectUri"
          label="服务端回调地址"
          placeholder="https://app.example.com/oauth/callback"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="integration.scopes"
          label="权限范围"
          placeholder="user.read"
          variant="outlined"
          density="compact"
          hide-details
          @blur="integration.scopes = sanitizeScopes(integration.scopes) || 'user.read'"
        ></v-text-field>
      </div>
    </section>

    <div class="mobile-section-picker">
      <label for="server-guide-section">当前章节</label
      ><select
        id="server-guide-section"
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
        <div class="toc-title">服务端接入</div>
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
        <section id="prepare" class="doc-section">
          <div class="section-heading">
            <span>01</span>
            <div>
              <h2>接入准备</h2>
              <p>注册加密客户端并确认授权类型、审批状态与密钥存储。</p>
            </div>
          </div>
          <div class="info-grid">
            <div>
              <small>UserCenter 服务地址</small><code>{{ baseUrl }}</code>
            </div>
            <div>
              <small>加密客户端 ID</small><code>{{ clientId }}</code>
            </div>
            <div>
              <small>服务端回调地址</small><code>{{ redirectUri }}</code>
            </div>
            <div>
              <small>已批准的权限范围</small><code>{{ scopes }}</code>
            </div>
          </div>
          <div class="requirement-list">
            <div>
              <v-icon icon="mdi-check-circle" color="success"></v-icon
              ><code>authMethod=client_secret_post</code>
            </div>
            <div>
              <v-icon icon="mdi-check-circle" color="success"></v-icon
              ><code>ownerEnabled=true</code>
            </div>
            <div>
              <v-icon icon="mdi-check-circle" color="success"></v-icon
              ><code>adminApproved=true</code>
            </div>
            <div>
              <v-icon icon="mdi-check-circle" color="success"></v-icon
              ><span>grantTypes 包含 authorization_code</span>
            </div>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-lock-alert-outline"></v-icon>
            <div>
              <strong>客户端密钥不得进入浏览器或公开环境</strong>
              <p>
                不要写入前端代码、移动端包、桌面程序、公开仓库、URL 或日志。当前不支持
                client_secret_basic。
              </p>
            </div>
          </div>
          <div class="callout warning">
            <v-icon icon="mdi-alert-outline"></v-icon>
            <div>
              <strong>回调地址必须精确匹配</strong>
              <p>协议、域名、端口、路径和查询参数均须与登记值完全一致。</p>
            </div>
          </div>
        </section>

        <section id="boundary" class="doc-section">
          <div class="section-heading">
            <span>02</span>
            <div>
              <h2>安全边界</h2>
              <p>只有页面导航穿过浏览器，敏感请求全部留在服务端。</p>
            </div>
          </div>
          <div class="boundary-flow">
            <div>
              <v-icon icon="mdi-web" size="25"></v-icon><strong>浏览器</strong>
              <p>跳转授权、携带回调参数、保存业务会话 Cookie</p>
            </div>
            <span><v-icon icon="mdi-arrow-left-right"></v-icon><small>页面跳转</small></span>
            <div class="trusted">
              <v-icon icon="mdi-server-security" size="25"></v-icon><strong>业务后端 / BFF</strong>
              <p>保存密钥、PKCE、令牌，建立本地登录会话</p>
            </div>
            <span><v-icon icon="mdi-arrow-left-right"></v-icon><small>HTTPS</small></span>
            <div>
              <v-icon icon="mdi-shield-account-outline" size="25"></v-icon
              ><strong>UserCenter</strong>
              <p>用户登录、授权确认、签发和校验令牌</p>
            </div>
          </div>
          <div class="callout info">
            <v-icon icon="mdi-information-outline"></v-icon>
            <div>
              <strong>UserCenter 负责登录与授权确认</strong>
              <p>接入方不要调用 /oauth2/ticket、/oauth2/consent/info 或 /oauth2/consent。</p>
            </div>
          </div>
        </section>

        <section id="flow" class="doc-section">
          <div class="section-heading">
            <span>03</span>
            <div>
              <h2>调用顺序</h2>
              <p>以服务端会话为中心完成授权码流程。</p>
            </div>
          </div>
          <ol class="flow-list">
            <li v-for="(step, index) in flowSteps" :key="step[0]">
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ step[0] }}</strong>
                <p>{{ step[1] }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section id="pkce" class="doc-section">
          <div class="section-heading">
            <span>04</span>
            <div>
              <h2>服务端生成 PKCE</h2>
              <p>每次授权重新生成，并绑定当前浏览器会话。</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>要求</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>state</code></td>
                  <td>随机字符串，防止 CSRF 并绑定当前浏览器会话</td>
                </tr>
                <tr>
                  <td><code>code_verifier</code></td>
                  <td>43 至 128 个字符的高强度随机字符串</td>
                </tr>
                <tr>
                  <td><code>code_challenge</code></td>
                  <td>BASE64URL(SHA256(code_verifier))，不带 = padding</td>
                </tr>
                <tr>
                  <td><code>code_challenge_method</code></td>
                  <td>固定为 S256</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>Node.js · node:crypto</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制 PKCE 代码"
                title="复制代码"
                @click="copyText(pkceCode)"
              ></v-btn>
            </div>
            <pre><code>{{ pkceCode }}</code></pre>
          </div>
          <div class="callout warning">
            <v-icon icon="mdi-timer-lock-outline"></v-icon>
            <div>
              <strong>短时保存并一次性消费</strong>
              <p>
                state 和 code_verifier 应保存在服务端短时存储；回调时先验证会话归属，再原子消费
                state。
              </p>
            </div>
          </div>
        </section>

        <section id="authorize" class="doc-section">
          <div class="section-heading">
            <span>05</span>
            <div>
              <h2>发起授权</h2>
              <p>业务后端构造地址，让浏览器导航到 UserCenter。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 浏览器导航</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制授权请求"
                title="复制请求"
                @click="copyText(authorizeRequest, '授权请求')"
              ></v-btn>
            </div>
            <pre><code>{{ authorizeRequest }}</code></pre>
          </div>
          <div class="callout info">
            <v-icon icon="mdi-key-remove"></v-icon>
            <div>
              <strong>授权请求不能携带 client_secret</strong>
              <p>客户端密钥只在服务端换码、刷新和吊销请求的 HTTPS 表单正文中出现。</p>
            </div>
          </div>
          <div class="callback-grid">
            <div>
              <b class="success">授权成功</b><code>{{ callbackSuccess }}</code
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制成功回调"
                title="复制成功回调"
                @click="copyText(callbackSuccess, '成功回调')"
              ></v-btn>
            </div>
            <div>
              <b class="error">用户拒绝</b><code>{{ callbackDenied }}</code
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制拒绝回调"
                title="复制拒绝回调"
                @click="copyText(callbackDenied, '拒绝回调')"
              ></v-btn>
            </div>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-shield-alert-outline"></v-icon>
            <div>
              <strong>先校验并消费 state，再处理 code</strong>
              <p>state 与当前会话不完全一致时立即终止流程，不得兑换授权码。</p>
            </div>
          </div>
        </section>

        <section id="token" class="doc-section">
          <div class="section-heading">
            <span>06</span>
            <div>
              <h2>服务端换取令牌</h2>
              <p>通过 HTTPS 表单正文提交 client_secret 和本次 code_verifier。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · client_secret_post</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制 Token 请求"
                title="复制请求"
                @click="copyText(tokenRequest, 'Token 请求')"
              ></v-btn>
            </div>
            <pre><code>{{ tokenRequest }}</code></pre>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>参数</th>
                  <th>必填</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>grant_type</code></td>
                  <td>是</td>
                  <td>固定为 authorization_code</td>
                </tr>
                <tr>
                  <td><code>client_id</code></td>
                  <td>是</td>
                  <td>加密客户端 ID</td>
                </tr>
                <tr>
                  <td><code>client_secret</code></td>
                  <td>是</td>
                  <td>通过表单请求体提交，不使用 HTTP Basic</td>
                </tr>
                <tr>
                  <td><code>code</code></td>
                  <td>是</td>
                  <td>回调得到的一次性授权码</td>
                </tr>
                <tr>
                  <td><code>redirect_uri</code></td>
                  <td>是</td>
                  <td>必须与授权请求完全一致</td>
                </tr>
                <tr>
                  <td><code>code_verifier</code></td>
                  <td>是</td>
                  <td>与 code_challenge 对应的原始随机串</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · 成功响应</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制 Token 响应"
                title="复制响应"
                @click="copyText(tokenResponse, '响应示例')"
              ></v-btn>
            </div>
            <pre><code>{{ tokenResponse }}</code></pre>
          </div>
          <p>
            只有登记了 <code>refresh_token</code> grant 才会签发 refresh token；否则响应体不包含
            <code>refresh_token</code> 字段（<code>access_token</code>、<code>token_type</code>、
            <code>expires_in</code> 照常返回）。授权码只能成功兑换一次；随后立即删除本次 state 和 code_verifier。
          </p>
        </section>

        <section id="userinfo" class="doc-section">
          <div class="section-heading">
            <span>07</span>
            <div>
              <h2>用户信息与业务会话</h2>
              <p>使用全局 uid 关联本地用户，并建立业务系统自己的登录会话。</p>
            </div>
          </div>
          <div class="example-columns">
            <div class="code-example">
              <div class="code-toolbar">
                <span>HTTP · UserInfo 请求</span
                ><v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  aria-label="复制 UserInfo 请求"
                  title="复制请求"
                  @click="copyText(userinfoRequest, 'UserInfo 请求')"
                ></v-btn>
              </div>
              <pre><code>{{ userinfoRequest }}</code></pre>
            </div>
            <div class="code-example">
              <div class="code-toolbar">
                <span>JSON · 成功响应</span
                ><v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  size="x-small"
                  aria-label="复制用户信息响应"
                  title="复制响应"
                  @click="copyText(userinfoResponse, '响应示例')"
                ></v-btn>
              </div>
              <pre><code>{{ userinfoResponse }}</code></pre>
            </div>
          </div>
          <div class="session-flow">
            <div>
              <span>1</span>
              <p>后端使用 access token 查询 UserInfo</p>
            </div>
            <v-icon icon="mdi-arrow-right"></v-icon>
            <div>
              <span>2</span>
              <p>使用 uid 关联业务系统本地用户</p>
            </div>
            <v-icon icon="mdi-arrow-right"></v-icon>
            <div>
              <span>3</span>
              <p>向浏览器签发 HttpOnly 安全会话 Cookie</p>
            </div>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-cookie-lock-outline"></v-icon>
            <div>
              <strong>不要把 UserCenter 令牌返回浏览器</strong>
              <p>除非业务协议明确需要，access token 与 refresh token 都应保存在业务后端。</p>
            </div>
          </div>
        </section>

        <section id="refresh" class="doc-section">
          <div class="section-heading">
            <span>08</span>
            <div>
              <h2>刷新与吊销令牌</h2>
              <p>两个操作都由业务后端完成，并提交当前有效的 client_secret。</p>
            </div>
          </div>
          <div class="example-columns">
            <div>
              <h3>刷新令牌</h3>
              <div class="code-example">
                <div class="code-toolbar">
                  <span>HTTP · 固定凭证刷新</span
                  ><v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="x-small"
                    aria-label="复制刷新请求"
                    title="复制请求"
                    @click="copyText(refreshRequest, '刷新请求')"
                  ></v-btn>
                </div>
                <pre><code>{{ refreshRequest }}</code></pre>
              </div>
            </div>
            <div>
              <h3>吊销令牌</h3>
              <div class="code-example">
                <div class="code-toolbar">
                  <span>HTTP · 幂等接口</span
                  ><v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="x-small"
                    aria-label="复制吊销请求"
                    title="复制请求"
                    @click="copyText(revokeRequest, '吊销请求')"
                  ></v-btn>
                </div>
                <pre><code>{{ revokeRequest }}</code></pre>
              </div>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · 刷新响应</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制刷新响应"
                title="复制响应"
                @click="copyText(refreshResponse, '刷新响应')"
              ></v-btn>
            </div>
            <pre><code>{{ refreshResponse }}</code></pre>
          </div>
          <p>
            刷新成功仅返回新的 access token；<code>refresh_token</code> 未变、<code>scope</code> 未变，均不返回。
          </p>
          <ul class="plain-list">
            <li>刷新成功后更新本地 access token；refresh token 为固定凭证，原值复用无需替换。</li>
            <li>默认 90 天有效，有效期内可反复刷新，服务端不删除、不换发。</li>
            <li>刷新返回 90009 表示 refresh token 已过期或被吊销，清除令牌并让用户重新授权。</li>
            <li>密钥轮换后，所有后端实例必须立即使用新密钥。</li>
            <li>吊销 refresh token 时，它派生的 access token（同一客户端名下）会被级联吊销；吊销接口幂等。</li>
          </ul>
        </section>

        <section id="errors" class="doc-section">
          <div class="section-heading">
            <span>09</span>
            <div>
              <h2>统一错误处理</h2>
              <p>除授权跳转外，必须检查统一响应体中的业务 code。</p>
            </div>
          </div>
          <div class="code-example short">
            <div class="code-toolbar">
              <span>JSON · 密钥错误</span
              ><v-btn
                icon="mdi-content-copy"
                variant="text"
                size="x-small"
                aria-label="复制错误响应"
                title="复制响应"
                @click="copyText(errorResponse, '错误响应')"
              ></v-btn>
            </div>
            <pre><code>{{ errorResponse }}</code></pre>
          </div>
          <div class="table-wrap error-table">
            <table>
              <thead>
                <tr>
                  <th>code</th>
                  <th>含义</th>
                  <th>接入方处理</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in errorCodes" :key="item[0]">
                  <td>
                    <code>{{ item[0] }}</code>
                  </td>
                  <td>{{ item[1] }}</td>
                  <td>{{ item[2] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="checklist" class="doc-section">
          <div class="section-heading checklist-heading">
            <span>10</span>
            <div>
              <h2>上线前检查</h2>
              <p>{{ completedChecks }} / {{ checklist.length }} 项已确认</p>
            </div>
            <v-btn size="small" variant="text" color="primary" @click="markAllChecks">{{
              completedChecks === checklist.length ? '全部取消' : '全部确认'
            }}</v-btn>
          </div>
          <v-progress-linear
            :model-value="checklistProgress"
            color="success"
            height="6"
            rounded
            class="check-progress"
          ></v-progress-linear>
          <div class="check-list">
            <label v-for="(item, index) in checklist" :key="item.text" :class="{ done: item.done }"
              ><input v-model="item.done" type="checkbox" /><span class="custom-check"
                ><v-icon icon="mdi-check" size="15"></v-icon></span
              ><span class="check-index">{{ String(index + 1).padStart(2, '0') }}</span
              ><span>{{ item.text }}</span></label
            >
          </div>
        </section>
      </article>
    </div>
  </main>
</template>

<style scoped>
.server-guide-page {
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
.security-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 70px;
  padding: 14px 18px;
  border: 1px solid #ffd591;
  border-left: 3px solid #ff7d00;
  background: #fff7e8;
}
.security-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 6px;
  color: #b65b00;
  background: #ffe7ba;
}
.security-strip strong {
  font-size: 14px;
  font-weight: 600;
}
.security-strip p {
  margin: 2px 0 0;
  color: #4e5969;
  font-size: 12px;
}
.security-tags {
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
.parameter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
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
  margin: 22px 0 8px;
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
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid #e5e6eb;
  border-left: 1px solid #e5e6eb;
}
.info-grid > div {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 13px 14px;
  border-right: 1px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
}
.info-grid small {
  color: #86909c;
  font-size: 12px;
}
.info-grid code {
  overflow: hidden;
  padding: 0;
  color: #1d2129;
  background: transparent;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.requirement-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px 18px;
  margin-top: 18px;
}
.requirement-list > div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4e5969;
  font-size: 13px;
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
.boundary-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.15fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.boundary-flow > div {
  display: grid;
  min-height: 136px;
  place-items: center;
  padding: 16px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
  text-align: center;
}
.boundary-flow > div.trusted {
  border-color: rgb(var(--v-theme-primary) / 0.35);
  background: rgb(var(--v-theme-primary) / 0.06);
}
.boundary-flow strong {
  margin-top: 7px;
  font-size: 13px;
  font-weight: 600;
}
.boundary-flow p {
  margin: 5px 0 0;
  color: #86909c;
  font-size: 11px;
  line-height: 1.5;
}
.boundary-flow > span {
  display: grid;
  place-items: center;
  color: #86909c;
}
.boundary-flow > span small {
  font-size: 10px;
}
.flow-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 28px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.flow-list li {
  position: relative;
  display: flex;
  gap: 11px;
  min-height: 72px;
}
.flow-list li:before {
  content: '';
  position: absolute;
  inset: 27px auto 3px 13px;
  width: 1px;
  background: #e5e6eb;
}
.flow-list li:last-child {
  min-height: 50px;
}
.flow-list li:last-child:before {
  display: none;
}
.flow-list li > span {
  display: grid;
  width: 27px;
  height: 27px;
  flex: 0 0 27px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: rgb(var(--v-theme-primary));
  font-size: 12px;
  font-weight: 700;
}
.flow-list strong {
  font-size: 13px;
  font-weight: 600;
}
.flow-list p {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 12px;
  line-height: 1.55;
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
.code-example.short pre {
  max-height: none;
}
.callback-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.callback-grid > div {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 8px;
  padding: 13px;
  border: 1px solid #e5e6eb;
}
.callback-grid code {
  padding: 0;
  overflow-wrap: anywhere;
  background: transparent;
  font-size: 11px;
}
.callback-grid :deep(.v-btn) {
  position: absolute;
  top: 7px;
  right: 7px;
}
.callback-grid b {
  width: max-content;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}
.callback-grid b.success {
  color: #067d31;
  background: #e8f7ed;
}
.callback-grid b.error {
  color: #b71d20;
  background: #fff1f0;
}
.example-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.example-columns > div {
  min-width: 0;
}
.example-columns pre {
  min-height: 150px;
}
.session-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 18px 0;
}
.session-flow > div {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 62px;
  padding: 10px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
}
.session-flow span {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #4e5969;
  font-size: 11px;
  font-weight: 700;
}
.session-flow p {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 1.45;
}
.session-flow > .v-icon {
  color: #86909c;
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
.error-table th:first-child,
.error-table td:first-child {
  width: 84px;
}
.checklist-heading {
  align-items: center;
}
.checklist-heading .v-btn {
  margin-left: auto;
}
.check-progress {
  margin-bottom: 18px;
}
.check-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid #e5e6eb;
  border-left: 1px solid #e5e6eb;
}
.check-list label {
  display: grid;
  grid-template-columns: 20px 24px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 62px;
  padding: 10px 13px;
  border-right: 1px solid #e5e6eb;
  border-bottom: 1px solid #e5e6eb;
  color: #4e5969;
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}
.check-list input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.custom-check {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid #c9cdd4;
  border-radius: 3px;
  color: transparent;
  background: #fff;
}
.check-list label.done .custom-check {
  border-color: #00a63c;
  color: #fff;
  background: #00a63c;
}
.check-list label.done > span:last-child {
  color: #86909c;
  text-decoration: line-through;
}
.check-index {
  color: #86909c;
  font-family: Consolas, monospace;
  font-size: 11px;
}
@media (max-width: 900px) {
  .server-guide-page {
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
  .boundary-flow {
    grid-template-columns: 1fr;
  }
  .boundary-flow > span {
    transform: rotate(90deg);
  }
  .example-columns {
    grid-template-columns: 1fr;
  }
  .example-columns pre {
    min-height: 0;
  }
}
@media (max-width: 700px) {
  .server-guide-page {
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
  .security-strip {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 13px;
  }
  .security-tags {
    width: auto;
    margin-left: 52px;
    flex-wrap: wrap;
  }
  .parameter-panel {
    padding: 14px;
  }
  .parameter-heading {
    align-items: flex-start;
  }
  .parameter-grid,
  .info-grid,
  .requirement-list,
  .flow-list,
  .callback-grid,
  .check-list {
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
  .session-flow {
    grid-template-columns: 1fr;
  }
  .session-flow > .v-icon {
    transform: rotate(90deg);
    justify-self: center;
  }
  .checklist-heading {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
  }
  .checklist-heading .v-btn {
    grid-column: 2;
    justify-self: start;
    margin: 5px 0 0 -12px;
  }
  .table-wrap {
    margin-right: -16px;
    margin-left: -16px;
    border-right: 0;
    border-left: 0;
  }
  th,
  td {
    min-width: 100px;
    padding: 9px 11px;
  }
  pre {
    padding: 14px;
    font-size: 11px;
  }
}
</style>
