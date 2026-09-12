<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUcToken } from '../../api/uc/uc-api'
import {
  deleteOAuthClient,
  listOAuthClients,
  registerOAuthClient,
  rotateOAuthClientSecret,
  setOAuthClientStatus,
  updateOAuthClient,
  type OAuthClientAuthMethod,
  type OAuthClientVO,
  type OAuthGrantType,
  type RegisterClientParams,
  type UpdateClientParams,
} from '../../api/uc/oauth-client-api'
import { createMessage } from '../../utils/message'

interface ClientFormFields {
  clientName: string
  redirectUris: string
  scopes: string
  websiteOrigin: string
  accessTokenTtl: string
  refreshTokenTtl: string
}

interface CreateClientForm extends ClientFormFields {
  authMethod: OAuthClientAuthMethod
  issueRefreshToken: boolean
}

type ParseResult = { ok: true; payload: UpdateClientParams } | { ok: false; message: string }

interface CredentialResult {
  title: string
  clientId: string
  clientSecret: string | null
  authMethod: OAuthClientAuthMethod
  awaitingApproval: boolean
}

const router = useRouter()
const pageLoading = ref(false)
const clients = ref<OAuthClientVO[]>([])

const createDialog = ref(false)
const editDialog = ref(false)
const credentialDialog = ref(false)
const rotateDialog = ref(false)
const deleteDialog = ref(false)

const editingClient = ref<OAuthClientVO | null>(null)
const rotateTarget = ref<OAuthClientVO | null>(null)
const deleteTarget = ref<OAuthClientVO | null>(null)
const credentialResult = ref<CredentialResult>({
  title: '',
  clientId: '',
  clientSecret: null,
  authMethod: 'none',
  awaitingApproval: false,
})

const createForm = reactive<CreateClientForm>({
  clientName: '',
  authMethod: 'none',
  issueRefreshToken: true,
  redirectUris: '',
  scopes: 'user.read',
  websiteOrigin: '',
  accessTokenTtl: '',
  refreshTokenTtl: '',
})

const editForm = reactive<ClientFormFields>({
  clientName: '',
  redirectUris: '',
  scopes: '',
  websiteOrigin: '',
  accessTokenTtl: '',
  refreshTokenTtl: '',
})

const createLoading = ref(false)
const editLoading = ref(false)
const rotateLoading = ref(false)
const deleteLoading = ref(false)
const statusLoadingId = ref('')

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function validateWebProtocol(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname))
}

/** 按行校验回调地址，并保留每个地址的完整原始字符串。 */
function validateRedirectUris(
  text: string,
): { ok: true; list: string[] } | { ok: false; message: string } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return { ok: false, message: '回调地址不能为空' }
  }
  if (lines.length > 10) {
    return { ok: false, message: '回调地址最多 10 个' }
  }

  for (const value of lines) {
    if (value !== value.trim() || value.includes(',')) {
      return { ok: false, message: `回调地址不能包含首尾空格或英文逗号：${value}` }
    }
    try {
      const url = new URL(value)
      if (
        !validateWebProtocol(url) ||
        url.username ||
        url.password ||
        url.hash ||
        url.port === '0'
      ) {
        return {
          ok: false,
          message: `回调地址必须使用 HTTPS，HTTP 仅允许本机地址，且不能包含用户信息或片段：${value}`,
        }
      }
    } catch {
      return { ok: false, message: `回调地址不是有效的绝对 URI：${value}` }
    }
  }

  return { ok: true, list: lines }
}

function validateScopes(
  text: string,
): { ok: true; list: string[] } | { ok: false; message: string } {
  const list = sanitizeOAuthScopes([...new Set(text.split(/[\s,，]+/).filter(Boolean))])
  if (list.length === 0) {
    return { ok: false, message: '授权范围不能为空' }
  }
  return { ok: true, list }
}

function sanitizeOAuthScopes(scopes: string[]): string[] {
  return scopes.filter((scope) => scope !== 'user.email')
}

