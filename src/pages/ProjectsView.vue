<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import { getTclToken, getTclUid } from '../api/user-center/request'
import {
  issuePat,
  listPats,
  revokePat,
  type PatPayload,
  type PatVO,
} from '../api/user-center/pat-api'
import { listAkAccounts, type AkAccountVO } from '../api/user-center/ak-account-api'
import { listEfAccounts, type EfAccount } from '../api/user-center/ef-account-api'
import arknightsIcon from '../assets/ak.webp'
import endfieldIcon from '../assets/ef.webp'
import { createMessage } from '../utils/message'
import { copyText } from '../utils/copy-text'
import { maskTokenMiddle } from '../utils/token-display'

type CommonTokenScope = 'read' | 'write'

/** 一档权限对应的已签发 PAT。 */
type CommonTokenConnection = {
  id: number
  scope: CommonTokenScope
  /** PAT 明文 */
  token: string
  /** 签发时填写的自定义名称 */
  name: string
  /** 该档对应的后端 OAuth scope 标识 */
  scopeCode: string
  /** 该令牌实际携带的权限范围（逗号分隔，可能包含多条 scope） */
  scopes: string
  /** 剩余有效期（秒），小于等于 0 即已过期 */
  expiresInSeconds: number
}

type CommonDataProject = {
  id: string
  name: string
  /** 各档签发的 scope 标识：读 / 写 */
  scopeCodes: Record<CommonTokenScope, string>
}

type AuthorizationSubAccount = {
  id: string
  project: CommonDataProject
  icon: string
  title: string
  subtitle: string
  gameUid: string
  source: 'skland' | 'manual'
  tokenConnections: CommonTokenConnection[]
}

/** 通用数据的授权粒度只有读、写两档 */
const commonTokenScopes: CommonTokenScope[] = ['read', 'write']

const commonTokenMeta: Record<
  CommonTokenScope,
  { label: string; buttonLabel: string }
> = {
  read: {
    label: '读token',
    buttonLabel: '生成读token',
  },
  write: {
    label: '写token',
    buttonLabel: '生成写token',
  },
}

/** 默认有效期 180 天 */
const DEFAULT_TOKEN_EXPIRY = 180 * 86400

const commonDataProjects = reactive<CommonDataProject[]>([
  {
    id: 'arknights',
    name: '明日方舟',
    scopeCodes: { read: 'arknights-data.read', write: 'arknights-data.write' },
  },
  {
    id: 'endfield',
    name: '明日方舟：终末地',
    scopeCodes: { read: 'endfield-data.read', write: 'endfield-data.write' },
  },
])

/** 当前展开明文的 PAT：按记录 ID 定位。 */
const visibleToken = ref<number | null>(null)
const isLoggedIn = ref(Boolean(getTclToken()))
const tokensLoading = ref(false)
const pats = ref<PatVO[]>([])
const subAccounts = ref<AuthorizationSubAccount[]>([])
const subAccountsLoading = ref(false)
/** 仅显示未过期令牌，默认开启；关闭后连过期记录一起展示 */
const onlyUnexpired = ref(true)
/** 正在签发的档位标识（子账号-scope），用于按钮禁用与防重复提交 */
const signingKey = ref<string | null>(null)
/** 正在吊销的档位标识 */
const revokingKey = ref<string | null>(null)

/** 子账号档位唯一键。 */
function tokenKey(account: AuthorizationSubAccount, scope: CommonTokenScope): string {
  return `${account.id}-${scope}`
}

/** 取某档当前仍有效的令牌（已过期的视为没有，可重新生成） */
function findActiveConnection(
  account: AuthorizationSubAccount,
  scope: CommonTokenScope,
): CommonTokenConnection | undefined {
  return account.tokenConnections.find(
    (connection) => connection.scope === scope && connection.expiresInSeconds > 0,
  )
}

/** 某档是否已有仍有效的令牌 */
function hasCommonToken(account: AuthorizationSubAccount, scope: CommonTokenScope): boolean {
  return Boolean(findActiveConnection(account, scope))
}

