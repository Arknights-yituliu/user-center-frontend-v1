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
  <main class="user-profile-page">
    <!-- 卡片宽度为页面 95%，居中显示，不限制固定宽度 -->
    <v-card class="profile-card mx-auto mt-10 pa-4" width="95%" elevation="1">
      <!-- 拉取资料中 -->
      <div v-if="pageLoading" class="d-flex justify-center my-10">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>

      <template v-else>
        <div class="d-flex align-center mb-4">
          <v-avatar size="64" color="primary">
            <v-img v-if="profile.avatar" :src="profile.avatar" alt="头像" />
            <span v-else class="text-h5">{{ profile.nickname.charAt(0) }}</span>
          </v-avatar>
          <div class="ml-4">
            <div class="d-flex align-center">
              <div class="text-h6">{{ profile.nickname }}</div>
              <!-- 修改昵称入口小图标 -->
              <v-btn
                variant="text"
                size="x-small"
                density="comfortable"
                icon="mdi-pencil-outline"
                aria-label="修改昵称"
                @click="openEditNickname"
              ></v-btn>
            </div>
            <div class="text-caption text-medium-emphasis">UID：{{ profile.uid || '--' }}</div>
          </div>
        </div>

        <v-divider />

        <v-list>
          <!-- 每行信息加大上下间距（py-3） -->
          <v-list-item
            class="py-3"
            title="邮箱"
            :subtitle="profile.email || '未绑定'"
            prepend-icon="mdi-email-outline"
          >
            <!-- 绑定/换绑邮箱入口放在邮箱行右侧 -->
            <template v-slot:append>
              <v-btn variant="text" size="small" color="primary" to="/user/email">绑定/换绑</v-btn>
            </template>
          </v-list-item>
          <v-list-item
            class="py-3"
            title="账户状态"
            :subtitle="statusText[profile.status] || '未知'"
            prepend-icon="mdi-shield-account-outline"
          />
        </v-list>

        <v-divider />

        <div class="d-flex justify-center mt-4">
          <!-- block 会拉伸占满父容器，改为固定 200px 宽度 -->
          <v-btn color="error" style="width: 200px" @click="handleLogout"> 退出登录 </v-btn>
        </div>
      </template>
    </v-card>

    <!-- 修改昵称对话框（不设 persistent，点击四周或按 ESC 可关闭） -->
    <v-dialog v-model="editNicknameDialog" max-width="400">
      <v-card>
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
  </main>
</template>

<style scoped>
.user-profile-page {
  padding: 0 16px 32px;
}
</style>
