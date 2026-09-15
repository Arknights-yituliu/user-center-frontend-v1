<script setup lang="ts">
import { computed } from 'vue'

type HeaderThemeKey =
  | 'surface'
  | 'line'
  | 'ink'
  | 'muted'
  | 'primary'
  | 'secondary'
  | 'highlight'
  | 'warm'
  | 'shadow'

type HeaderTheme = Partial<Record<HeaderThemeKey, string>>

interface Props {
  titleId?: string
  kicker: string
  titleA: string
  titleB?: string
  titleSuffix?: string
  description?: string
  visualTop?: string
  visualBottom?: string
  visualIndex?: string
  visualIcon?: string
  visualIndexText?: boolean
  theme?: HeaderTheme
}

const props = withDefaults(defineProps<Props>(), {
  titleId: 'secondary-page-title',
})

const headerStyle = computed(() => {
  const theme = props.theme ?? {}

  return {
    '--module-surface': theme.surface ?? 'var(--site-surface)',
    '--module-line': theme.line ?? theme.ink ?? 'var(--site-ink)',
    '--module-ink': theme.ink ?? 'var(--site-ink)',
    '--module-muted': theme.muted ?? 'var(--site-muted)',
    '--module-primary': theme.primary ?? 'var(--site-accent)',
    '--module-secondary': theme.secondary ?? 'var(--site-cyan)',
    '--module-highlight': theme.highlight ?? 'var(--site-pink)',
    '--module-warm': theme.warm ?? 'var(--site-warm)',
    '--module-shadow': theme.shadow ?? theme.secondary ?? 'var(--site-cyan)',
  } as Record<string, string>
})
</script>

<template>
  <header
    class="secondary-page-header"
    :style="headerStyle"
    :aria-labelledby="titleId"
  >
    <div class="secondary-page-header-copy">
      <p class="secondary-page-header-kicker">
        <span aria-hidden="true"></span>
        {{ kicker }}
      </p>
      <h1 :id="titleId">
        <span class="secondary-page-header-line secondary-page-header-line-a">{{ titleA }}</span>
        <span v-if="titleB" class="secondary-page-header-line secondary-page-header-line-b">
          <em>{{ titleB }}</em>{{ titleSuffix }}
        </span>
      </h1>
      <p v-if="description" class="secondary-page-header-description">
        {{ description }}
      </p>
    </div>

    <div
      v-if="$slots.visual"
      class="secondary-page-header-visual secondary-page-header-visual-custom"
      aria-hidden="true"
    >
      <slot name="visual"></slot>
    </div>
    <div v-else class="secondary-page-header-visual" aria-hidden="true">
      <span v-if="visualTop" class="secondary-page-header-visual-label secondary-page-header-visual-label-top">
        {{ visualTop }}
      </span>
      <span class="secondary-page-header-visual-rule secondary-page-header-visual-rule-horizontal"></span>
      <span class="secondary-page-header-visual-rule secondary-page-header-visual-rule-vertical"></span>
      <span class="secondary-page-header-visual-marker secondary-page-header-visual-marker-primary"></span>
      <span class="secondary-page-header-visual-marker secondary-page-header-visual-marker-secondary"></span>
      <span class="secondary-page-header-visual-marker secondary-page-header-visual-marker-highlight"></span>
      <span
        v-if="visualIndex"
        class="secondary-page-header-visual-index"
        :class="{ 'secondary-page-header-visual-index-label': visualIndexText }"
      >
        {{ visualIndex }}
      </span>
      <span v-else-if="visualIcon" class="secondary-page-header-visual-icon">
        <v-icon :icon="visualIcon" size="42"></v-icon>
      </span>
      <span
        v-if="visualBottom"
        class="secondary-page-header-visual-label secondary-page-header-visual-label-bottom"
      >
        {{ visualBottom }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.secondary-page-header {
  --module-surface: var(--site-surface);
  --module-line: var(--site-ink);
  --module-ink: var(--site-ink);
  --module-muted: var(--site-muted);
  --module-primary: var(--site-accent);
  --module-secondary: var(--site-cyan);
  --module-highlight: var(--site-pink);
  --module-warm: var(--site-warm);
  --module-shadow: var(--site-cyan);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 0.58fr);
  gap: 64px;
  align-items: stretch;
  min-height: 320px;
  padding: 30px 52px 34px;
  border: 1px solid var(--module-line);
  border-left: 10px solid var(--module-primary);
  background: var(--module-surface);
  box-shadow: 12px 12px 0 var(--module-shadow);
}

