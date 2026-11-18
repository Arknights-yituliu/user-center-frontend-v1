/**
 * 隐藏 Token 中间约三分之一，保留首尾内容用于辨认。
 */
export function maskTokenMiddle(token: string): string {
  if (!token) return ''
  if (token.length <= 2) return '*'.repeat(token.length)

  const maskedLength = Math.max(1, Math.round(token.length / 3))
  const visibleLength = token.length - maskedLength
  const prefixLength = Math.ceil(visibleLength / 2)
  const suffixLength = visibleLength - prefixLength

  return `${token.slice(0, prefixLength)}${'*'.repeat(maskedLength)}${token.slice(-suffixLength)}`
}
