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
}>()

defineEmits<{
  selectMethod: [method: CredentialMethod]
  submitPair: []
  submitOfficial: []
}>()

const methods: Array<{ key: CredentialMethod; icon: string; title: string }> = [
  {
    key: 'credential',
    icon: 'mdi-key-outline',
    title: '森空岛凭证',
  },
  {
    key: 'official',
    icon: 'mdi-shield-key-outline',
    title: '官网 Token',
  },
  {
    key: 'qr',
    icon: 'mdi-qrcode-scan',
    title: '森空岛扫码',
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
        @click="$emit('selectMethod', item.key)"
      >
        <span class="si-method-number">方式{{ index + 1 }}</span>
        <span class="si-method-main">
          <v-icon :icon="item.icon" size="24" />
          <strong>{{ item.title }}</strong>
        </span>
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
        />
      </template>
    </div>
  </div>
</template>
