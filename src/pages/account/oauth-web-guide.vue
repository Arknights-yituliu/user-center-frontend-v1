<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { UC_BASE_URL } from '../../api/BASE_URL'
import { createMessage } from '../../utils/message'

interface GuideSection {
  id: string
  label: string
}

const route = useRoute()

const sections: GuideSection[] = [
  { id: 'prepare', label: '1. 接入准备' },
  { id: 'flow', label: '2. 调用顺序' },
  { id: 'pkce', label: '3. 生成 PKCE 参数' },
  { id: 'authorize', label: '4. 发起授权' },
  { id: 'token', label: '5. 换取令牌' },
  { id: 'userinfo', label: '6. 获取用户信息' },
  { id: 'refresh', label: '7. 刷新令牌' },
  { id: 'revoke', label: '8. 吊销令牌' },
  { id: 'errors', label: '9. 错误处理' },
  { id: 'checklist', label: '10. 上线检查' },
]

const flowSteps = [
  ['生成安全参数', '在浏览器生成 state、code_verifier 和 code_challenge'],
  ['跳转授权端点', '浏览器导航至 GET /oauth2/authorize'],
  ['登录并确认授权', '登录页与授权确认页均由 UserCenter 处理'],
  ['接收授权回调', 'UserCenter 携带 code、state 跳回登记地址'],
  ['校验并兑换令牌', '先校验 state，再调用 POST /oauth2/token'],
  ['获取用户信息', '携带 access_token 调用 GET /oauth2/userinfo'],
  ['按需刷新', 'access_token 到期后使用 refresh_token 轮换'],
  ['退出并吊销', '退出登录时调用 POST /oauth2/revoke'],
]

const errorCodes = [
  ['90001', '客户端不存在或所有者已停用', '停止登录并联系管理员'],
  ['90002', '回调地址不匹配', '检查 redirect_uri 是否与登记值完全一致'],
  ['90003', 'scope 未授权', '只申请已批准的 scope'],
  ['90004', '授权码无效或过期', '重新发起授权'],
  ['90005', '授权码已使用', '重新授权，不要重试旧 code'],
  ['90006', 'grant type 未登记', '检查客户端授权类型配置'],
  ['90008', 'PKCE 校验失败', '检查本次请求保存的 code_verifier'],
  ['90009', '令牌无效、过期或已使用', '清除令牌并重新授权'],
  ['90013', '客户端待审批或已被管理员封禁', '联系管理员完成审批或解除封禁'],
]

