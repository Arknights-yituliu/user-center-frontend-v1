<script setup>
import {reactive, ref, onMounted} from "vue";
import {useRouter} from "vue-router";
import {createMessage} from "../../utils/message";
import {getUcToken} from "../../api/uc/uc-api";
import {
    registerOAuthClient,
    listOAuthClients,
    updateOAuthClient,
    rotateOAuthClientSecret,
    setOAuthClientStatus,
    deleteOAuthClient,
} from "../../api/uc/oauth-client-api";

const router = useRouter()

/** 页面加载状态 */
const pageLoading = ref(false)
/** 客户端列表（当前登录用户名下） */
const clients = ref([])

/** 创建 / 编辑对话框显示控制 */
const createDialog = ref(false)
const editDialog = ref(false)
/** 一次性密钥展示对话框（注册 / 轮换成功时弹出） */
const secretDialog = ref(false)
/** 轮换密钥确认对话框 */
const rotateDialog = ref(false)
/** 删除确认对话框 */
const deleteDialog = ref(false)

/** 正在编辑的客户端 */
const editingClient = ref(null)
/** 一次性密钥信息 { title, secret } */
const secretInfo = ref({title: "", secret: ""})
/** 待轮换密钥的客户端 */
const rotateTarget = ref(null)
/** 待删除的客户端 */
const deleteTarget = ref(null)

/** 创建表单 */
const createForm = reactive({
    clientName: "",
    redirectUris: "",
    scopes: "",
    websiteOrigin: "",
})

/** 编辑表单（预填所选客户端） */
const editForm = reactive({
    clientName: "",
    redirectUris: "",
    scopes: "",
    websiteOrigin: "",
})

/** 各操作提交 loading */
const createLoading = ref(false)
const editLoading = ref(false)
const rotateLoading = ref(false)
const deleteLoading = ref(false)

/**
 * 校验回调地址白名单：1~10 个，须 https（本地联调可 http://localhost）
 * @param {string} text 文本（每行一个地址）
 * @returns {{ok: boolean, list?: string[], msg?: string}} 校验结果
 */
function validateRedirectUris(text) {
    const list = text.split("\n").map((s) => s.trim()).filter(Boolean)
    if (list.length === 0) {
        return {ok: false, msg: "回调地址不能为空"}
    }
    if (list.length > 10) {
        return {ok: false, msg: "回调地址最多 10 个"}
    }
    for (const uri of list) {
        if (!/^https:\/\/.+/.test(uri) && uri !== "http://localhost" && !/^http:\/\/localhost(:\d+)?\/?.*$/.test(uri)) {
            return {ok: false, msg: `回调地址须为 https：${uri}`}
        }
    }
    return {ok: true, list}
}

/**
 * 校验可授权范围：非空数组
 * @param {string} text 文本（逗号或空白分隔）
 * @returns {{ok: boolean, list?: string[], msg?: string}} 校验结果
 */
function validateScopes(text) {
    const list = text.split(/[\s,，]+/).map((s) => s.trim()).filter(Boolean)
    if (list.length === 0) {
        return {ok: false, msg: "授权范围不能为空"}
    }
    return {ok: true, list}
}

/** 校验网站来源（可选）：http(s):// 开头 */
function validateWebsiteOrigin(value) {
    if (!value) {
        return true
    }
    return /^https?:\/\/.+/.test(value)
}

/**
 * 校验并解析创建/编辑表单公共字段
 * @param {typeof createForm} form 表单对象
 * @returns {{ok: boolean, payload?: object, msg?: string}} 校验结果与提交参数
 */
function parseCommonFields(form) {
    if (!form.clientName || !form.clientName.trim()) {
        return {ok: false, msg: "客户端名称不能为空"}
    }
    if (form.clientName.trim().length > 128) {
        return {ok: false, msg: "客户端名称不能超过 128 字符"}
    }
    const redirect = validateRedirectUris(form.redirectUris)
    if (!redirect.ok) {
        return {ok: false, msg: redirect.msg}
    }
    const scopes = validateScopes(form.scopes)
    if (!scopes.ok) {
        return {ok: false, msg: scopes.msg}
    }
    if (!validateWebsiteOrigin(form.websiteOrigin)) {
        return {ok: false, msg: "网站来源格式不正确（须以 http:// 或 https:// 开头）"}
    }
    return {
        ok: true,
        payload: {
            clientName: form.clientName.trim(),
            redirectUris: redirect.list,
            scopes: scopes.list,
            websiteOrigin: form.websiteOrigin.trim() || undefined,
        },
    }
}

/** 数组转多行文本（编辑时预填） */
function listToLines(list) {
    return Array.isArray(list) ? list.join("\n") : ""
}