/** 按筛选条件返回要展示的令牌列表（默认只显示未过期的） */
function visibleConnections(account: AuthorizationSubAccount): CommonTokenConnection[] {
  return onlyUnexpired.value
    ? account.tokenConnections.filter((connection) => connection.expiresInSeconds > 0)
    : account.tokenConnections
}

/** 拆分逗号分隔的 scope 字符串 */
function splitScopes(scope: string): string[] {
  return scope
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** scope 标识 → 中文说明（与后端「可选权限」目录一致，未收录的标识原样展示） */
const scopeLabels: Record<string, string> = {
  'user.read': '用户信息（读）',
  'user.profile': '用户资料（读写）',
  'config.read': '用户配置（读）',
  'config.write': '用户配置（写）',
  'gama-data.read': '全部游戏数据（读）',
  'gama-data.write': '全部游戏数据（写）',
  'arknights-data.read': '明日方舟数据（读）',
  'arknights-data.write': '明日方舟数据（写）',
  'endfield-data.read': '终末地数据（读）',
  'endfield-data.write': '终末地数据（写）',
  all: '全部权限',
}

/** 把令牌携带的 scope 串转成可读文案 */
function scopeLabel(scope: string): string {
  return splitScopes(scope)
    .map((code) => scopeLabels[code] || code)
    .join('、')
}

/**
 * 判断一条签发记录是否覆盖目标档位：
 * 同档标识、其 gama-data 上级范围、以及元范围 all 都视为覆盖
 */
function coversScope(recordScope: string, scopeCode: string): boolean {
  const codes = splitScopes(recordScope)
  const parent = scopeCode.replace(
    /^(arknights|endfield)-data\.(read|write)$/,
    'gama-data.$2',
  )
  return codes.includes(scopeCode) || codes.includes(parent) || codes.includes('all')
}

/** 把 PAT 按 payload.game_uid 归属到具体子账号。 */
function applyTokenRecords(records: PatVO[]): void {
  for (const account of subAccounts.value) {
    const connections: CommonTokenConnection[] = []
    const ownedRecords = records.filter(
      (record) => (record.payload?.game_uid || '').trim() === account.gameUid,
    )
    const seenIds = new Set<number>()

    for (const scope of commonTokenScopes) {
      const scopeCode = account.project.scopeCodes[scope]
      const matched = ownedRecords.filter(
        (record) => !seenIds.has(record.id) && coversScope(record.scope, scopeCode),
      )
      const ordered = [
        ...matched.filter((record) => record.expiresInSeconds > 0),
        ...matched.filter((record) => record.expiresInSeconds <= 0),
      ]
      const record = ordered[0]
      if (record) {
        seenIds.add(record.id)
        connections.push({
          id: record.id,
          scope,
          token: record.token,
          name: record.name,
          scopeCode,
          scopes: record.scope,
          expiresInSeconds: record.expiresInSeconds,
        })
      }
    }

    account.tokenConnections = connections
  }
}

function buildSubAccounts(akAccounts: AkAccountVO[], efAccounts: EfAccount[]): AuthorizationSubAccount[] {
  const arknightsProject = commonDataProjects.find((project) => project.id === 'arknights')
  const endfieldProject = commonDataProjects.find((project) => project.id === 'endfield')
  if (!arknightsProject || !endfieldProject) return []

  return [
    ...akAccounts.map((account) => {
      const source: AuthorizationSubAccount['source'] = account.source === 'manual' ? 'manual' : 'skland'
      return {
        id: `arknights:${source}:${account.akUid}`,
        project: arknightsProject,
        icon: arknightsIcon,
        title: source === 'manual' ? '手动上传' : `AK-${account.akUid}`,
        subtitle: `${source === 'manual' ? 'AK-' : 'SKD_AK-'}${account.akUid}`,
        gameUid: source === 'manual' ? getTclUid() : account.akUid,
        source,
        tokenConnections: [],
      }
    }),
    ...efAccounts.map((account) => ({
      id: `endfield:${account.serverId}:${account.roleId}`,
      project: endfieldProject,
      icon: endfieldIcon,
      title: `UID ${account.roleId}`,
      subtitle: `服务器 ${account.serverId || '默认'}`,
      gameUid: account.roleId,
      source: 'skland' as const,
      tokenConnections: [],
    })),
  ]
}

async function loadSubAccounts(): Promise<void> {
  if (!isLoggedIn.value) return
  subAccountsLoading.value = true
  try {
    const [akResponse, efAccounts] = await Promise.all([listAkAccounts(), listEfAccounts()])
    subAccounts.value = buildSubAccounts(akResponse.data || [], efAccounts)
    applyTokenRecords(pats.value)
  } catch (error) {
    const ucError = error as { code?: number } | null
    if (ucError && (ucError.code === 80001 || ucError.code === 80002)) {
      isLoggedIn.value = false
    }
  } finally {
    subAccountsLoading.value = false
  }
}

/** 拉取我的 PAT 列表并按子账号回填。 */
async function loadTokens(): Promise<void> {
  if (!isLoggedIn.value) return
  tokensLoading.value = true
  try {
    const response = await listPats()
    pats.value = response.data || []
    applyTokenRecords(pats.value)
  } catch (error) {
    const ucError = error as { code?: number } | null
    if (ucError && (ucError.code === 80001 || ucError.code === 80002)) {
      isLoggedIn.value = false
      createMessage({ text: '登录已失效，请重新登录', type: 'warning' })
    }
  } finally {
    tokensLoading.value = false
  }
}

/** PAT 名称要能区分子账号，且后端限制 50 字符。 */
function tokenName(account: AuthorizationSubAccount, scope: CommonTokenScope): string {
  return `${account.project.name}-${account.title}-${commonTokenMeta[scope].label}`.slice(0, 50)
}

/** PAT 绑定当前子账号的游戏 UID。 */
function buildPayload(account: AuthorizationSubAccount): PatPayload {
  return {
    game_uid: account.gameUid,
    game_name: account.project.name,
  }
}

/**
 * 签发 PAT（POST /user/pat）。
 * 每个子账号的每个档位只保留一枚有效 PAT，重新签发成功后撤销旧 PAT。
 */
async function generateCommonToken(
  account: AuthorizationSubAccount,
  scope: CommonTokenScope,
): Promise<void> {
  const key = tokenKey(account, scope)
  if (signingKey.value) return
  const previous = findActiveConnection(account, scope)
  signingKey.value = key
  try {
    const response = await issuePat({
      expiresIn: DEFAULT_TOKEN_EXPIRY,
      name: tokenName(account, scope),
      scope: account.project.scopeCodes[scope],
      payload: buildPayload(account),
    })
    if (previous) {
      await revokePat(previous.id).catch(() => undefined)
    }
    await loadTokens()
    visibleToken.value = response.data?.id ?? null
    createMessage({
      text: `${account.title}${commonTokenMeta[scope].label}已${previous ? '重置' : '生成'}`,
      type: 'success',
    })
  } catch {
    // 业务错误由 tclRequest 统一提示。
  } finally {
    signingKey.value = null
  }
}

/** 吊销 PAT（POST /user/pat/revoke），按记录 ID 操作。 */
async function revokeCommonToken(
  account: AuthorizationSubAccount,
  connection: CommonTokenConnection,
): Promise<void> {
  if (revokingKey.value) return
  revokingKey.value = tokenKey(account, connection.scope)
  try {
    await revokePat(connection.id)
    if (visibleToken.value === connection.id) {
      visibleToken.value = null
    }
    await loadTokens()
    createMessage({
      text: `${account.title}${commonTokenMeta[connection.scope].label}已撤销`,
      type: 'success',
    })
  } catch {
    // 业务错误由 tclRequest 统一提示
  } finally {
    revokingKey.value = null
  }
}

/** 复制令牌明文 */
async function copyCommonToken(connection: CommonTokenConnection): Promise<void> {
  try {
    await copyText(connection.token)
    createMessage({ text: `通用数据${commonTokenMeta[connection.scope].label}已复制`, type: 'success' })
  } catch {
    return
  }
}

/** 脱敏展示令牌：保留头部与尾部便于辨认 */
function maskedCommonToken(connection: CommonTokenConnection): string {
  return maskTokenMiddle(connection.token)
}

/** 剩余有效期文案：超过 1 年一律显示「长期」 */
function remainingText(seconds: number): string {
  if (seconds <= 0) return '已过期'
  if (seconds > 365 * 86400) return '长期'
  if (seconds >= 86400) return `剩余 ${Math.floor(seconds / 86400)} 天`
  if (seconds >= 3600) return `剩余 ${Math.floor(seconds / 3600)} 小时`
  return `剩余 ${Math.max(1, Math.floor(seconds / 60))} 分钟`
}

/** 某个子账号档位是否正在签发。 */
function isSigning(account: AuthorizationSubAccount, scope: CommonTokenScope): boolean {
  return signingKey.value === tokenKey(account, scope)
}

/** 某个子账号档位是否正在吊销。 */
function isRevoking(account: AuthorizationSubAccount, scope: CommonTokenScope): boolean {
  return revokingKey.value === tokenKey(account, scope)
}

/** 切换某条令牌明文的显示 / 隐藏 */
function toggleTokenVisibility(connection: CommonTokenConnection): void {
  visibleToken.value = isTokenVisible(connection) ? null : connection.id
}

/** 是否展示某条令牌的明文 */
function isTokenVisible(connection: CommonTokenConnection): boolean {
  return visibleToken.value === connection.id
}

function projectNameStyle(name: string): Record<string, string> {
  return { '--project-name-length': String(Array.from(name).length) }
}

onMounted(() => {
  void loadTokens()
  void loadSubAccounts()
})
</script>


<template>
  <main class="projects-page">
    <SecondaryPageHeader
      title-id="projects-title"
      kicker="PROJECTS"
      title-a="授权控制面板"
      description="管理各个工具对数据的访问"
    >
      <template #visual>
        <div class="projects-header-texture" aria-hidden="true">
          <span class="projects-texture-route projects-texture-route-primary"></span>
          <span class="projects-texture-route projects-texture-route-secondary"></span>
          <span class="projects-texture-route projects-texture-route-cross"></span>
          <span class="projects-texture-node projects-texture-node-origin"></span>
          <span class="projects-texture-node projects-texture-node-oauth"></span>
          <span class="projects-texture-node projects-texture-node-token"></span>
          <span class="projects-texture-node projects-texture-node-cache"></span>
        </div>
      </template>
    </SecondaryPageHeader>

    <section class="project-section" aria-labelledby="common-data-management-title">
      <div class="project-section-title-row">
        <h2 id="common-data-management-title" class="project-section-title">通用数据管理</h2>
        <label class="token-filter">
          <input v-model="onlyUnexpired" type="checkbox" />
          仅显示未过期
        </label>
        <RouterLink class="project-visit-button" to="/gamedata/arknights">
          通用数据维护
          <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
        </RouterLink>
        <RouterLink class="project-visit-button" to="/gamedata-import?tab=skland">
          森空岛数据同步
          <v-icon icon="mdi-cloud-sync-outline" size="16"></v-icon>
        </RouterLink>
        <RouterLink class="project-visit-button" to="/read-token-test">
          测试读取 Token
        </RouterLink>
      </div>
      <div class="project-grid" aria-label="子账号连接列表">
        <article
          v-for="subAccount in subAccounts"
          :key="subAccount.id"
          class="project-card project-card-token project-card-common"
        >
        <div class="project-sidebar">
          <div class="project-info">
            <div class="project-identity">
              <div class="project-icon">
                <img
                  class="project-icon-image"
                  :src="subAccount.icon"
                  alt=""
                  width="56"
                  height="56"
                  aria-hidden="true"
                />
              </div>
              <div class="project-identity-copy" :style="projectNameStyle(subAccount.title)">
                <p>{{ subAccount.project.name }}</p>
                <h2>{{ subAccount.title }}</h2>
                <span class="project-identity-subtitle">{{ subAccount.subtitle }}</span>
              </div>
            </div>
          </div>

          <div class="project-actions">
            <div v-if="!isLoggedIn" class="common-token-group">
              <RouterLink class="secondary-button" :to="{ name: 'LOGIN' }">
                <v-icon icon="mdi-login-variant" size="16"></v-icon>
                登录后管理
              </RouterLink>
            </div>
            <div v-else class="common-token-group">
              <button
                v-for="scope in commonTokenScopes"
                v-show="!hasCommonToken(subAccount, scope)"
                :key="scope"
                class="primary-button"
                type="button"
                :disabled="isSigning(subAccount, scope)"
                @click="generateCommonToken(subAccount, scope)"
              >
                <v-icon icon="mdi-key-plus" size="16"></v-icon>
                {{
                  isSigning(subAccount, scope)
                    ? '签发中…'
                    : commonTokenMeta[scope].buttonLabel
                }}
              </button>
            </div>
          </div>
        </div>

        <div class="project-content">
          <div v-if="tokensLoading" class="content-empty">
            <span>正在加载…</span>
          </div>
          <div v-else-if="!isLoggedIn" class="content-empty">
            <span>登录后可查看与管理 Token</span>
          </div>
          <div v-else-if="!visibleConnections(subAccount).length" class="content-empty">
            <span v-if="subAccount.tokenConnections.length">
              暂无未过期的 Token（已隐藏过期记录）
            </span>
            <span v-else>暂无已生成的 Token</span>
          </div>
          <div v-else class="content-list">
            <div
              v-for="connection in visibleConnections(subAccount)"
              :key="connection.id"
              class="content-item content-item-token"
              :class="{ 'content-item-expired': connection.expiresInSeconds <= 0 }"
            >
              <div class="content-item-main">
                <v-icon
                  class="content-item-icon"
                  :icon="connection.expiresInSeconds > 0 ? 'mdi-key-chain-variant' : 'mdi-key-outline'"
                  size="18"
                ></v-icon>
                <div class="content-item-copy">
                  <span class="content-item-name" :title="connection.name">
                    {{ connection.name || commonTokenMeta[connection.scope].label }}
                  </span>
                  <span class="content-item-meta" :title="connection.scopes">
                    {{ scopeLabel(connection.scopes) }} ·
                    {{ remainingText(connection.expiresInSeconds) }}
                  </span>
                  <code>
                    {{ isTokenVisible(connection) ? connection.token : maskedCommonToken(connection) }}
                  </code>
                </div>
              </div>
              <div class="content-item-actions">
                <button
                  class="icon-button"
                  type="button"
                  :aria-label="isTokenVisible(connection) ? '隐藏 Token' : '显示 Token'"
                  :title="isTokenVisible(connection) ? '隐藏 Token' : '显示 Token'"
                  @click="toggleTokenVisibility(connection)"
                >
                  <v-icon
                    :icon="isTokenVisible(connection) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                    size="16"
                  ></v-icon>
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label="复制 Token"
                  title="复制 Token"
                  @click="copyCommonToken(connection)"
                >
                  <v-icon icon="mdi-content-copy" size="16"></v-icon>
                </button>
                <button
                  v-if="connection.expiresInSeconds > 0"
                  class="icon-button"
                  type="button"
                  aria-label="重置 Token"
                  title="重置 Token"
                  :disabled="isSigning(subAccount, connection.scope)"
                  @click="generateCommonToken(subAccount, connection.scope)"
                >
                  <v-icon icon="mdi-autorenew" size="16"></v-icon>
                </button>
                <button
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="撤销 Token"
                  title="撤销 Token"
                  :disabled="isRevoking(subAccount, connection.scope)"
                  @click="revokeCommonToken(subAccount, connection)"
                >
                  <v-icon icon="mdi-key-remove" size="16"></v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.projects-page {
  width: min(1120px, calc(100% - 64px));
  margin: 0 auto;
  padding: 30px 0 90px;
}

.projects-header {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-rows: auto 1fr;
  align-items: stretch;
  gap: 20px;
  min-height: clamp(280px, 34vh, 360px);
  padding: 32px 66px 36px;
  border-left: 12px solid var(--site-accent);
  background: var(--site-surface);
  box-shadow: 10px 10px 0 var(--site-pink);
}

.projects-header-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

.projects-header-copy {
  position: relative;
  z-index: 1;
  align-self: center;
}

.projects-header-texture {
  --projects-texture-grid-size: 26px;
  --projects-texture-grid-color: rgb(25 118 197 / 0.08);
  --projects-texture-line-color: rgb(25 118 197 / 0.3);
  --projects-texture-highlight-color: rgb(239 120 168 / 0.52);
  --projects-texture-node-color: var(--site-accent);
  --projects-texture-flow-duration: 6s;
  --projects-texture-scan-duration: 8s;
  position: absolute;
  z-index: 0;
  inset: 0 0 0 auto;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
}

.projects-header-texture::before {
  position: absolute;
  inset: 12px 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 calc(var(--projects-texture-grid-size) - 1px),
      var(--projects-texture-grid-color) calc(var(--projects-texture-grid-size) - 1px)
        var(--projects-texture-grid-size)
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 calc(var(--projects-texture-grid-size) - 1px),
      var(--projects-texture-grid-color) calc(var(--projects-texture-grid-size) - 1px)
      var(--projects-texture-grid-size)
    );
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 36%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 36%, #000 100%);
  content: '';
}

