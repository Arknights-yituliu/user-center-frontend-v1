<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  projects,
  type Project,
  type ProjectConnectionMode,
  type ProjectConnectionStatus,
} from '../data/projects'
import SecondaryPageHeader from '../components/SecondaryPageHeader.vue'
import { createMessage } from '../utils/message'

type MockProject = Project

const mockProjects = reactive<MockProject[]>(
  projects.map((project) => ({
    ...project,
    connection: {
      ...project.connection,
      dataItems: [...project.connection.dataItems],
      permissionItems: [...project.connection.permissionItems],
    },
  })),
)

const visibleTokenSlug = ref<string | null>(null)

const modeMeta: Record<ProjectConnectionMode, { label: string; icon: string; tone: string }> = {
  oauth: {
    label: 'OAuth 授权',
    icon: 'mdi-shield-key-outline',
    tone: 'oauth',
  },
  token: {
    label: '工具专属 Token',
    icon: 'mdi-key-chain-variant',
    tone: 'token',
  },
  'browser-cache': {
    label: '浏览器缓存同步',
    icon: 'mdi-cached',
    tone: 'cache',
  },
}

type DemoConnection = {
  id: string
  mode: ProjectConnectionMode
  dataItems: string[]
  status: ProjectConnectionStatus
  token?: string
}

type CommonTokenGroup = 'operator' | 'repository' | 'gacha'
type CommonTokenScope =
  | 'operator-read'
  | 'operator-write'
  | 'repository-read'
  | 'repository-write'
  | 'gacha-read'
  | 'gacha-write'

type CommonTokenConnection = {
  id: string
  scope: CommonTokenScope
  token: string
}

type CommonDataProject = {
  id: string
  name: string
  tokenConnections: CommonTokenConnection[]
}

const commonTokenGroups: Array<{ id: CommonTokenGroup; scopes: CommonTokenScope[] }> = [
  {
    id: 'operator',
    scopes: ['operator-read', 'operator-write'],
  },
  {
    id: 'repository',
    scopes: ['repository-read', 'repository-write'],
  },
  {
    id: 'gacha',
    scopes: ['gacha-read', 'gacha-write'],
  },
]

const commonTokenMeta: Record<
  CommonTokenScope,
  { label: string; buttonLabel: string }
> = {
  'operator-read': {
    label: '干员读token',
    buttonLabel: '生成干员读token',
  },
  'operator-write': {
    label: '干员写token',
    buttonLabel: '生成干员写token',
  },
  'repository-read': {
    label: '仓库读token',
    buttonLabel: '生成仓库读token',
  },
  'repository-write': {
    label: '仓库写token',
    buttonLabel: '生成仓库写token',
  },
  'gacha-read': {
    label: '抽卡读token',
    buttonLabel: '生成抽卡读token',
  },
  'gacha-write': {
    label: '抽卡写token',
    buttonLabel: '生成抽卡写token',
  },
}

const demoOauthConnection = reactive<DemoConnection>({
  id: 'demo-oauth',
  mode: 'oauth',
  dataItems: ['蓝图等用户存储数据'],
  status: 'authorized',
})

const demoTokenConnection = reactive<DemoConnection>({
  id: 'demo-token',
  mode: 'token',
  dataItems: ['仓库数据', '干员数据'],
  status: 'revoked',
})

const demoCacheConnection = reactive<DemoConnection>({
  id: 'demo-cache',
  mode: 'browser-cache',
  dataItems: ['浏览器缓存数据'],
  status: 'synced',
})

const demoConnections = reactive<DemoConnection[]>([demoOauthConnection])
const visibleDemoToken = ref(false)

const commonDataProjects = reactive<CommonDataProject[]>([
  {
    id: 'arknights',
    name: '明日方舟',
    tokenConnections: [],
  },
  {
    id: 'endfield',
    name: '明日方舟：终末地',
    tokenConnections: [],
  },
])

const visibleCommonToken = ref<{ projectId: string; scope: CommonTokenScope } | null>(null)

function hasDemoConnection(connection: DemoConnection): boolean {
  return demoConnections.some((item) => item.id === connection.id)
}

function addDemoConnection(connection: DemoConnection): void {
  if (!hasDemoConnection(connection)) {
    demoConnections.push(connection)
  }
}