/** 数组转逗号文本（编辑时预填） */
function listToComma(list) {
    return Array.isArray(list) ? list.join(", ") : ""
}

/**
 * 页面初始化：校验 UC 登录态并加载客户端列表
 */
onMounted(async () => {
    if (!getUcToken()) {
        createMessage({text: "请先登录", type: "warning"})
        router.push({name: "LOGIN"})
        return
    }
    await loadClients()
})

/**
 * 加载我的客户端列表（GET /oauth2/client/list）
 */
async function loadClients() {
    pageLoading.value = true
    try {
        const resp = await listOAuthClients()
        clients.value = resp.data || []
    } catch (e) {
        // 80001/80002 token 失效时引导重新登录
        if (e && (e.code === 80001 || e.code === 80002)) {
            router.push({name: "LOGIN"})
        }
    } finally {
        pageLoading.value = false
    }
}

/** 打开创建对话框（重置表单） */
function openCreateDialog() {
    Object.assign(createForm, {
        clientName: "",
        redirectUris: "",
        scopes: "",
        websiteOrigin: "",
    })
    createDialog.value = true
}

/**
 * 提交创建客户端（POST /oauth2/client/register）
 * 成功后弹出一次性密钥提示（明文仅此一次返回），并刷新列表
 */
async function submitCreate() {
    const result = parseCommonFields(createForm)
    if (!result.ok) {
        createMessage({text: result.msg, type: "warning"})
        return
    }
    createLoading.value = true
    try {
        const resp = await registerOAuthClient(result.payload)
        const data = resp.data || {}
        createDialog.value = false
        // 弹出一次性密钥展示对话框
        secretInfo.value = {
            title: "客户端创建成功，请立即保存密钥",
            secret: data.clientSecret || "",
        }
        secretDialog.value = true
        createMessage({text: "客户端创建成功", type: "success"})
        await loadClients()
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出（如 90012 数量超限）
    } finally {
        createLoading.value = false
    }
}

/** 打开编辑对话框并预填所选客户端 */
function openEditDialog(client) {
    editingClient.value = client
    Object.assign(editForm, {
        clientName: client.clientName,
        redirectUris: listToLines(client.redirectUris),
        scopes: listToComma(client.scopes),
        websiteOrigin: client.websiteOrigin || "",
    })
    editDialog.value = true
}

/**
 * 提交更新客户端（POST /oauth2/client/{clientId}/update）
 * clientId、authMethod、grantTypes、requirePkce、requireAuthConsent 不可修改
 */
async function submitEdit() {
    const result = parseCommonFields(editForm)
    if (!result.ok) {
        createMessage({text: result.msg, type: "warning"})
        return
    }
    editLoading.value = true
    try {
        await updateOAuthClient(editingClient.value.clientId, result.payload)
        editDialog.value = false
        createMessage({text: "客户端更新成功", type: "success"})
        await loadClients()
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出（如 80008 非本人、90001 不存在）
    } finally {
        editLoading.value = false
    }
}

/** 打开轮换密钥确认对话框 */
function openRotateDialog(client) {
    rotateTarget.value = client
    rotateDialog.value = true
}

/**
 * 执行密钥轮换（POST /oauth2/client/{clientId}/rotate-secret）
 * 新 secret 明文仅此一次返回，旧 secret 立即失效
 */
async function submitRotate() {
    rotateLoading.value = true
    try {
        const resp = await rotateOAuthClientSecret(rotateTarget.value.clientId)
        const data = resp.data || {}
        rotateDialog.value = false
        secretInfo.value = {
            title: "密钥已轮换，请立即保存新密钥",
            secret: data.clientSecret || "",
        }
        secretDialog.value = true
        createMessage({text: "密钥轮换成功", type: "success"})
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    } finally {
        rotateLoading.value = false
    }
}

/**
 * 切换客户端启用/停用状态（POST /oauth2/client/{clientId}/enable | /disable）
 * 管理员封禁（adminBanned=1）中的客户端无法自助启用（90013），需联系平台管理员解封
 * @param {object} client 目标客户端
 */
async function toggleStatus(client) {
    const enabled = client.status !== 1
    // 封禁中且尝试启用：提前拦截，避免请求后端返回 90013
    if (enabled && client.adminBanned === 1) {
        createMessage({text: "该客户端已被管理员封禁，无法自助启用，请联系平台管理员", type: "warning"})
        return
    }
    try {
        await setOAuthClientStatus(client.clientId, enabled)
        createMessage({text: enabled ? "客户端已启用" : "客户端已停用", type: "success"})
        await loadClients()
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    }
}

/** 打开删除确认对话框 */
function openDeleteDialog(client) {
    deleteTarget.value = client
    deleteDialog.value = true
}