.projects-header-texture::after {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 18%;
  width: 1px;
  background: var(--projects-texture-highlight-color);
  content: '';
  animation: projects-texture-scan var(--projects-texture-scan-duration) ease-in-out infinite;
  opacity: 0;
}

.projects-texture-route {
  position: absolute;
  height: 3px;
  margin-top: -1px;
  overflow: hidden;
  transform-origin: left center;
  background: var(--projects-texture-line-color);
}

.projects-texture-route::after {
  position: absolute;
  top: -1px;
  left: 0;
  width: 38px;
  height: 3px;
  background: rgb(25 118 197 / 0.72);
  box-shadow: 0 0 6px rgb(25 118 197 / 0.28);
  content: '';
  animation: projects-texture-flow var(--projects-texture-flow-duration) linear infinite;
}

.projects-texture-route-primary {
  top: 64%;
  left: 12%;
  width: 74%;
  transform: rotate(-22deg);
}

.projects-texture-route-secondary {
  top: 31%;
  left: 27%;
  width: 65%;
  transform: rotate(24deg);
  background: var(--projects-texture-highlight-color);
}

.projects-texture-route-secondary::after {
  background: var(--projects-texture-highlight-color);
  box-shadow: 0 0 6px rgb(239 120 168 / 0.28);
  animation-delay: -1.2s;
}

