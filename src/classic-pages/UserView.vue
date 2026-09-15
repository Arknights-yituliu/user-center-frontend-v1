<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  getUcUid,
  getUserProfile,
  logoutUcSession,
  updateProfile,
  type UcProfileVO,
} from '../api/uc/uc-api'
import { createMessage } from '../utils/message'

const router = useRouter()

/** 页面加载状态（拉取用户资料期间展示加载） */
const pageLoading = ref(true)

/** 账户信息（接入 UC GET /user/profile 真实数据，接口返回前用本地兜底占位） */
const profile = ref<UcProfileVO>({
  uid: Number(getUcUid()) || 0,
  nickname: '--',
  email: null,
  avatar: null,
  status: 1,
  registerTime: '',
  lastLoginTime: '',
})

/** 账户状态文案映射 */
const statusText: Record<number, string> = {
  0: '已禁用',
  1: '正常',
}

/** 修改昵称对话框显示控制 */
const editNicknameDialog = ref(false)
/** 修改昵称输入值 */
const newNickname = ref('')
/** 修改昵称提交加载状态 */
const editNicknameLoading = ref(false)

/**
 * 页面初始化：拉取当前用户资料（UC GET /user/profile）
 * token 失效（80001/80002）时引导重新登录
 */
onMounted(async () => {
  try {
    const resp = await getUserProfile()
    if (resp.data) {
      // 用接口返回的真实资料覆盖占位数据
      profile.value = { ...profile.value, ...resp.data }
    }
  } catch (e) {
    // 类型收窄：UC 统一错误结构含 code/msg，token 失效（80001/80002）时引导重新登录
    const err = e as { code?: number } | null
    if (err && (err.code === 80001 || err.code === 80002)) {
      router.push({ name: 'LOGIN' })
      return
    }
  } finally {
    pageLoading.value = false
  }
})

/**
 * 打开修改昵称对话框，预填当前昵称
 */
function openEditNickname(): void {
  newNickname.value = profile.value.nickname || ''
  editNicknameDialog.value = true
}

/**
 * 提交修改昵称（UC POST /user/profile，昵称最长 20 字符）
 * 成功后更新本地展示并关闭对话框
 */
async function handleSubmitNickname(): Promise<void> {
  const nickname = newNickname.value.trim()
  if (!nickname) {
    createMessage({ text: '昵称不能为空', type: 'warning' })
    return
  }
  if (nickname.length > 20) {
    createMessage({ text: '昵称长度不能超过 20', type: 'warning' })
    return
  }
  editNicknameLoading.value = true
  try {
    await updateProfile({ nickname })
    profile.value.nickname = nickname
    editNicknameDialog.value = false
    createMessage({ text: '昵称修改成功', type: 'success' })
  } catch {
    // 错误提示已在 ucRequest 内部统一弹出
  } finally {
    editNicknameLoading.value = false
  }
}

/**
 * 退出登录：清除服务端与本地会话后跳转登录页
 */
async function handleLogout(): Promise<void> {
  await logoutUcSession()
  router.push({ name: 'LOGIN' })
}
</script>

<template>
  <div class="profile-page">
    <!-- 拉取资料中 -->
    <div v-if="pageLoading" class="d-flex justify-center my-12">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <template v-else>
      <!-- 基本信息卡片：腾讯云控制台风格（白色卡片 + 细边框 + 小圆角） -->
      <v-card class="profile-card" rounded="4" elevation="0" border>
        <div class="card-header">
          <div class="card-header-left">
            <v-avatar size="56" color="primary" class="avatar">
              <v-img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
              <span v-else class="text-h5">{{ profile.nickname.charAt(0) }}</span>
            </v-avatar>
            <div class="ml-4">
              <div class="nickname-row">
                <span class="nickname">{{ profile.nickname }}</span>
                <v-chip size="small" color="primary" variant="tonal">正常账号</v-chip>
              </div>
              <div class="uid-text">UID：{{ profile.uid || '--' }}</div>
            </div>
          </div>
          <v-btn variant="outlined" color="primary" size="small" prepend-icon="mdi-pencil-outline" @click="openEditNickname">
            修改昵称
          </v-btn>
        </div>
      </v-card>

      <!-- 安全设置卡片 -->
      <v-card class="profile-card mt-4" rounded="4" elevation="0" border>
        <div class="card-title">安全设置</div>
        <v-divider class="title-divider"></v-divider>
        <div class="info-row">
          <div class="info-label">
            <v-icon icon="mdi-email-outline" size="18" color="#86909c" class="mr-2"></v-icon>
            邮箱
          </div>
          <div class="info-value">{{ profile.email || '未绑定' }}</div>
          <div class="info-action">
            <v-btn variant="text" size="small" color="primary" to="/user/email">绑定/换绑</v-btn>
          </div>
        </div>
        <v-divider class="row-divider"></v-divider>
        <div class="info-row">
          <div class="info-label">
            <v-icon icon="mdi-shield-account-outline" size="18" color="#86909c" class="mr-2"></v-icon>
            账户状态
          </div>
          <div class="info-value">{{ statusText[profile.status] || '未知' }}</div>
        </div>
      </v-card>

      <!-- 账号操作卡片 -->
      <v-card class="profile-card mt-4" rounded="4" elevation="0" border>
        <div class="card-title">账号操作</div>
        <v-divider class="title-divider"></v-divider>
        <div class="danger-row">
          <div>
            <div class="danger-title">退出当前账号</div>
            <div class="danger-desc">退出后需重新登录才能使用本中心功能</div>
          </div>
          <v-btn color="error" variant="tonal" size="small" @click="handleLogout">退出登录</v-btn>
        </div>
      </v-card>
    </template>

    <!-- 修改昵称对话框（不设 persistent，点击四周或按 ESC 可关闭） -->
    <v-dialog v-model="editNicknameDialog" max-width="400">
      <v-card rounded="4">
        <v-card-title>修改昵称</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newNickname"
            label="新昵称"
            variant="outlined"
            density="compact"
            maxlength="20"
            counter
            @keyup.enter="handleSubmitNickname"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="editNicknameDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="editNicknameLoading" @click="handleSubmitNickname">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* 页面容器：浅灰背景上承载白色卡片，限宽居中，垂直流式布局 */
.profile-page {
  padding: 24px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

/* 白色内容卡片 */
.profile-card {
  background: #ffffff;
  border-color: #e5e6eb;
}

/* 卡片头部：头像 + 昵称/UID，右侧操作按钮 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
}

.card-header-left {
  display: flex;
  align-items: center;
}

.nickname-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nickname {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
}

.uid-text {
  margin-top: 2px;
  font-size: 13px;
  color: #86909c;
}

/* 卡片标题区 */
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d2129;
  padding: 16px 24px 12px;
}

.title-divider {
  border-color: #e5e6eb;
}

/* 信息行：label + value + 操作 */
.info-row {
  display: flex;
  align-items: center;
  padding: 14px 24px;
  min-height: 48px;
}

.info-label {
  display: flex;
  align-items: center;
  width: 180px;
  font-size: 14px;
  color: #4e5969;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: #1d2129;
}

.info-action {
  flex-shrink: 0;
}

.row-divider {
  margin: 0 24px;
  border-color: #f2f3f5;
}

/* 危险操作区 */
.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px 18px;
}

.danger-title {
  font-size: 14px;
  color: #1d2129;
}

.danger-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #86909c;
}
</style>
