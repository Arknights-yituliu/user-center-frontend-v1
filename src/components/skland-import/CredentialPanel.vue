<script setup lang="ts">
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
  qrLoading: boolean
}>()

defineEmits<{
  submitPair: []
  submitOfficial: []
  startQr: []
  stopQr: []
}>()

const methods: Array<{ key: CredentialMethod; icon: string; title: string; description: string }> = [
  {
    key: 'credential',
    icon: 'mdi-key-outline',
    title: '森空岛凭证',
    description: '粘贴成对的 cred,token，直接读取两个游戏的绑定账号。',
  },
  {
    key: 'official',
    icon: 'mdi-shield-key-outline',
    title: '官网 Token',
    description: '粘贴鹰角通行证 Token 或 account/info/hg 的完整 JSON。',
  },
  {
    key: 'qr',
    icon: 'mdi-qrcode-scan',
    title: '森空岛扫码',
    description: '用森空岛 APP 扫码确认，自动获取凭证。',
  },
]
</script>

<template>
  <div class="si-section">
    <div class="si-methods">
      <button
        v-for="(item, index) in methods"
        :key="item.key"
        type="button"
        class="si-method"
        :class="{ 'is-active': method === item.key }"
        :aria-pressed="method === item.key"
        :disabled="loading"
        @click="method = item.key"
      >
        <span class="si-method-number">0{{ index + 1 }}</span>
        <v-icon :icon="item.icon" size="24" />
        <strong>{{ item.title }}</strong>
        <span>{{ item.description }}</span>
      </button>
    </div>

    <div class="si-panel">
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
        <p class="si-hint">
          需要 cred 与 token 成对粘贴；只有 cred 请改用「官网 Token」或「森空岛扫码」。
        </p>
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
        <textarea
          id="si-official-input"
          v-model="officialInput"
          class="si-input"
          placeholder="通行证 token，或 data.content 所在的整段 JSON"
          autocomplete="off"
          spellcheck="false"
          :disabled="loading"
        ></textarea>
        <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>
        <div class="si-actions">
          <v-btn type="submit" variant="flat" color="primary" :loading="loading">
            换取凭证并读取账号
          </v-btn>
        </div>
      </form>

      <template v-else>
        <p v-if="errorMessage" class="si-error" role="alert">{{ errorMessage }}</p>
        <SklandQrLogin
          :image="qrImage"
          :status="qrStatus"
          :loading="qrLoading"
          @start="$emit('startQr')"
          @stop="$emit('stopQr')"
        />
      </template>
    </div>
  </div>
</template>
