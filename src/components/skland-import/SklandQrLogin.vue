<script setup lang="ts">
/**
 * 森空岛扫码登录：二维码 + 状态文案 + 重新生成 / 停止轮询
 * 只负责展示，轮询与竞态由 useSklandCredential 处理。
 */
defineProps<{
  image: string
  status: string
  loading: boolean
}>()

defineEmits<{
  start: []
  stop: []
}>()
</script>

<template>
  <div class="si-qr">
    <div class="si-qr-canvas">
      <img v-if="image" :src="image" alt="森空岛扫码登录二维码" />
      <p v-else>{{ loading ? '正在生成二维码…' : '点击下方按钮生成二维码' }}</p>
    </div>

    <p v-if="status" class="si-qr-status">{{ status }}</p>

    <div class="si-actions">
      <v-btn variant="flat" color="primary" :loading="loading" @click="$emit('start')">
        {{ image ? '重新生成' : '生成二维码' }}
      </v-btn>
      <v-btn variant="text" @click="$emit('stop')">停止轮询</v-btn>
    </div>

    <p class="si-hint">请使用森空岛 APP 扫码并确认授权；凭证只在本次页面会话内使用，不写入本地存储。</p>
  </div>
</template>