.projects-texture-route-cross {
  top: 64%;
  left: 28%;
  width: 49%;
}

.projects-texture-route-cross::after {
  animation-delay: -2.2s;
}

.projects-texture-node {
  --projects-texture-node-pulse: rgb(25 118 197 / 0.1);
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1px solid var(--projects-texture-node-color);
  background: var(--site-surface);
  animation: projects-texture-node-pulse var(--projects-texture-flow-duration) ease-in-out infinite;
}

.projects-texture-node-origin {
  top: 63%;
  left: 11%;
}

.projects-texture-node-oauth {
  --projects-texture-node-pulse: rgb(239 120 168 / 0.12);
  top: 27%;
  left: 87%;
  border-color: var(--projects-texture-highlight-color);
  animation-delay: -0.9s;
}

.projects-texture-node-token {
  --projects-texture-node-pulse: rgb(239 120 168 / 0.12);
  top: 72%;
  left: 76%;
  border-color: var(--site-pink);
  animation-delay: -1.7s;
}

.projects-texture-node-cache {
  --projects-texture-node-pulse: rgb(54 191 200 / 0.12);
  top: 62%;
  left: 51%;
  border-color: var(--site-green);
  animation-delay: -2.4s;
}

@keyframes projects-texture-flow {
  0% {
    opacity: 0;
    transform: translateX(-42px);
  }

  14%,
  84% {
    opacity: 0.95;
  }

  100% {
    opacity: 0;
    transform: translateX(calc(100% + 42px));
  }
}