function removeDemoConnection(connection: DemoConnection): void {
  const index = demoConnections.findIndex((item) => item.id === connection.id)
  if (index >= 0) demoConnections.splice(index, 1)
}

function authorizeDemo(): void {
  demoOauthConnection.status = 'authorized'
  addDemoConnection(demoOauthConnection)
  createMessage({ text: '示例授权已添加', type: 'success' })
}

function generateDemoToken(): void {
  const hasToken = Boolean(demoTokenConnection.token)
  demoTokenConnection.token = `slc_demo_${Math.random().toString(36).slice(2, 14)}`
  demoTokenConnection.status = 'token-ready'
  addDemoConnection(demoTokenConnection)
  visibleDemoToken.value = true
  createMessage({ text: hasToken ? '示例 Token 已重置' : '示例 Token 已生成', type: 'success' })
}

function addDemoCacheSync(): void {
  addDemoConnection(demoCacheConnection)
  createMessage({ text: '示例缓存同步已添加', type: 'success' })
}

function removeDemoCacheSync(): void {
  removeDemoConnection(demoCacheConnection)
}

function revokeDemoOauth(): void {
  demoOauthConnection.status = 'revoked'
  removeDemoConnection(demoOauthConnection)
  createMessage({ text: '示例授权已撤销', type: 'success' })
}

function revokeDemoToken(): void {
  demoTokenConnection.token = undefined
  demoTokenConnection.status = 'revoked'
  removeDemoConnection(demoTokenConnection)
  visibleDemoToken.value = false
  createMessage({ text: '示例 Token 已撤销', type: 'success' })
}

async function copyDemoToken(): Promise<void> {
  const token = demoTokenConnection.token
  if (!token) return

  try {
    await navigator.clipboard.writeText(token)
    createMessage({ text: '示例 Token 已复制', type: 'success' })
  } catch {
    createMessage({ text: '复制失败，请手动选中 Token', type: 'warning' })
  }
}

function maskedDemoToken(): string {
  const token = demoTokenConnection.token
  if (!token) return ''
  return `${token.slice(0, 9)}********${token.slice(-4)}`
}

function hasCommonToken(project: CommonDataProject, scope: CommonTokenScope): boolean {
  return project.tokenConnections.some((connection) => connection.scope === scope)
}

function generateCommonToken(project: CommonDataProject, scope: CommonTokenScope): void {
  const existingToken = project.tokenConnections.find((connection) => connection.scope === scope)
  const token = `slc_common_${project.id}_${scope}_${Math.random().toString(36).slice(2, 14)}`

  if (existingToken) {
    existingToken.token = token
  } else {
    project.tokenConnections.push({
      id: `common-token-${project.id}-${scope}`,
      scope,
      token,
    })
  }

  visibleCommonToken.value = { projectId: project.id, scope }
  createMessage({
    text: `${project.name}${commonTokenMeta[scope].label}已${existingToken ? '重置' : '生成'}`,
    type: 'success',
  })
}

function revokeCommonToken(project: CommonDataProject, connection: CommonTokenConnection): void {
  const index = project.tokenConnections.findIndex((item) => item.id === connection.id)
  if (index >= 0) project.tokenConnections.splice(index, 1)
  if (
    visibleCommonToken.value?.projectId === project.id &&
    visibleCommonToken.value.scope === connection.scope
  ) {
    visibleCommonToken.value = null
  }
  createMessage({ text: `${project.name}${commonTokenMeta[connection.scope].label}已撤销`, type: 'success' })
}

async function copyCommonToken(connection: CommonTokenConnection): Promise<void> {
  try {
    await navigator.clipboard.writeText(connection.token)
    createMessage({ text: `通用数据${commonTokenMeta[connection.scope].label}已复制`, type: 'success' })
  } catch {
    createMessage({ text: '复制失败，请手动选中 Token', type: 'warning' })
  }
}

function maskedCommonToken(connection: CommonTokenConnection): string {
  return `${connection.token.slice(0, 9)}********${connection.token.slice(-4)}`
}

function toggleCommonTokenVisibility(project: CommonDataProject, scope: CommonTokenScope): void {
  if (
    visibleCommonToken.value?.projectId === project.id &&
    visibleCommonToken.value.scope === scope
  ) {
    visibleCommonToken.value = null
    return
  }
  visibleCommonToken.value = { projectId: project.id, scope }
}