.secondary-page-header-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  transform: translateY(-10px);
}

.secondary-page-header-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: var(--module-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
  line-height: 1.4;
}

.secondary-page-header-kicker span {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  background: var(--module-highlight);
}

.secondary-page-header h1 {
  max-width: 650px;
  margin: 18px 0 0;
  color: var(--module-ink);
  font-size: 52px;
  font-weight: 650;
  letter-spacing: -0.06em;
  line-height: 0.98;
}

.secondary-page-header-line {
  display: block;
}

.secondary-page-header h1 em {
  color: var(--module-primary);
  font-style: normal;
}

.secondary-page-header-description {
  max-width: 430px;
  margin: 24px 0 0;
  color: var(--module-muted);
  font-size: 18px;
  line-height: 1.65;
}

.secondary-page-header-visual {
  position: relative;
  min-height: 250px;
  align-self: center;
}

.secondary-page-header-visual-label {
  position: absolute;
  color: var(--module-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.secondary-page-header-visual-label-top {
  top: 8px;
  left: 0;
}

.secondary-page-header-visual-label-bottom {
  right: 0;
  bottom: 5px;
}

.secondary-page-header-visual-rule {
  position: absolute;
  display: block;
  background: var(--module-primary);
  opacity: 0.32;
}

.secondary-page-header-visual-rule-horizontal {
  top: 50%;
  right: 0;
  left: 4%;
  height: 1px;
}

.secondary-page-header-visual-rule-vertical {
  top: 14%;
  bottom: 12%;
  left: 43%;
  width: 1px;
  background: var(--module-highlight);
}

.secondary-page-header-visual-marker {
  position: absolute;
  display: block;
  width: 10px;
  height: 10px;
  border: 1px solid var(--module-line);
  background: var(--module-surface);
}

.secondary-page-header-visual-marker-primary {
  top: 27%;
  left: 20%;
  background: var(--module-primary);
}

.secondary-page-header-visual-marker-secondary {
  top: 50%;
  right: 22%;
  background: var(--module-secondary);
}

.secondary-page-header-visual-marker-highlight {
  bottom: 21%;
  left: 43%;
  background: var(--module-highlight);
}

.secondary-page-header-visual-index {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 132px;
  height: 132px;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--module-line);
  background: var(--module-primary);
  box-shadow: 12px 12px 0 var(--module-highlight);
  color: var(--module-surface);
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.secondary-page-header-visual-index-label {
  padding: 12px;
  font-size: 22px;
  line-height: 1.2;
  text-align: center;
}

.secondary-page-header-visual-icon {
  position: absolute;
  top: 50%;
  left: 43%;
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 1px solid var(--module-line);
  background: var(--module-warm);
  color: var(--module-line);
}

@media (max-width: 820px) {
  .secondary-page-header {
    grid-template-columns: 1fr;
    gap: 34px;
    min-height: 0;
    padding: 34px 30px 38px;
  }

  .secondary-page-header-visual {
    min-height: 220px;
  }
}

@media (max-width: 520px) {
  .secondary-page-header {
    gap: 26px;
    padding: 26px 20px 30px;
    box-shadow: 8px 8px 0 var(--module-shadow);
  }

  .secondary-page-header-copy {
    transform: translateY(-6px);
  }

  .secondary-page-header h1 {
    font-size: 42px;
  }

  .secondary-page-header-description {
    font-size: 15px;
  }

  .secondary-page-header-visual {
    min-height: 190px;
  }

  .secondary-page-header-visual-index {
    width: 108px;
    height: 108px;
    font-size: 46px;
  }
}
</style>