@keyframes projects-texture-scan {
  0%,
  12% {
    left: 18%;
    opacity: 0;
  }

  28%,
  72% {
    opacity: 0.24;
  }

  88%,
  100% {
    left: 84%;
    opacity: 0;
  }
}

@keyframes projects-texture-node-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }

  48% {
    box-shadow: 0 0 0 3px var(--projects-texture-node-pulse);
    transform: scale(1.06);
  }

  62% {
    box-shadow: 0 0 0 0 transparent;
    transform: scale(1);
  }
}

.projects-header h1 {
  max-width: 660px;
  margin: 0;
  color: var(--site-ink);
  font-size: clamp(42px, 5.5vw, 70px);
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 1;
}

.projects-header h1 em {
  color: var(--site-accent);
  font-style: normal;
}

.projects-intro {
  max-width: 500px;
  margin: 20px 0 0;
  color: var(--site-muted);
  font-size: 15px;
  line-height: 1.8;
}

.projects-breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 750;
  line-height: 1.4;
}

.projects-breadcrumb a {
  color: var(--site-accent);
}

.projects-breadcrumb span {
  color: var(--site-muted);
}

.projects-breadcrumb span[aria-current='page'] {
  color: var(--site-ink);
}

.projects-breadcrumb a:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 4px;
}

