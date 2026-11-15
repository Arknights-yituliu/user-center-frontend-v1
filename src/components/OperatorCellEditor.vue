<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

/**
 * 干员练度单元格编辑器。
 *
 * 默认展示当前数值；点击后切换成下拉选择（取值 min~max 的整数），
 * 选中即提交、失焦取消，避免直接输入非法值。
 */
const props = defineProps<{
  /** 当前值 */
  value: number
  /** 允许的最小值 */
  min: number
  /** 允许的最大值 */
  max: number
  /** 只读（如未登录或保存中） */
  disabled?: boolean
  /**
   * 展示形态：
   * - text（默认）：直接显示数值，点击数值编辑
   * - overlay：不显示数值，用默认插槽的内容（如技能/模组图标）作为点击区域，编辑时换成下拉框
   */
  variant?: 'text' | 'overlay'
}>()

const emit = defineEmits<{ commit: [value: number] }>()

const editing = ref(false)
const draft = ref(props.value)
const selectRef = ref<HTMLSelectElement | null>(null)

/** 可选值序列：min ~ max */
const options = computed(() => {
  const list: number[] = []
  for (let value = props.min; value <= props.max; value += 1) list.push(value)
  return list
})

/** 进入编辑态并把焦点交给下拉框 */
async function startEditing(): Promise<void> {
  if (props.disabled) return
  draft.value = props.value
  editing.value = true
  await nextTick()
  selectRef.value?.focus()
}

/** 提交变更（值没变则不触发保存） */
function commit(): void {
  editing.value = false
  if (draft.value !== props.value) emit('commit', draft.value)
}

/** 退出编辑态，不保存 */
function cancel(): void {
  editing.value = false
}
</script>

<template>
  <select
    v-if="editing"
    ref="selectRef"
    v-model.number="draft"
    class="operator-cell-select"
    @change="commit"
    @blur="cancel"
    @keyup.esc="cancel"
  >
    <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
  </select>
  <button
    v-else-if="variant === 'overlay'"
    class="operator-cell-trigger"
    type="button"
    :disabled="disabled"
    :title="disabled ? '' : '点击修改'"
    @click="startEditing"
  >
    <slot>{{ value }}</slot>
  </button>
  <button
    v-else
    class="operator-cell-value"
    type="button"
    :disabled="disabled"
    :title="disabled ? '' : '点击修改'"
    @click="startEditing"
  >
    {{ value }}
  </button>
</template>

<style scoped>
.operator-cell-value {
  min-width: 28px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.operator-cell-value:hover:not(:disabled),
.operator-cell-value:focus-visible:not(:disabled) {
  border-color: var(--site-accent);
  background: var(--site-accent-soft);
  color: var(--site-accent);
  outline: none;
}

/* 图标形态：点击区域就是图标本身，hover 时给一圈高亮提示可改 */
.operator-cell-trigger {
  display: inline-flex;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.operator-cell-trigger:hover:not(:disabled),
.operator-cell-trigger:focus-visible:not(:disabled) {
  box-shadow: 0 0 0 2px var(--site-accent);
  outline: none;
}

.operator-cell-trigger:disabled {
  cursor: default;
  opacity: 0.75;
}

.operator-cell-value:disabled {
  cursor: default;
  opacity: 0.7;
}

.operator-cell-select {
  min-width: 56px;
  height: 26px;
  padding: 0 4px;
  border: 1px solid var(--site-accent);
  border-radius: 4px;
  background: var(--site-surface);
  color: var(--site-ink);
  cursor: pointer;
  font: inherit;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
</style>
