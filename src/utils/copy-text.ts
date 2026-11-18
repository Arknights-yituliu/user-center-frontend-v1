/**
 * 复制文本：优先使用现代 Clipboard API，失败后回退到浏览器兼容方案。
 * 该函数必须由用户操作触发，回退方案只在复制过程中短暂创建文本框。
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // 非安全上下文或浏览器拒绝现代 API 时继续尝试兼容方案。
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('CLIPBOARD_COPY_FAILED')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  let copied = false
  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    copied = document.execCommand('copy')
  } finally {
    textarea.remove()
  }

  if (!copied) throw new Error('CLIPBOARD_COPY_FAILED')
}