.projects-breadcrumb a:hover,
.projects-breadcrumb a:focus-visible {
  color: var(--site-accent);
}

.project-section-title {
  margin: 0;
  color: var(--site-ink);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.project-section-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 40px;
}

.project-section + .project-section {
  margin-top: 40px;
}

.project-grid {
  display: grid;
  gap: 16px;
  padding-top: 16px;
}

.project-card {
  display: grid;
  grid-template-columns: minmax(250px, 0.78fr) minmax(0, 1.22fr);
  min-height: 240px;
  border: 1px solid var(--site-line);
  border-left: 5px solid var(--site-accent);
  border-radius: 8px;
  background: var(--site-surface);
  color: var(--site-ink);
  overflow: hidden;
}

.project-card-token {
  border-left-color: var(--site-pink);
}

.project-sidebar {
  display: grid;
  grid-template-rows: 96px minmax(0, 1fr);
  height: 240px;
  min-width: 0;
  border-right: 1px solid var(--site-line);
}

.project-info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  height: 96px;
  min-width: 0;
  padding: 20px 22px;
}

.project-actions {
  min-width: 0;
  padding: 14px 22px;
}

.project-content {
  min-width: 0;
  padding: 22px 27px;
}

.project-actions {
  display: grid;
  align-content: start;
  gap: 6px;
  border-top: 1px solid var(--site-line);
}