function validateWebsiteOrigin(value: string): string | null {
  if (!value) {
    return null
  }
  if (value !== value.trim() || value.length > 255 || value.includes(',')) {
    return '网站 Origin 不能包含首尾空格或英文逗号，且最长 255 个字符'
  }
  try {
    const url = new URL(value)
    const authority = value.slice(value.indexOf('://') + 3)
    if (
      !validateWebProtocol(url) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      authority.search(/[/?#]/) !== -1 ||
      url.port === '0'
    ) {
      return '网站 Origin 只能包含协议、主机和可选端口；HTTP 仅允许本机地址'
    }
  } catch {
    return '网站 Origin 格式不正确'
  }
  return null
}

function parseOptionalTtl(
  value: string,
  minimum: number,
  label: string,
): { ok: true; value?: number } | { ok: false; message: string } {
  if (!value.trim()) {
    return { ok: true }
  }
  const seconds = Number(value)
  if (!Number.isSafeInteger(seconds) || seconds < minimum) {
    return { ok: false, message: `${label}必须是大于等于 ${minimum} 的整数秒数` }
  }
  return { ok: true, value: seconds }
}

function parseCommonFields(form: ClientFormFields, supportsRefreshToken: boolean): ParseResult {
  const clientName = form.clientName.trim()
  if (!clientName) {
    return { ok: false, message: '客户端名称不能为空' }
  }
  if (clientName.length > 128) {
    return { ok: false, message: '客户端名称不能超过 128 个字符' }
  }

  const redirectUris = validateRedirectUris(form.redirectUris)
  if (!redirectUris.ok) {
    return redirectUris
  }
  const scopes = validateScopes(form.scopes)
  if (!scopes.ok) {
    return scopes
  }
  const originMessage = validateWebsiteOrigin(form.websiteOrigin)
  if (originMessage) {
    return { ok: false, message: originMessage }
  }
  const accessTokenTtl = parseOptionalTtl(form.accessTokenTtl, 60, 'Access Token 有效期')
  if (!accessTokenTtl.ok) {
    return accessTokenTtl
  }
  const refreshTokenTtl = supportsRefreshToken
    ? parseOptionalTtl(form.refreshTokenTtl, 300, 'Refresh Token 有效期')
    : { ok: true as const }
  if (!refreshTokenTtl.ok) {
    return refreshTokenTtl
  }

  return {
    ok: true,
    payload: {
      clientName,
      redirectUris: redirectUris.list,
      scopes: scopes.list,
      websiteOrigin: form.websiteOrigin || undefined,
      accessTokenTtl: accessTokenTtl.value,
      refreshTokenTtl: refreshTokenTtl.value,
    },
  }
}

function clientTypeLabel(authMethod: OAuthClientAuthMethod): string {
  return authMethod === 'none' ? '公共客户端' : '加密客户端'
}

function grantTypeLabel(grantType: OAuthGrantType): string {
  return grantType === 'authorization_code' ? 'Authorization Code' : 'Refresh Token'
}

onMounted(async () => {
  if (!getUcToken()) {
    createMessage({ text: '请先登录', type: 'warning' })
    await router.push({ name: 'LOGIN' })
    return
  }
  await loadClients()
})

async function loadClients(): Promise<void> {
  pageLoading.value = true
  try {
    const response = await listOAuthClients()
    clients.value = response.data || []
  } catch (error) {
    const ucError = error as { code?: number } | null
    if (ucError && (ucError.code === 80001 || ucError.code === 80002)) {
      await router.push({ name: 'LOGIN' })
    }
  } finally {
    pageLoading.value = false
  }
}

function openCreateDialog(): void {
  Object.assign(createForm, {
    clientName: '',
    authMethod: 'none',
    issueRefreshToken: true,
    redirectUris: '',
    scopes: 'user.read',
    websiteOrigin: '',
    accessTokenTtl: '',
    refreshTokenTtl: '',
  })
  createDialog.value = true
}

async function submitCreate(): Promise<void> {
  const parsed = parseCommonFields(createForm, createForm.issueRefreshToken)
  if (!parsed.ok) {
    createMessage({ text: parsed.message, type: 'warning' })
    return
  }

  const grantTypes: OAuthGrantType[] = ['authorization_code']
  if (createForm.issueRefreshToken) {
    grantTypes.push('refresh_token')
  }
  const payload: RegisterClientParams = {
    ...parsed.payload,
    authMethod: createForm.authMethod,
    grantTypes,
  }

  createLoading.value = true
  try {
    const response = await registerOAuthClient(payload)
    const data = response.data
    createDialog.value = false
    credentialResult.value = {
      title: '客户端创建成功',
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      authMethod: data.authMethod,
      awaitingApproval: !data.adminApproved,
    }
    credentialDialog.value = true
    await loadClients()
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    createLoading.value = false
  }
}

function openEditDialog(client: OAuthClientVO): void {
  editingClient.value = client
  Object.assign(editForm, {
    clientName: client.clientName,
    redirectUris: client.redirectUris.join('\n'),
    scopes: sanitizeOAuthScopes(client.scopes).join(', '),
    websiteOrigin: client.websiteOrigin || '',
    accessTokenTtl: '',
    refreshTokenTtl: '',
  })
  editDialog.value = true
}

async function submitEdit(): Promise<void> {
  if (!editingClient.value) {
    return
  }
  const supportsRefreshToken = editingClient.value.grantTypes.includes('refresh_token')
  const parsed = parseCommonFields(editForm, supportsRefreshToken)
  if (!parsed.ok) {
    createMessage({ text: parsed.message, type: 'warning' })
    return
  }

  const originChanged =
    (editingClient.value.websiteOrigin || '') !== (parsed.payload.websiteOrigin || '')
  editLoading.value = true
  try {
    await updateOAuthClient(editingClient.value.clientId, parsed.payload)
    editDialog.value = false
    createMessage({
      text: originChanged
        ? '客户端已更新；网站 Origin 已变化，请同步检查服务端 CORS 白名单'
        : '客户端更新成功',
      type: originChanged ? 'warning' : 'success',
    })
    await loadClients()
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    editLoading.value = false
  }
}

function openRotateDialog(client: OAuthClientVO): void {
  if (client.authMethod !== 'client_secret_post') {
    return
  }
  rotateTarget.value = client
  rotateDialog.value = true
}

async function submitRotate(): Promise<void> {
  if (!rotateTarget.value) {
    return
  }
  rotateLoading.value = true
  try {
    const response = await rotateOAuthClientSecret(rotateTarget.value.clientId)
    const data = response.data
    rotateDialog.value = false
    credentialResult.value = {
      title: '密钥轮换成功',
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      authMethod: data.authMethod,
      awaitingApproval: !data.adminApproved,
    }
    credentialDialog.value = true
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    rotateLoading.value = false
  }
}

async function toggleStatus(client: OAuthClientVO): Promise<void> {
  const enable = !client.ownerEnabled
  if (enable && !client.adminApproved) {
    createMessage({
      text: '该客户端仍在等待审批或已被管理员限制，暂时无法启用',
      type: 'warning',
    })
    return
  }

  statusLoadingId.value = client.clientId
  try {
    await setOAuthClientStatus(client.clientId, enable)
    createMessage({ text: enable ? '客户端已启用' : '客户端已停用', type: 'success' })
    await loadClients()
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    statusLoadingId.value = ''
  }
}

function openDeleteDialog(client: OAuthClientVO): void {
  deleteTarget.value = client
  deleteDialog.value = true
}

async function submitDelete(): Promise<void> {
  if (!deleteTarget.value) {
    return
  }
  deleteLoading.value = true
  try {
    await deleteOAuthClient(deleteTarget.value.clientId)
    deleteDialog.value = false
    createMessage({ text: '客户端已删除', type: 'success' })
    await loadClients()
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    deleteLoading.value = false
  }
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    createMessage({ text: `${label}已复制`, type: 'success' })
  } catch {
    createMessage({ text: '复制失败，请手动选中复制', type: 'error' })
  }
}

/** 按客户端认证方式打开对应接入文档，并带入常用参数。 */
function openIntegrationGuide(client: OAuthClientVO): void {
  router.push({
    name: client.authMethod === 'client_secret_post' ? 'OAUTH_SERVER_GUIDE' : 'OAUTH_WEB_GUIDE',
    query: {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri: client.redirectUris[0] || undefined,
      scopes: sanitizeOAuthScopes(client.scopes).join(','),
    },
  })
}
</script>

<template>
  <main class="oauth-clients-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">客户端管理</h1>
        <p class="page-sub">维护接入一图流账号的 OAuth2 客户端</p>
      </div>
      <div class="page-actions">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
          注册客户端
        </v-btn>
      </div>
    </div>

    <div v-if="pageLoading" class="d-flex justify-center my-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <v-card v-else-if="clients.length === 0" rounded="4" elevation="0" border class="empty-card">
      <div class="text-center pa-10">
        <v-icon icon="mdi-api" size="48" color="grey-lighten-1"></v-icon>
        <div class="mt-4 text-medium-emphasis">暂无 OAuth2 客户端</div>
        <v-btn class="mt-4" color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
          注册第一个客户端
        </v-btn>
      </div>
    </v-card>

    <div v-else class="client-list">
      <v-card
        v-for="client in clients"
        :key="client.clientId"
        rounded="4"
        elevation="0"
        border
        class="client-card"
      >
        <v-card-text>
          <div class="client-card-header">
            <div class="client-identity">
              <v-icon icon="mdi-api" color="primary" class="client-icon"></v-icon>
              <div class="identity-copy">
                <div class="client-name-row">
                  <span class="client-name">{{ client.clientName }}</span>
                  <v-chip size="x-small" variant="outlined">
                    {{ clientTypeLabel(client.authMethod) }}
                  </v-chip>
                </div>
                <div class="client-id-row">
                  <span class="font-mono">{{ client.clientId }}</span>
                  <v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    density="compact"
                    size="x-small"
                    aria-label="复制客户端 ID"
                    title="复制客户端 ID"
                    @click="copyText(client.clientId, '客户端 ID')"
                  ></v-btn>
                </div>
              </div>
            </div>

            <div class="status-group">
              <v-chip v-if="!client.adminApproved" color="warning" size="small">
                待审批 / 管理员限制
              </v-chip>
              <v-chip :color="client.ownerEnabled ? 'success' : 'grey'" size="small">
                {{ client.ownerEnabled ? '所有者已启用' : '所有者已停用' }}
              </v-chip>
            </div>
          </div>

          <v-alert
            v-if="!client.adminApproved"
            type="warning"
            variant="tonal"
            density="compact"
            class="approval-alert"
          >
            客户端尚未获准使用，需由平台管理员审核；普通用户不能解除此状态。
          </v-alert>

          <v-divider class="my-3"></v-divider>

          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">授权类型</span>
              <span class="detail-value chip-list">
                <v-chip
                  v-for="grantType in client.grantTypes"
                  :key="grantType"
                  size="x-small"
                  variant="tonal"
                >
                  {{ grantTypeLabel(grantType) }}
                </v-chip>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">授权范围</span>
              <span class="detail-value chip-list">
                <v-chip
                  v-for="scope in sanitizeOAuthScopes(client.scopes)"
                  :key="scope"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                >
                  {{ scope }}
                </v-chip>
              </span>
            </div>
            <div class="detail-row detail-row-wide">
              <span class="detail-label">回调地址</span>
              <span class="detail-value uri-list">
                <span v-for="uri in client.redirectUris" :key="uri" class="font-mono">
                  {{ uri }}
                </span>
              </span>
            </div>
            <div class="detail-row detail-row-wide">
              <span class="detail-label">网站 Origin</span>
              <span class="detail-value font-mono">{{ client.websiteOrigin || '未设置' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">安全策略</span>
              <span class="detail-value">PKCE S256 · 授权确认</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">直连认证</span>
              <span class="detail-value">
                <v-chip
                  v-if="client.directAuthEnabled"
                  size="x-small"
                  color="primary"
                  variant="tonal"
                >
                  已开通
                </v-chip>
                <v-chip v-else size="x-small" variant="tonal">未开通</v-chip>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ client.createTime }}</span>
            </div>
          </div>

          <v-divider class="my-3"></v-divider>

          <div class="client-actions">
            <v-btn
              size="small"
              variant="text"
              color="primary"
              prepend-icon="mdi-connection"
              @click="openIntegrationGuide(client)"
            >
              接入
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="primary"
              prepend-icon="mdi-pencil-outline"
              @click="openEditDialog(client)"
            >
              编辑
            </v-btn>
            <v-btn
              v-if="client.authMethod === 'client_secret_post'"
              size="small"
              variant="text"
              color="warning"
              prepend-icon="mdi-key-change"
              @click="openRotateDialog(client)"
            >
              轮换密钥
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              :color="client.ownerEnabled ? 'default' : 'success'"
              :prepend-icon="
                client.ownerEnabled ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline'
              "
              :disabled="!client.adminApproved && !client.ownerEnabled"
              :loading="statusLoadingId === client.clientId"
              @click="toggleStatus(client)"
            >
              {{ client.ownerEnabled ? '停用' : '启用' }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete-outline"
              @click="openDeleteDialog(client)"
            >
              删除
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="createDialog" max-width="680" scrollable>
      <v-card rounded="4">
        <v-card-title>注册 OAuth2 客户端</v-card-title>
        <v-card-text class="form-content">
          <div class="field-label">客户端类型</div>
          <v-btn-toggle
            v-model="createForm.authMethod"
            mandatory
            divided
            color="primary"
            variant="outlined"
            class="client-type-toggle"
          >
            <v-btn value="none" prepend-icon="mdi-web">公共客户端</v-btn>
            <v-btn value="client_secret_post" prepend-icon="mdi-server-security">
              加密客户端
            </v-btn>
          </v-btn-toggle>
          <div class="field-help">
            {{
              createForm.authMethod === 'none'
                ? '适用于无后端 Web 应用或桌面应用，不生成密钥，必须使用 PKCE S256。'
                : '适用于能安全保存密钥的后端或 BFF，密钥仅在创建时显示一次。'
            }}
          </div>

          <v-text-field
            v-model="createForm.clientName"
            label="客户端名称"
            placeholder="例如：门户网站"
            maxlength="128"
            counter
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-textarea
            v-model="createForm.redirectUris"
            label="回调地址白名单"
            placeholder="每行一个，例如：&#10;https://app.example.com/oauth/callback&#10;http://localhost:5173/oauth/callback"
            hint="1 至 10 个；生产环境使用 HTTPS，本机开发可使用 HTTP"
            persistent-hint
            variant="outlined"
            density="compact"
            rows="3"
          ></v-textarea>
          <v-textarea
            v-model="createForm.scopes"
            label="授权范围"
            placeholder="例如：user.read"
            hint="使用逗号或空格分隔"
            persistent-hint
            variant="outlined"
            density="compact"
            rows="2"
          ></v-textarea>

          <div class="grant-settings">
            <div>
              <div class="field-label">授权类型</div>
              <v-chip size="small" color="primary" variant="tonal">Authorization Code</v-chip>
            </div>
            <v-checkbox
              v-model="createForm.issueRefreshToken"
              label="允许签发 Refresh Token"
              color="primary"
              density="compact"
              hide-details
            ></v-checkbox>
          </div>

          <v-text-field
            v-model="createForm.websiteOrigin"
            label="网站 Origin（可选）"
            placeholder="https://app.example.com"
            hint="仅登记协议、主机和端口；服务端 CORS 白名单仍需单独配置"
            persistent-hint
            variant="outlined"
            density="compact"
          ></v-text-field>

          <div class="ttl-grid">
            <v-text-field
              v-model="createForm.accessTokenTtl"
              type="number"
              min="60"
              step="1"
              label="Access Token 有效期（秒）"
              hint="留空使用服务端默认值，最小 60"
              persistent-hint
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              v-model="createForm.refreshTokenTtl"
              type="number"
              min="300"
              step="1"
              label="Refresh Token 有效期（秒）"
              hint="留空使用服务端默认值，最小 300"
              persistent-hint
              variant="outlined"
              density="compact"
              :disabled="!createForm.issueRefreshToken"
            ></v-text-field>
          </div>

          <v-alert type="info" variant="tonal" density="compact">
            新客户端默认等待管理员审批。PKCE
            和授权确认固定开启，创建后不能修改客户端类型或授权类型。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="createDialog = false">取消</v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            :loading="createLoading"
            @click="submitCreate"
          >
            创建
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editDialog" max-width="680" scrollable>
      <v-card rounded="4">
        <v-card-title>编辑客户端</v-card-title>
        <v-card-text class="form-content">
          <div class="immutable-grid">
            <v-text-field
              :model-value="editingClient?.clientId"
              label="客户端 ID"
              readonly
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              :model-value="editingClient ? clientTypeLabel(editingClient.authMethod) : ''"
              label="客户端类型"
              readonly
              variant="outlined"
              density="compact"
            ></v-text-field>
          </div>
          <v-text-field
            :model-value="editingClient?.grantTypes.map(grantTypeLabel).join(', ')"
            label="授权类型"
            readonly
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-text-field
            v-model="editForm.clientName"
            label="客户端名称"
            maxlength="128"
            counter
            variant="outlined"
            density="compact"
          ></v-text-field>
          <v-textarea
            v-model="editForm.redirectUris"
            label="回调地址白名单"
            hint="每行一个，完整地址将按原样保存并用于精确匹配"
            persistent-hint
            variant="outlined"
            density="compact"
            rows="3"
          ></v-textarea>
          <v-textarea
            v-model="editForm.scopes"
            label="授权范围"
            hint="使用逗号或空格分隔"
            persistent-hint
            variant="outlined"
            density="compact"
            rows="2"
          ></v-textarea>
          <v-text-field
            v-model="editForm.websiteOrigin"
            label="网站 Origin（可选）"
            hint="修改后请同步检查服务端 CORS 白名单"
            persistent-hint
            variant="outlined"
            density="compact"
          ></v-text-field>

          <div class="ttl-grid">
            <v-text-field
              v-model="editForm.accessTokenTtl"
              type="number"
              min="60"
              step="1"
              label="Access Token 有效期（秒）"
              hint="留空改用服务端默认值，最小 60"
              persistent-hint
              variant="outlined"
              density="compact"
            ></v-text-field>
            <v-text-field
              v-model="editForm.refreshTokenTtl"
              type="number"
              min="300"
              step="1"
              label="Refresh Token 有效期（秒）"
              hint="留空改用服务端默认值，最小 300"
              persistent-hint
              variant="outlined"
              density="compact"
              :disabled="!editingClient?.grantTypes.includes('refresh_token')"
            ></v-text-field>
          </div>

          <v-alert type="info" variant="tonal" density="compact">
            保存采用完整覆盖：名称、全部回调地址和全部授权范围会一起提交。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="editDialog = false">取消</v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-content-save-outline"
            :loading="editLoading"
            @click="submitEdit"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="credentialDialog" max-width="520" persistent>
      <v-card rounded="4">
        <v-card-title>{{ credentialResult.title }}</v-card-title>
        <v-card-text>
          <v-text-field
            :model-value="credentialResult.clientId"
            label="Client ID"
            readonly
            variant="outlined"
            density="compact"
          >
            <template #append-inner>
              <v-btn
                icon="mdi-content-copy"
                variant="text"
                density="compact"
                aria-label="复制 Client ID"
                title="复制 Client ID"
                @click="copyText(credentialResult.clientId, 'Client ID')"
              ></v-btn>
            </template>
          </v-text-field>

          <template v-if="credentialResult.clientSecret">
            <v-text-field
              :model-value="credentialResult.clientSecret"
              label="Client Secret"
              readonly
              variant="outlined"
              density="compact"
            >
              <template #append-inner>
                <v-btn
                  icon="mdi-content-copy"
                  variant="text"
                  density="compact"
                  aria-label="复制 Client Secret"
                  title="复制 Client Secret"
                  @click="copyText(credentialResult.clientSecret || '', 'Client Secret')"
                ></v-btn>
              </template>
            </v-text-field>
            <v-alert type="warning" variant="tonal" density="compact">
              密钥明文只显示这一次。关闭前请立即保存；丢失后只能轮换密钥。
            </v-alert>
          </template>
          <v-alert v-else type="info" variant="tonal" density="compact">
            公共客户端不生成 Client Secret。接入时使用 Authorization Code + PKCE S256。
          </v-alert>

          <v-alert
            v-if="credentialResult.awaitingApproval"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            当前处于待审批状态，管理员审核通过后才能发起授权或兑换令牌。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="credentialDialog = false">
            {{ credentialResult.clientSecret ? '我已保存' : '完成' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rotateDialog" max-width="460">
      <v-card rounded="4">
        <v-card-title>轮换客户端密钥</v-card-title>
        <v-card-text>
          <p>确定轮换「{{ rotateTarget?.clientName }}」的 Client Secret？</p>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
            旧密钥会立即失效。新密钥只显示一次，接入方需及时更新配置。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="rotateDialog = false">取消</v-btn>
          <v-btn
            color="warning"
            prepend-icon="mdi-key-change"
            :loading="rotateLoading"
            @click="submitRotate"
          >
            确认轮换
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="480">
      <v-card rounded="4">
        <v-card-title class="text-error">删除客户端</v-card-title>
        <v-card-text>
          <p>即将永久删除以下客户端：</p>
          <div class="delete-target">
            <strong>{{ deleteTarget?.clientName }}</strong>
            <span class="font-mono">{{ deleteTarget?.clientId }}</span>
          </div>
          <v-alert type="error" variant="tonal" density="compact" class="mt-3">
            删除后无法恢复，该客户端的 Access Token 和 Refresh Token 会被一并吊销。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog = false">取消</v-btn>
          <v-btn
            color="error"
            prepend-icon="mdi-delete-outline"
            :loading="deleteLoading"
            @click="submitDelete"
          >
            永久删除
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.oauth-clients-page {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.page-title {
  margin: 0;
  color: #1d2129;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-sub {
  margin: 3px 0 0;
  color: #86909c;
  font-size: 13px;
}

.empty-card,
.client-card {
  border-color: #e5e6eb;
  background: #ffffff;
}

.client-list {
  display: grid;
  gap: 16px;
}

.client-card-header,
.client-identity,
.client-name-row,
.client-id-row,
.status-group,
.client-actions {
  display: flex;
  align-items: center;
}

.client-card-header {
  justify-content: space-between;
  gap: 16px;
}

.client-identity {
  min-width: 0;
}

.client-icon {
  flex-shrink: 0;
  margin-right: 10px;
}

.identity-copy {
  min-width: 0;
}

.client-name-row,
.status-group {
  flex-wrap: wrap;
  gap: 8px;
}

.client-name {
  color: #1d2129;
  font-weight: 600;
}

.client-id-row {
  min-width: 0;
  color: #86909c;
}

.client-id-row .font-mono {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.approval-alert {
  margin-top: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
  row-gap: 10px;
}

.detail-row {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.detail-row-wide {
  grid-column: 1 / -1;
}

.detail-label {
  color: #86909c;
  font-size: 13px;
}

.detail-value {
  min-width: 0;
  color: #4e5969;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.uri-list {
  display: grid;
  gap: 3px;
}

.client-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
}

.font-mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
}

.form-content {
  display: grid;
  gap: 14px;
  padding-top: 12px !important;
}

.field-label {
  margin-bottom: 7px;
  color: #4e5969;
  font-size: 13px;
  font-weight: 500;
}

.field-help {
  margin-top: -8px;
  color: #86909c;
  font-size: 12px;
}

.client-type-toggle {
  width: 100%;
}

.client-type-toggle :deep(.v-btn) {
  flex: 1;
}

.grant-settings {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
}

.ttl-grid,
.immutable-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.delete-target {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
  overflow-wrap: anywhere;
}

@media (max-width: 700px) {
  .oauth-clients-page {
    padding: 16px;
  }

  .page-header,
  .client-card-header {
    align-items: flex-start;
  }

  .page-header {
    flex-direction: column;
  }

  .client-card-header {
    flex-direction: column;
  }

  .detail-grid,
  .ttl-grid,
  .immutable-grid {
    grid-template-columns: 1fr;
  }

  .detail-row-wide {
    grid-column: auto;
  }

  .detail-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .client-actions {
    justify-content: flex-start;
  }

  .grant-settings {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
