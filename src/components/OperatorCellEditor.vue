<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 干员练度单元格编辑器。
 *
 * 点击图标或数值打开一图流样式的悬浮菜单，选中后只更新父组件的本地草稿。
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
  kind?: 'level' | 'elite' | 'skill' | 'module' | 'main-skill'
  label?: string
  /**
   * 展示形态：
   * - text（默认）：直接显示数值，点击数值编辑
   * - overlay：默认插槽的图标作为菜单触发区域，编辑时保留图标
   */
  variant?: 'text' | 'overlay'
}>()

const emit = defineEmits<{ commit: [value: number] }>()

const editing = ref(false)
const menuRef = ref<HTMLElement | null>(null)

/** 可选值序列：min ~ max */
const options = computed(() => {
  return Array.from({ length: props.max - props.min + 1 }, (_, index) => {
    const value = props.min + index
    const prefix = { level: '等级', skill: '专精', module: '模组', 'main-skill': '技能等级' }
    const label =
      props.kind === 'elite'
        ? ['精零', '精一', '精二'][value] || String(value)
        : props.kind
          ? `${prefix[props.kind]} ${value}`
          : String(value)
    return { value, label }
  })
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) editing.value = false
  },
)

/** 同值不产生草稿变更，禁用时不接受选项。 */
function commit(value: number): void {
  if (props.disabled) return
  editing.value = false
  if (value !== props.value) emit('commit', value)
}

function focusSelectedOption(): void {
  const target =
    menuRef.value?.querySelector<HTMLElement>('[aria-checked="true"]') ||
    menuRef.value?.querySelector<HTMLElement>('button')
  target?.scrollIntoView({ block: 'nearest' })
  target?.focus({ preventScroll: true })
}

function navigate(event: KeyboardEvent): void {
  const buttons = Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('button') || [])
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let index: number
  if (event.key === 'ArrowDown') index = (current + 1) % buttons.length
  else if (event.key === 'ArrowUp') index = (current - 1 + buttons.length) % buttons.length
  else if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = buttons.length - 1
  else return
  event.preventDefault()
  buttons[index]?.focus()
}
</script>

<template>
  <v-menu
    v-model="editing"
    :disabled="disabled"
    location="bottom start"
    :offset="4"
    scroll-strategy="close"
    @after-enter="focusSelectedOption"
  >
    <template #activator="{ props: activatorProps }">
      <button
        v-bind="activatorProps"
        :class="variant === 'overlay' ? 'operator-cell-trigger' : 'operator-cell-value'"
        type="button"
        :disabled="disabled"
        :aria-label="label || '修改数值'"
        :title="disabled ? '' : label || '点击修改'"
      >
        <slot v-if="variant === 'overlay'">{{ value }}</slot>
        <template v-else>{{ value }}</template>
      </button>
    </template>
    <div
      ref="menuRef"
      class="operator-cell-menu"
      role="menu"
      :aria-label="label || '选择数值'"
      @keydown="navigate"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="option.value === value"
        :class="[
          'operator-cell-menu-item',
          { 'operator-cell-menu-item--active': option.value === value },
        ]"
        @click="commit(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </v-menu>
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

.operator-cell-trigger:disabled,
.operator-cell-value:disabled {
  cursor: default;
}

/* 与一图流的图标编辑菜单保持相同的尺寸、圆角和选中态。 */
.operator-cell-menu {
  min-width: 140px;
  max-height: min(280px, calc(100dvh - 16px));
  padding: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgb(var(--v-theme-on-surface) / 12%);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 18px rgb(var(--v-theme-on-surface) / 18%);
}

.operator-cell-menu-item {
  display: block;
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.operator-cell-menu-item:hover,
.operator-cell-menu-item:focus-visible {
  background: rgb(var(--v-theme-primary) / 12%);
  outline: none;
}

.operator-cell-menu-item--active {
  background: rgb(var(--v-theme-primary) / 16%);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
</style>