.common-token-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.common-token-group .primary-button {
  white-space: nowrap;
}

.project-identity {
  display: flex;
  align-items: flex-start;
  flex: 1;
  gap: 15px;
  min-width: 0;
}

.project-visit-button {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  min-height: 30px;
  padding: 6px 9px;
  border: 1px solid var(--site-line);
  border-radius: 4px;
  background: var(--site-paper);
  color: var(--site-ink);
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.project-visit-button:hover {
  border-color: var(--site-accent);
  color: var(--site-accent);
}

.project-visit-button:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 4px;
}

/* 过期筛选：默认勾选「仅显示未过期」 */
.token-filter {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  color: var(--site-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
  user-select: none;
}

.token-filter input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--site-accent);
  cursor: pointer;
}

.project-icon {
  display: grid;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  place-items: center;
  overflow: hidden;
  border-radius: 14px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.project-icon-image {
  display: block;
  width: 56px;
  height: 56px;
  object-fit: cover;
}

.project-card-token .project-icon {
  background: #ffe7ef;
  color: #dd5d8c;
}

.project-identity-copy {
  flex: 1;
  min-width: 0;
  container-type: inline-size;
}

.project-identity p {
  margin: 0 0 5px;
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.project-identity h2 {
  overflow: hidden;
  margin: 0;
  color: var(--site-ink);
  font-size: clamp(12px, calc(100cqw / var(--project-name-length)), 22px);
  font-weight: 750;
  line-height: 1.2;
  text-overflow: clip;
  white-space: nowrap;
}

.project-identity-subtitle {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgb(234 247 247 / 0.4);
}

.content-list {
  display: grid;
}

.content-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 48px;
  padding: 10px 0;
  border-bottom: 1px solid rgb(169 221 226 / 0.72);
}

.content-item:last-child {
  border-bottom: 0;
}

.content-item > span {
  min-width: 0;
  color: var(--site-ink);
  font-size: 12px;
  font-weight: 700;
}

.content-item-icon {
  flex-shrink: 0;
  color: var(--site-accent);
}

.content-item-token .content-item-icon {
  color: #dd5d8c;
}

/* 过期令牌：整行降饱和，与仍有效的令牌区分 */
.content-item-expired {
  opacity: 0.62;
}

.content-item-expired .content-item-icon,
.content-item-expired .content-item-copy > span,
.content-item-expired .content-item-copy code {
  color: var(--site-muted);
}

.content-item-main {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
  min-width: 0;
}

.content-item-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.content-item-name {
  overflow: hidden;
  color: var(--site-ink);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-item-meta {
  overflow: hidden;
  color: var(--site-muted);
  font-size: 10px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-item-copy code {
  overflow: hidden;
  color: var(--site-muted);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-item-actions {
  display: flex;
  flex-shrink: 0;
  gap: 5px;
  margin-left: auto;
}

.content-empty {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
  gap: 8px;
  min-height: 100px;
  color: var(--site-muted);
  font-size: 12px;
}

.icon-button-danger {
  color: #d94f5c;
}

.icon-button-danger:hover {
  background: #ffe3e5;
  color: #c73e4b;
}

.primary-button,
.secondary-button,
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 0;
  cursor: pointer;
  font-size: 11px;
  font-weight: 750;
}

.primary-button,
.secondary-button {
  padding: 8px 10px;
}

.primary-button {
  background: var(--site-accent);
  color: var(--site-surface);
}

.secondary-button {
  border: 1px solid var(--site-line);
  background: var(--site-surface);
  color: var(--site-ink);
}

.primary-button:hover,
.secondary-button:hover {
  filter: brightness(0.95);
}

.icon-button {
  width: 30px;
  height: 30px;
  min-height: 30px;
  border-radius: 50%;
  background: var(--site-paper);
  color: var(--site-muted);
}

.icon-button:hover {
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

/* 请求进行中：按钮置灰并禁止重复点击 */
.primary-button:disabled,
.secondary-button:disabled,
.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  filter: none;
}

@media (max-width: 850px) {
  .projects-page {
    width: min(100% - 48px, 620px);
  }

  .projects-header {
    gap: 34px;
    min-height: 0;
    padding: 34px 28px;
  }

  .projects-header-texture {
    width: 100%;
    opacity: 0.6;
  }

  .project-card {
    grid-template-columns: 1fr;
  }

  .project-sidebar {
    grid-template-rows: 96px minmax(0, 1fr);
    border-right: 0;
  }

  .project-content {
    border-top: 1px solid var(--site-line);
  }
}

@media (max-width: 520px) {
  .projects-page {
    width: calc(100% - 32px);
    padding-top: 36px;
  }

  .projects-header h1 {
    font-size: 50px;
  }

  .projects-header-texture {
    opacity: 0.48;
  }

  .project-info,
  .project-content {
    padding: 20px;
  }

  .project-actions {
    padding: 12px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .projects-header-texture::after,
  .projects-texture-route::after,
  .projects-texture-node {
    animation: none;
  }
}
</style>
