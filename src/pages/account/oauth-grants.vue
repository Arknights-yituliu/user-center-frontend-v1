<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getUcToken } from '../../api/uc/uc-api'
import {
  listOAuthGrants,
  revokeOAuthGrant,
  type OAuthGrantGroup,
} from '../../api/uc/oauth-client-api'
import { createMessage } from '../../utils/message'

const router = useRouter()
const pageLoading = ref(false)
const groups = ref<OAuthGrantGroup[]>([])

const revokeDialog = ref(false)
const revokeLoading = ref(false)
const revokeTarget = ref<OAuthGrantGroup | null>(null)

/** 页面加载：未登录先引导登录，随后拉取我的授权应用列表 */
onMounted(async () => {
  if (!getUcToken()) {
    createMessage({ text: '请先登录', type: 'warning' })
    await router.push({ name: 'LOGIN' })
    return
  }
  await loadGrants()
})

/** 拉取当前用户授权过的应用列表（按应用分组） */
async function loadGrants(): Promise<void> {
  pageLoading.value = true
  try {
    const response = await listOAuthGrants()
    groups.value = response.data || []
  } catch (error) {
    const ucError = error as { code?: number } | null
    if (ucError && (ucError.code === 80001 || ucError.code === 80002)) {
      await router.push({ name: 'LOGIN' })
    }
  } finally {
    pageLoading.value = false
  }
}

/** 打开撤销确认框 */
function openRevokeDialog(group: OAuthGrantGroup): void {
  revokeTarget.value = group
  revokeDialog.value = true
}

/** 提交撤销：按应用整体撤销，作废其名下全部令牌 */
async function submitRevoke(): Promise<void> {
  if (!revokeTarget.value) {
    return
  }
  revokeLoading.value = true
  try {
    await revokeOAuthGrant(revokeTarget.value.clientId)
    revokeDialog.value = false
    createMessage({ text: '已撤销该应用的授权', type: 'success' })
    await loadGrants()
  } catch {
    // 业务错误由 ucRequest 统一展示。
  } finally {
    revokeLoading.value = false
  }
}

/** 格式化 ISO-8601 时间为本地日期时间字符串 */
function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** 将剩余有效期（秒）格式化为可读文案 */
function formatRemaining(seconds: number): string {
  if (seconds >= 86400) {
    return `约 ${Math.round(seconds / 86400)} 天`
  }
  if (seconds >= 3600) {
    return `约 ${Math.round(seconds / 3600)} 小时`
  }
  return `约 ${Math.max(1, Math.round(seconds / 60))} 分钟`
}

/** 将逗号分隔的 scope 字符串拆为列表 */
function splitScopes(scope: string): string[] {
  return scope
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
</script>

<template>
  <main class="oauth-grants-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">我的授权应用</h1>
        <p class="page-sub">管理你授权访问账号信息的第三方应用，可随时撤销</p>
      </div>
    </div>

    <div v-if="pageLoading" class="d-flex justify-center my-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <v-card v-else-if="groups.length === 0" rounded="4" elevation="0" border class="empty-card">
      <div class="text-center pa-10">
        <v-icon icon="mdi-shield-lock-outline" size="48" color="grey-lighten-1"></v-icon>
        <div class="mt-4 text-medium-emphasis">你还没有授权任何第三方应用</div>
        <div class="mt-1 empty-sub">使用第三方网站通过一图流账号登录后，会在这里展示</div>
      </div>
    </v-card>

    <div v-else class="group-list">
      <v-card
        v-for="group in groups"
        :key="group.clientId"
        rounded="4"
        elevation="0"
        border
        class="grant-card"
      >
        <v-card-text>
          <div class="grant-card-header">
            <div class="grant-identity">
              <v-icon icon="mdi-shield-account" color="primary" class="grant-icon"></v-icon>
              <div class="identity-copy">
                <div class="grant-name">{{ group.clientName }}</div>
                <div class="grant-id font-mono">{{ group.clientId }}</div>
                <div class="grant-count">
                  已授权 {{ group.grants.length }} 次
                  <template v-if="group.grants.length > 1">
                    · 撤销将同时收回全部授权
                  </template>
                </div>
              </div>
            </div>
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-link-off"
              @click="openRevokeDialog(group)"
            >
              撤销授权
            </v-btn>
          </div>

          <v-divider class="my-3"></v-divider>

          <div class="grant-list">
            <div v-for="(item, index) in group.grants" :key="index" class="grant-item">
              <div class="grant-scopes">
                <v-chip
                  v-for="scope in splitScopes(item.scope)"
                  :key="scope"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                >
                  {{ scope }}
                </v-chip>
              </div>
              <div class="grant-meta">
                <span>授权于 {{ formatDateTime(item.createdAt) }}</span>
                <span>剩余 {{ formatRemaining(item.expiresInSeconds) }}</span>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="revokeDialog" max-width="480">
      <v-card rounded="4">
        <v-card-title class="text-error">撤销应用授权</v-card-title>
        <v-card-text>
          <p>即将撤销「{{ revokeTarget?.clientName }}」的全部授权：</p>
          <div class="revoke-target">
            <strong>{{ revokeTarget?.clientName }}</strong>
            <span class="font-mono">{{ revokeTarget?.clientId }}</span>
          </div>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-3">
            该应用的 Access Token 与 Refresh Token 将全部作废，应用将无法继续访问你的账号数据。
            如需再次使用，需重新完成授权登录。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="revokeDialog = false">取消</v-btn>
          <v-btn
            color="error"
            prepend-icon="mdi-link-off"
            :loading="revokeLoading"
            @click="submitRevoke"
          >
            确认撤销
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.oauth-grants-page {
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
.grant-card {
  border-color: #e5e6eb;
  background: #ffffff;
}

.empty-sub {
  color: #86909c;
  font-size: 13px;
}

.group-list {
  display: grid;
  gap: 16px;
}

.grant-card-header,
.grant-identity,
.grant-scopes,
.grant-meta {
  display: flex;
  align-items: center;
}

.grant-card-header {
  justify-content: space-between;
  gap: 16px;
}

.grant-identity {
  min-width: 0;
}

.grant-icon {
  flex-shrink: 0;
  margin-right: 10px;
}

.identity-copy {
  min-width: 0;
}

.grant-name {
  color: #1d2129;
  font-weight: 600;
}

.grant-id {
  margin-top: 2px;
  color: #86909c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grant-count {
  margin-top: 4px;
  color: #86909c;
  font-size: 12px;
}

.grant-list {
  display: grid;
  gap: 8px;
}

.grant-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
}

.grant-scopes {
  flex-wrap: wrap;
  gap: 5px;
}

.grant-meta {
  flex-wrap: wrap;
  gap: 16px;
  color: #86909c;
  font-size: 12px;
}

.revoke-target {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #f7f8fa;
  overflow-wrap: anywhere;
}

.font-mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
}

@media (max-width: 700px) {
  .oauth-grants-page {
    padding: 16px;
  }

  .page-header,
  .grant-card-header {
    align-items: flex-start;
  }

  .page-header {
    flex-direction: column;
  }

  .grant-card-header {
    flex-direction: column;
  }

  .grant-item {
    align-items: flex-start;
  }
}
</style>