/**
 * 执行删除客户端（DELETE /oauth2/client/{clientId}）
 * 级联吊销该 client 名下全部 token、未消费的授权码/确认单/票据，不可恢复
 */
async function submitDelete() {
    deleteLoading.value = true
    try {
        await deleteOAuthClient(deleteTarget.value.clientId)
        deleteDialog.value = false
        createMessage({text: "客户端已删除", type: "success"})
        await loadClients()
    } catch {
        // 错误提示已在 ucRequest 内部统一弹出
    } finally {
        deleteLoading.value = false
    }
}

/**
 * 复制一次性密钥到剪贴板
 * @param {string} text 要复制的文本
 */
async function copySecret(text) {
    try {
        await navigator.clipboard.writeText(text)
        createMessage({text: "已复制到剪贴板", type: "success"})
    } catch {
        createMessage({text: "复制失败，请手动选中复制", type: "error"})
    }
}
</script>

<template>
  <main class="oauth-clients-page">
    <!-- 页头：标题 + 注册入口 -->
    <div class="page-header d-flex align-center justify-space-between flex-wrap">
      <div>
        <div class="page-title">客户端管理</div>
        <div class="page-sub">自助维护你名下接入一图流账号（UserCenter）的 OAuth 客户端</div>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">注册新客户端</v-btn>
    </div>

    <!-- 加载中 -->
    <div v-if="pageLoading" class="d-flex justify-center my-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <!-- 空状态 -->
    <v-card v-else-if="clients.length === 0" rounded="4" elevation="0" border class="empty-card">
      <div class="text-center pa-10">
        <v-icon icon="mdi-api" size="48" color="grey-lighten-1"></v-icon>
        <div class="mt-4 text-medium-emphasis">你还没有 OAuth 客户端，点击右上角"注册新客户端"创建第一个</div>
      </div>
    </v-card>

    <!-- 客户端列表 -->
    <template v-else>
      <v-card v-for="client in clients" :key="client.clientId" rounded="4" elevation="0" border class="mb-4">
        <v-card-text>
          <div class="d-flex align-center justify-space-between flex-wrap">
            <div class="d-flex align-center">
              <v-icon icon="mdi-api" color="primary" class="mr-2"></v-icon>
              <div>
                <div class="font-weight-medium">{{ client.clientName }}</div>
                <div class="text-caption text-medium-emphasis font-mono">{{ client.clientId }}</div>
              </div>
            </div>
            <div class="d-flex align-center">
              <!-- 管理员封禁徽标（优先级最高，用户无法解除） -->
              <v-chip
                  v-if="client.adminBanned === 1"
                  color="error"
                  size="small"
                  class="mr-2"
              >管理员封禁</v-chip>
              <v-chip
                  :color="client.status === 1 ? 'success' : 'grey'"
                  size="small"
                  class="mr-2"
              >{{ client.status === 1 ? '启用中' : '已停用' }}</v-chip>
              <v-btn size="small" variant="text" color="primary" @click="openEditDialog(client)">编辑</v-btn>
              <v-btn size="small" variant="text" color="warning" @click="openRotateDialog(client)">轮换密钥</v-btn>
              <v-btn
                  size="small"
                  variant="text"
                  :color="client.status === 1 ? 'default' : 'success'"
                  :disabled="client.adminBanned === 1 && client.status !== 1"
                  @click="toggleStatus(client)"
              >{{ client.status === 1 ? '停用' : '启用' }}</v-btn>
              <v-btn size="small" variant="text" color="error" @click="openDeleteDialog(client)">删除</v-btn>
            </div>
          </div>

          <v-divider class="my-3"></v-divider>

          <div class="detail-row">
            <span class="detail-label">授权范围</span>
            <v-chip v-for="scope in client.scopes" :key="scope" size="x-small" variant="tonal" color="primary" class="mr-1">
              {{ scope }}
            </v-chip>
          </div>
          <div class="detail-row">
            <span class="detail-label">回调地址</span>
            <span class="detail-value font-mono">{{ client.redirectUris.join('；') }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">网站来源</span>
            <span class="detail-value font-mono">{{ client.websiteOrigin || '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">安全配置</span>
            <span class="detail-value">
              强制 PKCE：是 ｜ 授权确认页：展示（均为系统固定开启，不可修改）
            </span>
          </div>
          <div class="detail-row mb-0">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">{{ client.createTime }}</span>
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- 创建客户端对话框 -->
    <v-dialog v-model="createDialog" max-width="560">
      <v-card rounded="4">
        <v-card-title>注册新客户端</v-card-title>
        <v-card-text>
          <v-text-field v-model="createForm.clientName" label="客户端名称" placeholder="如：门户网站"
                        hint="≤128 字符" variant="outlined" density="compact"></v-text-field>
          <v-textarea v-model="createForm.redirectUris" label="回调地址白名单" placeholder="每行一个，须 https：&#10;https://ak.example.com/callback"
                      hint="1~10 个，本地联调可用 http://localhost" variant="outlined" density="compact" rows="3"></v-textarea>
          <v-textarea v-model="createForm.scopes" label="可授权范围" placeholder="逗号分隔，如：user.read, user.email"
                      variant="outlined" density="compact" rows="2"></v-textarea>
          <v-text-field v-model="createForm.websiteOrigin" label="网站来源（可选）" placeholder="https://ak.example.com"
                        hint="前端 CORS 白名单来源" variant="outlined" density="compact"></v-text-field>
          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            强制 PKCE 与授权确认页为系统固定开启，无需配置。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="createDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="createLoading" @click="submitCreate">创建</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 编辑客户端对话框 -->
    <v-dialog v-model="editDialog" max-width="560">
      <v-card rounded="4">
        <v-card-title>编辑客户端</v-card-title>
        <v-card-text>
          <v-text-field :model-value="editingClient && editingClient.clientId" label="客户端 ID" readonly
                        variant="outlined" density="compact" class="mb-3"></v-text-field>
          <v-text-field v-model="editForm.clientName" label="客户端名称" hint="≤128 字符"
                        variant="outlined" density="compact"></v-text-field>
          <v-textarea v-model="editForm.redirectUris" label="回调地址白名单" placeholder="每行一个，须 https"
                      hint="1~10 个" variant="outlined" density="compact" rows="3"></v-textarea>
          <v-textarea v-model="editForm.scopes" label="可授权范围" placeholder="逗号分隔，如：user.read, user.email"
                      variant="outlined" density="compact" rows="2"></v-textarea>
          <v-text-field v-model="editForm.websiteOrigin" label="网站来源（可选）" variant="outlined" density="compact"></v-text-field>
          <v-alert type="info" variant="tonal" density="compact" class="mt-2">
            强制 PKCE 与授权确认页为系统固定开启，不可修改。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="editDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="editLoading" @click="submitEdit">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 一次性密钥展示对话框（注册/轮换成功后） -->
    <v-dialog v-model="secretDialog" max-width="480">
      <v-card rounded="4">
        <v-card-title>{{ secretInfo.title }}</v-card-title>
        <v-card-text>
          <v-text-field :model-value="secretInfo.secret" label="Client Secret" readonly variant="outlined"
                        density="compact" type="text"></v-text-field>
          <v-alert type="warning" variant="tonal" class="mt-2" density="compact">
            密钥明文仅在此展示一次，关闭后无法再次查看；请立即复制保存，如丢失请走"轮换密钥"。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" prepend-icon="mdi-content-copy" @click="copySecret(secretInfo.secret)">复制密钥</v-btn>
          <v-btn variant="text" @click="secretDialog = false">我已保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 轮换密钥确认对话框 -->
    <v-dialog v-model="rotateDialog" max-width="440">
      <v-card rounded="4">
        <v-card-title>轮换密钥</v-card-title>
        <v-card-text>
          确定轮换「{{ rotateTarget && rotateTarget.clientName }}」的 Client Secret 吗？<br />
          轮换后<b>旧密钥立即失效</b>，接入方在更新完成前将无法换取令牌。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="rotateDialog = false">取消</v-btn>
          <v-btn color="warning" :loading="rotateLoading" @click="submitRotate">确认轮换</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 删除确认对话框 -->
    <v-dialog v-model="deleteDialog" max-width="440">
      <v-card rounded="4">
        <v-card-title class="text-error">删除客户端</v-card-title>
        <v-card-text>
          确定删除「{{ deleteTarget && deleteTarget.clientName }}」吗？<br />
          删除将<b>级联吊销</b>该客户端名下全部令牌与未消费的授权码/确认单/票据，<b>不可恢复</b>。建议先停用观察再删除。
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog = false">取消</v-btn>
          <v-btn color="error" :loading="deleteLoading" @click="submitDelete">确认删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </main>
</template>

<style scoped>
.oauth-clients-page {
    padding: 24px;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
}

/* 页头 */
.page-header {
    margin-bottom: 16px;
    gap: 12px;
}

.page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1d2129;
}

.page-sub {
    font-size: 13px;
    color: #86909c;
}

/* 列表详情行 */
.detail-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 6px;
    gap: 8px;
}

.detail-label {
    flex-shrink: 0;
    width: 72px;
    font-size: 13px;
    opacity: 0.6;
}

.detail-value {
    font-size: 13px;
    word-break: break-all;
}

/* 等宽字体（clientId / 密钥 / 地址） */
.font-mono {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
}
</style>
