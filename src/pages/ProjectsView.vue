<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

/** 游戏项目：只保留与令牌相关的静态配置（名称 + 各档 scope 标识） */
type CommonProject = {
  id: string
  name: string
  /** 各档签发的 scope 标识：读 / 写 */
  scopeCodes: Record<CommonTokenScope, string>
}

/** 一条已签发的 PAT，归到某个游戏账号卡片下（由后端 PAT 列表派生，不在前端伪造） */
type CommonTokenConnection = {
  /** PAT 记录主键，撤销按它定位 */
  id: number
  scope: CommonTokenScope
  /** 令牌明文（后端全链路明文，列表可回看） */
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

/** 一张子账号卡片：一个游戏账号 + 它名下的读 / 写令牌 */
type CommonAccount = {
  /** 稳定键：项目 + 账号标识 */
  id: string
  project: CommonProject
  icon: string
  title: string
  subtitle: string
  /** PAT payload 绑定的游戏账号 UID，用来把后端令牌认领回卡片 */
  gameUid: string
  /** 终末地服务器 ID，与角色 UID 一起定位账号 */
  serverId?: string
  /** 账号来源：skland 自动导入 / manual 手动上传 */
  source: 'skland' | 'manual'
  tokenConnections: CommonTokenConnection[]
}

/** 通用数据的授权粒度只有读、写两档 */
const commonTokenScopes: CommonTokenScope[] = ['read', 'write']

const commonTokenMeta: Record<CommonTokenScope, { label: string; buttonLabel: string }> = {
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

/** 两个游戏项目的静态配置：令牌按 payload 绑到具体账号，这里只保留名称与 scope 映射 */
const commonDataProjects: CommonProject[] = [
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
]

/** 当前展开明文的令牌：按记录 id 定位，避免同一档多条记录（含过期）互相影响 */
const visibleTokenId = ref<number | null>(null)
const isLoggedIn = ref(Boolean(getTclToken()))
const tokensLoading = ref(false)
const accountsLoading = ref(false)
/** 仅显示未过期令牌，默认开启；关闭后连过期记录一起展示 */
const onlyUnexpired = ref(true)
/** 正在签发的档位标识（账号键-档位），用于按钮禁用与防重复提交 */
const signingKey = ref<string | null>(null)
/** 正在吊销的档位标识 */
const revokingKey = ref<string | null>(null)

/** 后端 PAT 原始列表：卡片上的令牌全部由它派生，不在前端伪造 */
const pats = ref<PatVO[]>([])
/** 账号本身（不含令牌），由两个游戏账号接口拉取 */
const accountBases = ref<CommonAccount[]>([])

/**
 * 账号卡片 = 账号 + 按游戏、payload.game_uid 与终末地 server_id 认领到的令牌
 *
 * 新接口下令牌绑定具体游戏账号，所以列表要按 payload 反查归属；无法匹配到具体账号的
 * 记录不展示，也不再保留旧 Token 兼容卡片。
 */
const accountCards = computed<CommonAccount[]>(() => {
  const cards = accountBases.value.map((account) => ({
    ...account,
    tokenConnections: [] as CommonTokenConnection[],
  }))
  const owned = new Map<string, PatVO[]>()

  for (const pat of pats.value) {
    const owner = cards.find((card) => matchesPatAccount(pat, card))
    if (!owner) continue
    const list = owned.get(owner.id) || []
    list.push(pat)
    owned.set(owner.id, list)
  }

  for (const card of cards) {
    card.tokenConnections = toConnections(card.project, owned.get(card.id) || [])
  }
  return cards
})

/** 推断一条令牌属于哪个游戏项目：优先 payload.game_name，其次按 scope 覆盖关系 */
function inferProject(pat: PatVO): CommonProject | undefined {
  const gameName = (pat.payload?.game_name || '').trim()
  const named = commonDataProjects.find((project) => project.name === gameName)
  if (named) return named
  return commonDataProjects.find(
    (project) =>
      coversScope(pat.scope, project.scopeCodes.read) ||
      coversScope(pat.scope, project.scopeCodes.write),
  )
}

/** 同角色不同服务器、不同游戏的相同 UID 均不能混用令牌。 */
function matchesPatAccount(pat: PatVO, account: CommonAccount): boolean {
  const gameUid = (pat.payload?.game_uid || '').trim()
  if (!gameUid || gameUid !== account.gameUid.trim()) return false
  if (inferProject(pat)?.id !== account.project.id) return false
  return (
    account.project.id !== 'endfield' ||
    (pat.payload?.server_id || '').trim() === (account.serverId || '').trim()
  )
}

/** 把同一账号名下的令牌摊平成读 / 写两档（一条令牌只挂一档，避免重复展示） */
function toConnections(project: CommonProject, records: PatVO[]): CommonTokenConnection[] {
  const connections: CommonTokenConnection[] = []
  const seen = new Set<number>()
  for (const scope of commonTokenScopes) {
    const scopeCode = project.scopeCodes[scope]
    const matched = records.filter(
      (record) => !seen.has(record.id) && coversScope(record.scope, scopeCode),
    )
    const ordered = [
      ...matched.filter((record) => record.expiresInSeconds > 0),
      ...matched.filter((record) => record.expiresInSeconds <= 0),
    ]
    for (const record of ordered) {
      seen.add(record.id)
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
  return connections
}

/** 档位唯一键 */
function tokenKey(account: CommonAccount, scope: CommonTokenScope): string {
  return `${account.id}-${scope}`
}

/** 取某档当前仍有效的令牌（已过期的视为没有，可重新生成） */
function findActiveConnection(
  account: CommonAccount,
  scope: CommonTokenScope,
): CommonTokenConnection | undefined {
  return account.tokenConnections.find(
    (connection) => connection.scope === scope && connection.expiresInSeconds > 0,
  )
}

/** 某档是否已有仍有效的令牌 */
function hasCommonToken(account: CommonAccount, scope: CommonTokenScope): boolean {
  return Boolean(findActiveConnection(account, scope))
}

/** 按筛选条件返回要展示的令牌列表（默认只显示未过期的） */
function visibleConnections(account: CommonAccount): CommonTokenConnection[] {
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
  const parent = scopeCode.replace(/^(arknights|endfield)-data\.(read|write)$/, 'gama-data.$2')
  return codes.includes(scopeCode) || codes.includes(parent) || codes.includes('all')
}

/**
 * 组装账号卡片（不含令牌）：令牌由 PAT 列表反查，这里只负责「有哪些账号」
 *
 * 手动上传的数据没有游戏账号，后端以用户中心 UID 作为 akUid；PAT 的 payload 也按这个
 * 口径写入 `game_uid`，否则读不到手动版数据。
 */
function buildAccounts(akAccounts: AkAccountVO[], efAccounts: EfAccount[]): CommonAccount[] {
  const arknightsProject = commonDataProjects.find((project) => project.id === 'arknights')
  const endfieldProject = commonDataProjects.find((project) => project.id === 'endfield')
  if (!arknightsProject || !endfieldProject) return []
  const tclUid = getTclUid()

  return [
    ...akAccounts.map((account) => {
      const source: CommonAccount['source'] = account.source === 'manual' ? 'manual' : 'skland'
      return {
        id: `arknights:${source}:${account.akUid}`,
        project: arknightsProject,
        icon: arknightsIcon,
        // 卡片主标题只放 UID，来源信息交给副标题，避免拼出 SKD_AK-xxx 这种难认的标识
        title: account.akUid,
        subtitle: source === 'manual' ? '手动数据维护' : '森空岛数据同步',
        gameUid: source === 'manual' ? tclUid : account.akUid,
        source,
        tokenConnections: [],
      }
    }),
    ...efAccounts.map((account) => ({
      id: `endfield:${account.serverId}:${account.roleId}`,
      project: endfieldProject,
      icon: endfieldIcon,
      title: account.roleId,
      subtitle: `服务器 ${account.serverId || '默认'}`,
      gameUid: account.roleId,
      serverId: account.serverId,
      source: 'skland' as const,
      tokenConnections: [],
    })),
  ]
}

async function loadAccounts(): Promise<void> {
  if (!isLoggedIn.value) return
  accountsLoading.value = true
  try {
    const [akResponse, efAccounts] = await Promise.all([listAkAccounts(), listEfAccounts()])
    accountBases.value = buildAccounts(akResponse.data || [], efAccounts)
  } catch (error) {
    const tclError = error as { code?: number } | null
    if (tclError && (tclError.code === 80001 || tclError.code === 80002)) {
      isLoggedIn.value = false
    }
  } finally {
    accountsLoading.value = false
  }
}

/** 拉取我的 PAT 列表，卡片上的令牌由 computed 按 payload 归位 */
async function loadPats(): Promise<void> {
  if (!isLoggedIn.value) return
  tokensLoading.value = true
  try {
    const response = await listPats()
    pats.value = response.data || []
  } catch (error) {
    const tclError = error as { code?: number } | null
    if (tclError && (tclError.code === 80001 || tclError.code === 80002)) {
      isLoggedIn.value = false
      createMessage({ text: '登录已失效，请重新登录', type: 'warning' })
    }
  } finally {
    tokensLoading.value = false
  }
}

/** 令牌名称要能区分账号，且后端限制 50 字符 */
function tokenName(account: CommonAccount, scope: CommonTokenScope): string {
  const label = `${account.project.name}-${account.title}-${commonTokenMeta[scope].label}`
  return label.length > 50 ? label.slice(0, 50) : label
}

/** 签发时绑定游戏账号，终末地同时写入服务器 ID，source 仅作为来源信息透传。 */
function buildPayload(account: CommonAccount): PatPayload {
  return {
    game_uid: account.gameUid,
    game_name: account.project.name,
    ...(account.project.id === 'endfield' ? { server_id: account.serverId || '' } : {}),
    source: account.source,
  }
}

/**
 * 签发 PAT（POST /user/pat）
 * 已存在时按「重置」处理：先签新的，成功后再吊销旧的，避免中途失败导致无可用令牌
 */
async function generateCommonToken(account: CommonAccount, scope: CommonTokenScope): Promise<void> {
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
    await loadPats()
    visibleTokenId.value = response.data?.id ?? null
    createMessage({
      text: `${account.title}${commonTokenMeta[scope].label}已${previous ? '重置' : '生成'}`,
      type: 'success',
    })
  } catch {
    // 业务错误（scope 超范围、payload 不合法等）由 tclRequest 统一提示
  } finally {
    signingKey.value = null
  }
}

/** 吊销令牌（POST /user/pat/revoke，按记录 id），立即失效并从列表移除 */
async function revokeCommonToken(
  account: CommonAccount,
  connection: CommonTokenConnection,
): Promise<void> {
  if (revokingKey.value) return
  revokingKey.value = tokenKey(account, connection.scope)
  try {
    await revokePat(connection.id)
    if (visibleTokenId.value === connection.id) {
      visibleTokenId.value = null
    }
    await loadPats()
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
    createMessage({
      text: `通用数据${commonTokenMeta[connection.scope].label}已复制`,
      type: 'success',
    })
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

/** 某档是否正在签发 */
function isSigning(account: CommonAccount, scope: CommonTokenScope): boolean {
  return signingKey.value === tokenKey(account, scope)
}

/** 某档是否正在吊销 */
function isRevoking(account: CommonAccount, scope: CommonTokenScope): boolean {
  return revokingKey.value === tokenKey(account, scope)
}

/** 切换某条令牌明文的显示 / 隐藏 */
function toggleTokenVisibility(connection: CommonTokenConnection): void {
  visibleTokenId.value = isTokenVisible(connection) ? null : connection.id
}

/** 是否展示某条令牌的明文 */
function isTokenVisible(connection: CommonTokenConnection): boolean {
  return visibleTokenId.value === connection.id
}

function projectNameStyle(name: string): Record<string, string> {
  return { '--project-name-length': String(Array.from(name).length) }
}

onMounted(() => {
  void loadAccounts()
  void loadPats()
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
        <RouterLink class="project-visit-button" to="/read-token-test"> 测试读取 Token </RouterLink>
      </div>
      <div class="project-grid" aria-label="子账号连接列表">
        <article
          v-for="account in accountCards"
          :key="account.id"
          class="project-card project-card-token project-card-common"
        >
          <div class="project-sidebar">
            <div class="project-info">
              <div class="project-identity">
                <div class="project-icon">
                  <img
                    class="project-icon-image"
                    :src="account.icon"
                    alt=""
                    width="56"
                    height="56"
                    aria-hidden="true"
                  />
                </div>
                <div class="project-identity-copy" :style="projectNameStyle(account.title)">
                  <p>
                    {{ account.project.name }} · UID
                  </p>
                  <h2>{{ account.title }}</h2>
                  <span class="project-identity-subtitle">{{ account.subtitle }}</span>
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
                  v-show="!hasCommonToken(account, scope)"
                  :key="scope"
                  class="primary-button"
                  type="button"
                  :disabled="isSigning(account, scope)"
                  @click="generateCommonToken(account, scope)"
                >
                  <v-icon icon="mdi-key-plus" size="16"></v-icon>
                  {{ isSigning(account, scope) ? '签发中…' : commonTokenMeta[scope].buttonLabel }}
                </button>
              </div>
            </div>
          </div>

          <div class="project-content">
            <div v-if="tokensLoading || accountsLoading" class="content-empty">
              <span>正在加载…</span>
            </div>
            <div v-else-if="!isLoggedIn" class="content-empty">
              <span>登录后可查看与管理 Token</span>
            </div>
            <div v-else-if="!visibleConnections(account).length" class="content-empty">
              <span v-if="account.tokenConnections.length">
                暂无未过期的 Token（已隐藏过期记录）
              </span>
              <span v-else>暂无已生成的 Token</span>
            </div>
            <div v-else class="content-list">
              <div
                v-for="connection in visibleConnections(account)"
                :key="connection.id"
                class="content-item content-item-token"
                :class="{ 'content-item-expired': connection.expiresInSeconds <= 0 }"
              >
                <div class="content-item-main">
                  <v-icon
                    class="content-item-icon"
                    :icon="
                      connection.expiresInSeconds > 0 ? 'mdi-key-chain-variant' : 'mdi-key-outline'
                    "
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
                      {{
                        isTokenVisible(connection)
                          ? connection.token
                          : maskedCommonToken(connection)
                      }}
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
                    :disabled="isSigning(account, connection.scope)"
                    @click="generateCommonToken(account, connection.scope)"
                  >
                    <v-icon icon="mdi-autorenew" size="16"></v-icon>
                  </button>
                  <button
                    class="icon-button icon-button-danger"
                    type="button"
                    aria-label="撤销 Token"
                    title="撤销 Token"
                    :disabled="isRevoking(account, connection.scope)"
                    @click="revokeCommonToken(account, connection)"
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