const checklist = reactive([
  { text: '前端代码和构建产物中不存在 client_secret', done: false },
  { text: '每次授权都重新生成 state 和 PKCE 参数', done: false },
  { text: '回调页在换码前严格校验 state', done: false },
  { text: '授权和换码请求使用完全相同的 redirect_uri', done: false },
  { text: '表单请求使用 application/x-www-form-urlencoded', done: false },
  { text: '同时检查 HTTP 状态码和响应体中的 code', done: false },
  { text: '刷新成功后原子替换 access token 与 refresh token', done: false },
  { text: 'URL、日志、监控和错误上报不记录令牌或 code_verifier', done: false },
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
&refresh_token={REFRESH_TOKEN}`,
)
const revokeRequest = computed(
  () => `POST ${baseUrl.value}/oauth2/revoke
Content-Type: application/x-www-form-urlencoded

client_id=${clientId.value}&token={TOKEN}`,
)

const pkceCode = `function toBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function randomBase64Url(byteLength) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function createPkceParameters() {
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );

  return {
    state,
    codeVerifier,
    codeChallenge: toBase64Url(new Uint8Array(digest)),
    codeChallengeMethod: "S256"
  };
}

const pkce = await createPkceParameters();

// 回调页需要读取，换码完成后立即删除。
sessionStorage.setItem("uc.oauth.pkce", JSON.stringify({
  state: pkce.state,
  codeVerifier: pkce.codeVerifier
}));`

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
  "code": 90008,
  "msg": "PKCE 校验失败",
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

function scrollToSection(id: string): void {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.history.replaceState(null, '', `${route.path}${window.location.search}#${id}`)
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
  <main class="oauth-guide-page">
    <header class="guide-header">
      <div>
        <div class="guide-kicker">
          <v-icon icon="mdi-shield-key-outline" size="16"></v-icon>
          OAuth2 开发者指南
        </div>
        <h1>无后端 Web 应用接入</h1>
        <p>使用 Authorization Code + PKCE S256 安全接入一图流用户中心</p>
      </div>
      <v-btn to="/user/oauth-clients" variant="outlined" color="primary" prepend-icon="mdi-api">
        客户端管理
      </v-btn>
    </header>

    <div class="protocol-strip" role="note">
      <span class="protocol-icon"><v-icon icon="mdi-web" size="22"></v-icon></span>
      <div>
        <strong>适用于无后端 Web 应用、静态站点等无法安全保存密钥的应用</strong>
        <p>公共客户端无需也不得使用 client_secret，PKCE 与 state 均为必需项。</p>
      </div>
      <div class="protocol-tags">
        <v-chip size="small" color="primary" variant="tonal">Authorization Code</v-chip>
        <v-chip size="small" color="success" variant="tonal">PKCE S256</v-chip>
      </div>
    </div>

    <section class="parameter-panel" aria-labelledby="parameter-title">
      <div class="parameter-heading">
        <div>
          <h2 id="parameter-title">填写你的接入参数</h2>
          <p>下方请求示例会实时更新；这些字段不包含客户端密钥。</p>
        </div>
        <div class="parameter-actions">
          <v-chip v-if="sourceClientName" color="success" size="small" variant="tonal">
            已载入：{{ sourceClientName }}
          </v-chip>
          <v-btn
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
          placeholder="https://auth.example.com"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="integration.clientId"
          label="公共客户端 ID"
          placeholder="创建客户端后获得"
          variant="outlined"
          density="compact"
          hide-details
        ></v-text-field>
        <v-text-field
          v-model="integration.redirectUri"
          label="回调地址"
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
      <label for="guide-section">当前章节</label>
      <select
        id="guide-section"
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
        <div class="toc-title">接入流程</div>
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
              <p>先完成客户端登记与服务端放行，再开始编写授权流程。</p>
            </div>
          </div>
          <p>无后端 Web 应用必须注册为公共客户端，并从管理员处确认以下信息：</p>
          <div class="info-grid">
            <div>
              <small>UserCenter 服务地址</small><code>{{ baseUrl }}</code>
            </div>
            <div>
              <small>公共客户端 ID</small><code>{{ clientId }}</code>
            </div>
            <div>
              <small>已登记的回调地址</small><code>{{ redirectUri }}</code>
            </div>
            <div>
              <small>已批准的权限范围</small><code>{{ scopes }}</code>
            </div>
          </div>
          <div class="requirement-list">
            <div>
              <v-icon icon="mdi-check-circle" color="success"></v-icon><code>authMethod=none</code>
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
              ><span>应用 Origin 已加入服务端 CORS 白名单</span>
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

        <section id="flow" class="doc-section">
          <div class="section-heading">
            <span>02</span>
            <div>
              <h2>调用顺序</h2>
              <p>接入方只负责发起授权、处理回调和管理令牌。</p>
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
          <div class="callout info">
            <v-icon icon="mdi-information-outline"></v-icon>
            <div>
              <strong>UserCenter 负责登录和授权确认</strong>
              <p>
                接入方不要调用 <code>/oauth2/ticket</code>、<code>/oauth2/consent/info</code> 或
                <code>/oauth2/consent</code>，保持浏览器导航流程即可。
              </p>
            </div>
          </div>
        </section>

        <section id="pkce" class="doc-section">
          <div class="section-heading">
            <span>03</span>
            <div>
              <h2>生成 PKCE 参数</h2>
              <p>每次授权都必须重新生成，并只在当前浏览器会话中短暂保存。</p>
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
                  <td>随机字符串，用于防止 CSRF</td>
                </tr>
                <tr>
                  <td><code>code_verifier</code></td>
                  <td>43 至 128 个字符的高强度随机字符串</td>
                </tr>
                <tr>
                  <td><code>code_challenge</code></td>
                  <td><code>BASE64URL(SHA256(code_verifier))</code>，不带 = padding</td>
                </tr>
                <tr>
                  <td><code>code_challenge_method</code></td>
                  <td>固定为 <code>S256</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JavaScript · Web Crypto API</span
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
          <p>
            发起授权时提交 <code>state</code>、<code>codeChallenge</code> 和
            <code>S256</code>；回调后读取保存的 <code>codeVerifier</code>，换码结束后立即删除。
          </p>
        </section>

        <section id="authorize" class="doc-section">
          <div class="section-heading">
            <span>04</span>
            <div>
              <h2>发起授权</h2>
              <p>将浏览器导航到授权端点，不要通过 AJAX 请求代替页面跳转。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 授权请求</span
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
                  <td><code>response_type</code></td>
                  <td>是</td>
                  <td>固定为 <code>code</code></td>
                </tr>
                <tr>
                  <td><code>client_id</code></td>
                  <td>是</td>
                  <td>公共客户端 ID</td>
                </tr>
                <tr>
                  <td><code>redirect_uri</code></td>
                  <td>是</td>
                  <td>已登记的精确回调地址</td>
                </tr>
                <tr>
                  <td><code>scope</code></td>
                  <td>否</td>
                  <td>逗号分隔，必须是已批准范围的子集；不传则使用全部范围</td>
                </tr>
                <tr>
                  <td><code>state</code></td>
                  <td>是</td>
                  <td>本次授权生成的随机字符串</td>
                </tr>
                <tr>
                  <td><code>code_challenge</code></td>
                  <td>是</td>
                  <td>本次 PKCE challenge</td>
                </tr>
                <tr>
                  <td><code>code_challenge_method</code></td>
                  <td>是</td>
                  <td>固定为 <code>S256</code></td>
                </tr>
              </tbody>
            </table>
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
              <strong>先校验 state，再使用 code</strong>
              <p>state 与会话中保存值不完全一致时立即终止流程，绝不能兑换授权码。</p>
            </div>
          </div>
        </section>

        <section id="token" class="doc-section">
          <div class="section-heading">
            <span>05</span>
            <div>
              <h2>授权码换取令牌</h2>
              <p>将一次性授权码和本次 code_verifier 作为表单提交。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · Token 请求</span
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
          <div class="callout warning compact">
            <v-icon icon="mdi-key-remove"></v-icon><strong>公共客户端不得提交 client_secret</strong>
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
            只有客户端登记了 <code>refresh_token</code> grant 时才会签发 refresh token，否则该字段为
            <code>null</code>。授权码只能使用一次，成功或失败后都不要记录授权码和
            <code>code_verifier</code>。
          </p>
        </section>

        <section id="userinfo" class="doc-section">
          <div class="section-heading">
            <span>06</span>
            <div>
              <h2>获取用户信息</h2>
              <p>使用 access token 获取当前已授权用户的公开资料。</p>
            </div>
          </div>
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
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>字段</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>uid</code></td>
                  <td>UserCenter 全局用户 ID，接入方应使用它关联本地用户</td>
                </tr>
                <tr>
                  <td><code>userName</code></td>
                  <td>用户名，可能为 null</td>
                </tr>
                <tr>
                  <td><code>nickname</code></td>
                  <td>用户昵称，可能为 null</td>
                </tr>
                <tr>
                  <td><code>avatar</code></td>
                  <td>头像地址，可能为 null</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="refresh" class="doc-section">
          <div class="section-heading">
            <span>07</span>
            <div>
              <h2>刷新令牌</h2>
              <p>仅在已登记 refresh_token grant 且换码响应实际返回 refresh token 时调用。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 刷新请求</span
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
          <div class="rotation-flow">
            <div>
              <span>1</span>
              <p>只发送当前 refresh token</p>
            </div>
            <v-icon icon="mdi-arrow-right"></v-icon>
            <div>
              <span>2</span>
              <p>保存响应中的新令牌对</p>
            </div>
            <v-icon icon="mdi-arrow-right"></v-icon>
            <div>
              <span>3</span>
              <p>立即废弃旧 refresh token</p>
            </div>
          </div>
          <ul class="plain-list">
            <li>refresh token 一次性轮换，相同令牌最多一个请求成功。</li>
            <li>不要并发刷新；保存新 access token 与 refresh token 时应原子更新。</li>
            <li>返回 <code>90009</code> 时清除本地令牌并重新发起授权。</li>
            <li>公共客户端刷新时同样不得提交 <code>client_secret</code>。</li>
          </ul>
        </section>

        <section id="revoke" class="doc-section">
          <div class="section-heading">
            <span>08</span>
            <div>
              <h2>吊销令牌</h2>
              <p>用户退出登录或应用不再使用令牌时主动吊销。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>HTTP · 吊销请求</span
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
          <p>
            <code>token</code> 可以是 access token 或 refresh token。吊销 refresh token
            时，与其关联的 access token
            会同时失效。接口是幂等的：令牌不存在、已失效或不属于当前客户端时仍返回成功。
          </p>
          <div class="response-inline">
            <code>{ "code": 200, "msg": "操作成功", "data": null }</code>
          </div>
        </section>

        <section id="errors" class="doc-section">
          <div class="section-heading">
            <span>09</span>
            <div>
              <h2>统一错误处理</h2>
              <p>除授权跳转外，接口均使用统一响应结构。</p>
            </div>
          </div>
          <div class="callout danger">
            <v-icon icon="mdi-alert-decagram-outline"></v-icon>
            <div>
              <strong>必须检查响应体中的 code</strong>
              <p>HTTP 请求成功不等于业务成功，不能只判断 HTTP 状态码。</p>
            </div>
          </div>
          <div class="code-example">
            <div class="code-toolbar">
              <span>JSON · 错误响应</span
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
.oauth-guide-page {
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
.protocol-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 70px;
  padding: 14px 18px;
  border: 1px solid rgb(var(--v-theme-primary) / 0.22);
  border-left: 3px solid rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.05);
}
.protocol-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 6px;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.12);
}
.protocol-strip strong {
  font-size: 14px;
  font-weight: 600;
}
.protocol-strip p {
  margin: 2px 0 0;
  color: #4e5969;
  font-size: 12px;
}
.protocol-tags {
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
.callout.compact {
  align-items: center;
  padding-top: 10px;
  padding-bottom: 10px;
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
.flow-list li:nth-last-child(-n + 2) {
  min-height: 50px;
}
.flow-list li:nth-last-child(-n + 2):before {
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
.rotation-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 18px 0;
}
.rotation-flow > div {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 58px;
  padding: 10px;
  border: 1px solid #e5e6eb;
  background: #f7f8fa;
}
.rotation-flow span {
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
.rotation-flow p {
  margin: 0;
  color: #4e5969;
  font-size: 12px;
  line-height: 1.45;
}
.rotation-flow > .v-icon {
  color: #86909c;
}
.plain-list {
  display: grid;
  gap: 8px;
  margin: 15px 0 0;
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
  .oauth-guide-page {
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
}
@media (max-width: 700px) {
  .oauth-guide-page {
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
  .protocol-strip {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 13px;
  }
  .protocol-tags {
    width: auto;
    margin-left: 52px;
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
  .flow-list li:nth-last-child(-n + 2) {
    min-height: 72px;
  }
  .flow-list li:last-child {
    min-height: 50px;
  }
  .flow-list li:nth-last-child(-n + 2):before {
    display: block;
  }
  .flow-list li:last-child:before {
    display: none;
  }
  .rotation-flow {
    grid-template-columns: 1fr;
  }
  .rotation-flow > .v-icon {
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
    min-width: 110px;
    padding: 9px 11px;
  }
  pre {
    padding: 14px;
    font-size: 11px;
  }
}
</style>
