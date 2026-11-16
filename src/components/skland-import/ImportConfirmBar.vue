<script setup lang="ts">
import { gameLabel, targetUidText, type SklandTarget } from '../../types/skland-import'

/**
 * 步骤 3：写入前确认
 *
 * 只渲染已勾选游戏的账号（由页面过滤后传入），逐条列出 UID / roleId 与区服。
 */
defineProps<{
  targets: SklandTarget[]
}>()
</script>

<template>
  <div class="si-confirm">
    <div v-for="target in targets" :key="target.key" class="si-confirm-row">
      <span class="si-confirm-game">{{ gameLabel(target.game) }}</span>
      <strong>{{ target.nickname }}</strong>
      <span class="si-confirm-meta">
        UID {{ targetUidText(target) }} · {{ target.serverName }}
      </span>
    </div>
  </div>
</template>
