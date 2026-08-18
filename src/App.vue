<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
/* 全局底色，保证背景始终铺满 */
html,
body {
  background-color: #ffffff;
  min-height: 100%;
}
</style>