function updateConnection(
  project: MockProject,
  status: ProjectConnectionStatus,
  statusLabel: string,
  statusHint: string,
): void {
  project.connection.status = status
  project.connection.statusLabel = statusLabel
  project.connection.statusHint = statusHint
}

function generateToken(project: MockProject): void {
  if (project.connection.mode !== 'token') return
  project.connection.token = `slc_demo_${Math.random().toString(36).slice(2, 14)}`
  updateConnection(project, 'token-ready', 'Token 已生成', '等待工具调用')
  visibleTokenSlug.value = project.slug
  createMessage({ text: '示例 Token 已生成', type: 'success' })
}

function authorizeProject(project: MockProject): void {
  if (project.connection.mode !== 'oauth') return
  updateConnection(project, 'authorized', '已授权', '最近访问：刚刚')
  createMessage({ text: '示例授权已添加', type: 'success' })
}

function addBrowserCacheSync(project: MockProject): void {
  if (project.connection.mode !== 'browser-cache') return
  updateConnection(project, 'synced', '已同步', '最近同步：刚刚')
  createMessage({ text: '示例缓存同步已添加', type: 'success' })
}

function revokeProjectOauth(project: MockProject): void {
  if (project.connection.mode !== 'oauth') return
  updateConnection(project, 'revoked', '未授权', '等待工具重新发起授权')
  createMessage({ text: '示例授权已撤销', type: 'success' })
}

function resetToken(project: MockProject): void {
  if (project.connection.mode !== 'token') return
  project.connection.token = `slc_demo_${Math.random().toString(36).slice(2, 14)}`
  updateConnection(project, 'token-ready', 'Token 已重置', '等待工具调用')
  visibleTokenSlug.value = project.slug
  createMessage({ text: '示例 Token 已重置', type: 'success' })
}

function revokeToken(project: MockProject): void {
  if (project.connection.mode !== 'token') return
  project.connection.token = undefined
  updateConnection(project, 'revoked', 'Token 已撤销', '需要重新生成 Token')
  visibleTokenSlug.value = null
  createMessage({ text: '示例 Token 已撤销', type: 'success' })
}

function removeBrowserCacheSync(project: MockProject): void {
  if (project.connection.mode !== 'browser-cache') return
  updateConnection(project, 'not-synced', '未同步', '等待工具发起同步')
}

async function copyToken(project: MockProject): Promise<void> {
  const token = project.connection.token
  if (!token) return

  try {
    await navigator.clipboard.writeText(token)
    createMessage({ text: 'Token 已复制', type: 'success' })
  } catch {
    createMessage({ text: '复制失败，请手动选中 Token', type: 'warning' })
  }
}

function maskedToken(project: MockProject): string {
  const token = project.connection.token
  if (!token) return ''
  return `${token.slice(0, 9)}********${token.slice(-4)}`
}

