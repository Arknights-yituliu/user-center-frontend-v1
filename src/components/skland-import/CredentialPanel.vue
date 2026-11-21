<script setup lang="ts">
import { computed } from 'vue'
import SklandQrLogin from './SklandQrLogin.vue'
import type { CredentialMethod } from '../../composables/useSklandCredential'

/**
 * 凭证获取面板：cred,token / 官网 Token / 扫码 三选一
 *
 * 三种来源都直接给出完整的 { cred, token }，不提供「只贴 cred」入口。
 */
const method = defineModel<CredentialMethod>('method', { required: true })
const pairInput = defineModel<string>('pairInput', { required: true })
const officialInput = defineModel<string>('officialInput', { required: true })

defineProps<{
  loading: boolean
  errorMessage: string
  qrImage: string
  qrStatus: string
}>()

defineEmits<{
  selectMethod: [method: CredentialMethod]
  submitPair: []
  submitOfficial: []
}>()

const methods: Array<{
  key: CredentialMethod
  icon: string
  title: string
  subtitle: string
  note: string
}> = [
  {
    key: 'credential',
    icon: 'mdi-key-outline',
    title: '森空岛凭证',
    subtitle: '直接使用森空岛凭证，获取绑定账号的干员数据。',
    note: 'PC端操作方便，移动端略为艰难，安全性较高',
  },
  {
    key: 'official',
    icon: 'mdi-shield-key-outline',
    title: '官网 Token',
    subtitle: '通过官网 Token 获取森空岛凭证，再获取绑定账号的干员数据。',
    note: 'PC端/移动端都比较方便，务必注意Token安全',
  },
  {
    key: 'qr',
    icon: 'mdi-qrcode-scan',
    title: '森空岛扫码',
    subtitle: '使用森空岛 APP 扫码登录，自动获取凭证并导入干员数据。',
    note: 'PC端/移动端都方便，无需复制粘贴凭证，推荐使用',
  },
]

const activeMethod = computed(() => methods.find((item) => item.key === method.value) ?? methods[0]!)
const activeMethodIndex = computed(() => methods.findIndex((item) => item.key === method.value) + 1)
</script>

<template>
  <div class="si-section">
    <div class="si-methods" role="tablist" aria-label="森空岛凭证获取方式">
      <button
        v-for="item in methods"
        :key="item.key"
        type="button"
        class="si-method"
        :class="{ 'is-active': method === item.key }"
        role="tab"
        :aria-pressed="method === item.key"
        :aria-selected="method === item.key"
        aria-controls="si-method-panel"
        :disabled="loading"
        @click="$emit('selectMethod', item.key)"
      >
        <span class="si-method-main">
          <v-icon :icon="item.icon" size="24" />
          <strong>{{ item.title }}</strong>
        </span>
      </button>
    </div>

    <div class="si-method-summary">
      <span class="si-method-number">方式{{ activeMethodIndex }}</span>
      <span class="si-method-main">
        <v-icon :icon="activeMethod.icon" size="24" />
        <strong>{{ activeMethod.title }}</strong>
      </span>
      <span class="si-method-subtitle">{{ activeMethod.subtitle }}</span>
      <span class="si-method-note">{{ activeMethod.note }}</span>
    </div>

    <div id="si-method-panel" class="si-panel" role="tabpanel" :aria-label="activeMethod.title">
      <form v-if="method === 'credential'" class="si-form" @submit.prevent="$emit('submitPair')">
        <label class="si-hint" for="si-credential-input">森空岛凭证（格式为 cred,token）</label>
        <textarea
          id="si-credential-input"
          v-model="pairInput"
          class="si-input"
          placeholder="cred,token"
          autocomplete="off"
          spellcheck="false"
          :disabled="loading"
        ></textarea>
        <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>
        <div class="si-actions">
          <v-btn type="submit" variant="flat" color="primary" :loading="loading">读取绑定账号</v-btn>
        </div>
      </form>

      <form
        v-else-if="method === 'official'"
        class="si-form"
        @submit.prevent="$emit('submitOfficial')"
      >
        <label class="si-hint" for="si-official-input">官网 Token 或 account/info/hg 完整 JSON</label>
        <input
          id="si-official-input"
          v-model="officialInput"
          type="password"
          class="si-input si-input-password"
          placeholder="通行证 token，或 data.content 所在的整段 JSON"
          autocomplete="off"
          spellcheck="false"
          :disabled="loading"
        />
        <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>
        <div class="si-actions">
          <v-btn type="submit" variant="flat" color="primary" :loading="loading">
            {{ officialInput.trim() ? '粘贴好了，获取账号列表并导入！' : '请先在上方输入框粘贴返回内容' }}
          </v-btn>
        </div>
      </form>

      <template v-else>
        <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>
        <SklandQrLogin
          :image="qrImage"
          :status="qrStatus"
        />
      </template>
    </div>
  </div>
</template>
