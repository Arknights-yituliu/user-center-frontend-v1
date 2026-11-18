<script setup lang="ts">
import { gameLabel, stageLabel, type SklandImportError } from '../../types/skland-import'

/**
 * 页面底部错误汇总
 *
 * 逐条列出 游戏 / 失败阶段 / 错误码 / 后端原始原因；
 * 明确写明「不会自动重试、也没有重试按钮」，避免用户空等。
 */
defineProps<{
  errors: SklandImportError[]
  sessionError: string
}>()
</script>

<template>
  <section v-if="sessionError || errors.length" class="si-footer" aria-live="polite">
    <div class="si-footer-head">
      <strong>导入未全部完成</strong>
    </div>

    <p v-if="sessionError" class="si-error" role="alert">{{ sessionError }}</p>

    <div v-for="(error, index) in errors" :key="`${error.game}-${error.stage}-${index}`" class="si-error-row">
      <span class="si-confirm-game">{{ gameLabel(error.game) }}</span>
      <span class="si-error-stage">{{ stageLabel(error.stage) }}</span>
      <span class="si-error-message">
        {{ error.message }}
        <span v-if="error.code !== undefined" class="si-error-code">（code {{ error.code }}）</span>
      </span>
    </div>
  </section>
</template>