function projectNameStyle(name: string): Record<string, string> {
  return { '--project-name-length': String(Array.from(name).length) }
}

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
        <RouterLink class="project-visit-button" to="/common-data">
          通用数据维护
          <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
        </RouterLink>
      </div>
      <div class="project-grid" aria-label="通用数据连接列表">
        <article
          v-for="commonProject in commonDataProjects"
          :key="commonProject.id"
          class="project-card project-card-token project-card-common"
        >
        <div class="project-sidebar">
          <div class="project-info">
            <div class="project-identity">
              <div class="project-icon">
                <v-icon icon="mdi-key-chain-variant" size="27"></v-icon>
              </div>
              <div class="project-identity-copy" :style="projectNameStyle(commonProject.name)">
                <p>干员/仓库/抽卡数据</p>
                <h2>{{ commonProject.name }}</h2>
              </div>
            </div>
          </div>

          <div class="project-actions">
            <template v-for="group in commonTokenGroups" :key="group.id">
              <div class="common-token-group">
                <template v-for="scope in group.scopes" :key="scope">
                  <button
                    v-if="!hasCommonToken(commonProject, scope)"
                    class="primary-button"
                    type="button"
                    @click="generateCommonToken(commonProject, scope)"
                  >
                    <v-icon icon="mdi-key-plus" size="16"></v-icon>
                    {{ commonTokenMeta[scope].buttonLabel }}
                  </button>
                </template>
              </div>
            </template>
          </div>
        </div>

        <div class="project-content">
          <div v-if="!commonProject.tokenConnections.length" class="content-empty">
            <span>暂无已同步的内容</span>
          </div>
          <div v-else class="content-list">
            <div
              v-for="connection in commonProject.tokenConnections"
              :key="connection.id"
              class="content-item content-item-token"
            >
              <div class="content-item-main">
                <v-icon class="content-item-icon" icon="mdi-key-chain-variant" size="18"></v-icon>
                <div class="content-item-copy">
                  <span>{{ commonTokenMeta[connection.scope].label }}</span>
                  <code>
                    {{
                      visibleCommonToken?.projectId === commonProject.id &&
                      visibleCommonToken.scope === connection.scope
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
                  :aria-label="
                    visibleCommonToken?.projectId === commonProject.id &&
                    visibleCommonToken.scope === connection.scope
                      ? '隐藏 Token'
                      : '显示 Token'
                  "
                  :title="
                    visibleCommonToken?.projectId === commonProject.id &&
                    visibleCommonToken.scope === connection.scope
                      ? '隐藏 Token'
                      : '显示 Token'
                  "
                  @click="toggleCommonTokenVisibility(commonProject, connection.scope)"
                >
                  <v-icon
                    :icon="
                      visibleCommonToken?.projectId === commonProject.id &&
                      visibleCommonToken.scope === connection.scope
                        ? 'mdi-eye-off-outline'
                        : 'mdi-eye-outline'
                    "
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
                  class="icon-button"
                  type="button"
                  aria-label="重置 Token"
                  title="重置 Token"
                  @click="generateCommonToken(commonProject, connection.scope)"
                >
                  <v-icon icon="mdi-autorenew" size="16"></v-icon>
                </button>
                <button
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="撤销 Token"
                  title="撤销 Token"
                  @click="revokeCommonToken(commonProject, connection)"
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

    <section
      class="project-section project-section-dedicated"
      aria-labelledby="dedicated-data-management-title"
    >
      <h2 id="dedicated-data-management-title" class="project-section-title">专属数据管理</h2>
      <div class="project-grid" aria-label="专属数据连接列表">
        <article class="project-card project-card-demo">
        <div class="project-sidebar">
          <div class="project-info">
            <div class="project-identity">
              <div class="project-icon">
                <v-icon icon="mdi-view-dashboard-outline" size="27"></v-icon>
              </div>
            <div class="project-identity-copy" :style="projectNameStyle('演示用项目')">
              <p>授权方式演示</p>
              <h2>演示用项目</h2>
              </div>
            </div>
            <button class="project-visit-button" type="button">
              访问项目
              <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
            </button>
          </div>

          <div class="project-actions">
            <div v-if="demoOauthConnection.status === 'revoked'" class="project-action-row">
              <button class="secondary-button" type="button" @click="authorizeDemo">
                <v-icon icon="mdi-shield-key-outline" size="16"></v-icon>
                添加 OAuth 授权
              </button>
              <span class="project-action-description">通过 OAuth 授权工具访问数据</span>
            </div>
            <div v-if="!demoTokenConnection.token" class="project-action-row">
              <button class="primary-button" type="button" @click="generateDemoToken">
                <v-icon icon="mdi-key-plus" size="16"></v-icon>
                生成 Token
              </button>
              <span class="project-action-description">生成供工具访问数据的专属 Token</span>
            </div>
            <div v-if="!hasDemoConnection(demoCacheConnection)" class="project-action-row">
              <button class="secondary-button" type="button" @click="addDemoCacheSync">
                <v-icon icon="mdi-sync-outline" size="16"></v-icon>
                添加浏览器缓存同步
              </button>
              <span class="project-action-description">允许工具同步浏览器缓存数据</span>
            </div>
          </div>
        </div>

        <div class="project-content demo-project-content">
          <div v-if="!demoConnections.length" class="content-empty">
            <span>暂无已同步的内容</span>
          </div>
          <div v-else class="content-list">
            <div
              v-for="connection in demoConnections"
              :key="connection.id"
              class="content-item demo-content-item"
              :class="`demo-content-item-${modeMeta[connection.mode].tone}`"
            >
              <v-icon
                class="content-item-icon"
                :icon="modeMeta[connection.mode].icon"
                size="18"
              ></v-icon>
              <div class="content-item-main">
                <div class="content-item-copy demo-connection-copy">
                  <div class="demo-connection-line">
                    <span>{{ modeMeta[connection.mode].label }}</span>
                    <span class="demo-connection-divider" aria-hidden="true">·</span>
                    <span>
                      {{
                        connection.mode === 'token'
                          ? visibleDemoToken
                            ? connection.token
                            : maskedDemoToken()
                          : connection.dataItems.join('、')
                      }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="content-item-actions">
                <button
                  v-if="connection.mode === 'oauth' && connection.status !== 'revoked'"
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="撤销 OAuth 授权"
                  title="撤销 OAuth 授权"
                  @click="revokeDemoOauth"
                >
                  <v-icon icon="mdi-link-off" size="16"></v-icon>
                </button>
                <template v-if="connection.mode === 'token' && connection.token">
                  <button
                    class="icon-button"
                    type="button"
                    :aria-label="visibleDemoToken ? '隐藏 Token' : '显示 Token'"
                    :title="visibleDemoToken ? '隐藏 Token' : '显示 Token'"
                    @click="visibleDemoToken = !visibleDemoToken"
                  >
                    <v-icon :icon="visibleDemoToken ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="16"></v-icon>
                  </button>
                  <button
                    class="icon-button"
                    type="button"
                    aria-label="复制 Token"
                    title="复制 Token"
                    @click="copyDemoToken"
                  >
                    <v-icon icon="mdi-content-copy" size="16"></v-icon>
                  </button>
                  <button
                    class="icon-button"
                    type="button"
                    aria-label="重置 Token"
                    title="重置 Token"
                    @click="generateDemoToken"
                  >
                    <v-icon icon="mdi-autorenew" size="16"></v-icon>
                  </button>
                  <button
                    class="icon-button icon-button-danger"
                    type="button"
                    aria-label="撤销 Token"
                    title="撤销 Token"
                    @click="revokeDemoToken"
                  >
                    <v-icon icon="mdi-key-remove" size="16"></v-icon>
                  </button>
                </template>
                <button
                  v-if="connection.mode === 'browser-cache'"
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="移除同步"
                  title="移除同步"
                  @click="removeDemoCacheSync"
                >
                  <v-icon icon="mdi-link-off" size="16"></v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
        </article>

        <article
          v-for="project in mockProjects"
          :key="project.slug"
          class="project-card"
          :class="`project-card-${modeMeta[project.connection.mode].tone}`"
        >
        <div class="project-sidebar">
          <div class="project-info">
            <div class="project-identity">
              <div class="project-icon">
                <v-icon :icon="project.icon" size="27"></v-icon>
              </div>
              <div class="project-identity-copy" :style="projectNameStyle(project.name)">
                <p>{{ project.category }}</p>
                <h2>{{ project.name }}</h2>
              </div>
            </div>
            <button class="project-visit-button" type="button">
              访问项目
              <v-icon icon="mdi-arrow-top-right" size="16"></v-icon>
            </button>
          </div>

          <div class="project-actions">
            <div
              v-if="project.connection.mode === 'oauth' && project.connection.status === 'revoked'"
              class="project-action-row"
            >
              <button class="secondary-button" type="button" @click="authorizeProject(project)">
                <v-icon icon="mdi-shield-key-outline" size="16"></v-icon>
                添加 OAuth 授权
              </button>
              <span class="project-action-description">通过 OAuth 授权工具访问数据</span>
            </div>
            <div v-if="project.connection.mode === 'token' && !project.connection.token" class="project-action-row">
              <button class="primary-button" type="button" @click="generateToken(project)">
                <v-icon icon="mdi-key-plus" size="16"></v-icon>
                生成 Token
              </button>
              <span class="project-action-description">生成供工具访问数据的专属 Token</span>
            </div>
            <div
              v-if="project.connection.mode === 'browser-cache' && project.connection.status === 'not-synced'"
              class="project-action-row"
            >
              <button class="secondary-button" type="button" @click="addBrowserCacheSync(project)">
                <v-icon icon="mdi-sync-outline" size="16"></v-icon>
                添加浏览器缓存同步
              </button>
              <span class="project-action-description">允许工具同步浏览器缓存数据</span>
            </div>
          </div>
        </div>

        <div class="project-content">
          <div
            v-if="project.connection.status === 'not-synced' || project.connection.status === 'revoked'"
            class="content-empty"
          >
            <span>暂无已同步的内容</span>
          </div>
          <div v-else class="content-list">
            <div v-for="item in project.connection.dataItems" :key="item" class="content-item">
              <v-icon class="content-item-icon" icon="mdi-database-outline" size="18"></v-icon>
              <span>{{ item }}</span>
              <div class="content-item-actions">
                <button
                  v-if="project.connection.mode === 'oauth'"
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="撤销 OAuth 授权"
                  title="撤销 OAuth 授权"
                  @click="revokeProjectOauth(project)"
                >
                  <v-icon icon="mdi-link-off" size="16"></v-icon>
                </button>
                <button
                  v-else-if="project.connection.mode === 'browser-cache'"
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="移除同步"
                  title="移除同步"
                  @click="removeBrowserCacheSync(project)"
                >
                  <v-icon icon="mdi-link-off" size="16"></v-icon>
                </button>
              </div>
            </div>

            <div v-if="project.connection.token" class="content-item content-item-token">
              <div class="content-item-main">
                <v-icon class="content-item-icon" icon="mdi-key-chain-variant" size="18"></v-icon>
                <div class="content-item-copy">
                  <span>工具专属 Token</span>
                  <code>{{ visibleTokenSlug === project.slug ? project.connection.token : maskedToken(project) }}</code>
                </div>
              </div>
              <div class="content-item-actions">
                <button
                  class="icon-button"
                  type="button"
                  :aria-label="visibleTokenSlug === project.slug ? '隐藏 Token' : '显示 Token'"
                  :title="visibleTokenSlug === project.slug ? '隐藏 Token' : '显示 Token'"
                  @click="visibleTokenSlug = visibleTokenSlug === project.slug ? null : project.slug"
                >
                  <v-icon :icon="visibleTokenSlug === project.slug ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="16"></v-icon>
                </button>
                <button class="icon-button" type="button" aria-label="复制 Token" title="复制 Token" @click="copyToken(project)">
                  <v-icon icon="mdi-content-copy" size="16"></v-icon>
                </button>
                <button class="icon-button" type="button" aria-label="重置 Token" title="重置 Token" @click="resetToken(project)">
                  <v-icon icon="mdi-autorenew" size="16"></v-icon>
                </button>
                <button
                  class="icon-button icon-button-danger"
                  type="button"
                  aria-label="撤销 Token"
                  title="撤销 Token"
                  @click="revokeToken(project)"
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

.project-section-dedicated .project-visit-button,
.project-section-dedicated .primary-button,
.project-section-dedicated .secondary-button {
  width: 150px;
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

.project-card-cache {
  border-left-color: var(--site-green);
}

.project-card-demo {
  border-left-color: var(--site-accent);
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

.project-action-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
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

.project-action-description {
  min-width: 0;
  color: var(--site-muted);
  font-size: 11px;
  line-height: 1.45;
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

.project-info > .project-visit-button {
  align-self: center;
}

.project-visit-button:hover {
  border-color: var(--site-accent);
  color: var(--site-accent);
}

.project-visit-button:focus-visible {
  outline: 2px solid var(--site-accent);
  outline-offset: 4px;
}

.project-icon {
  display: grid;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 14px;
  background: var(--site-accent-soft);
  color: var(--site-accent);
}

.project-card-token .project-icon {
  background: #ffe7ef;
  color: #dd5d8c;
}

.project-card-cache .project-icon {
  background: #def6ef;
  color: #1d9e91;
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
  gap: 3px;
}

.content-item-copy > span {
  color: var(--site-ink);
  font-size: 12px;
  font-weight: 700;
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

.demo-content-item {
  align-items: flex-start;
}

.demo-content-item .content-item-icon {
  margin-top: 3px;
}

.demo-content-item-token .content-item-icon {
  color: #dd5d8c;
}

.demo-connection-copy {
  flex: 1;
}

.demo-connection-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}

.demo-connection-line > span:first-child {
  color: var(--site-ink);
  font-size: 12px;
  font-weight: 700;
}

.demo-connection-divider {
  color: var(--site-muted);
  font-size: 12px;
}

.demo-connection-line > span:last-child {
  overflow: hidden;
  color: var(--site-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
