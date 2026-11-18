<script setup lang="ts">
/**
 * 森空岛扫码登录：二维码与状态文案
 * 只负责展示，轮询与竞态由 useSklandCredential 处理。
 */
defineProps<{
  image: string
  status: string
}>()

</script>

<template>
  <div class="si-qr">
    <div class="si-qr-canvas">
      <img v-if="image" :src="image" alt="森空岛扫码登录二维码" />
    </div>

    <p v-if="status" class="si-qr-status">{{ status }}</p>
  </div>
</template>
