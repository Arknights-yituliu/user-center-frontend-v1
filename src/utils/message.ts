/** 消息气泡基础样式（页面顶部居中悬浮，带淡入淡出与位移过渡） */
const baseStyle: Record<string, string> = {
  opacity: '0',
  width: 'fit-content',
  borderRadius: '4px',
  lineHeight: '24px',
  padding: '4px 12px',
  textAlign: 'center',
  position: 'fixed',
  top: '0px',
  fontSize: '14px',
  display: 'flex',
  left: '50%',
  margin: 'auto',
  fontWeight: '600',
  zIndex: '3000',
  transition: 'opacity 0.3s, top 0.5s',
  transform: 'translate(-50%)',
  border: '1px solid #a8ffc1',
}

/** 各消息类型对应的颜色样式 */
const colorStyle: Record<string, Record<string, string>> = {
  success: {
    color: '#4CAF50',
    background: '#ecf6ed',
    borderColor: '#4CAF50',
  },
  warn: {
    color: '#fc7303',
    background: '#fcf6ed',
    borderColor: '#ffc885',
  },
  // 与 warn 相同样式（部分页面传入 type=warning）
  warning: {
    color: '#fc7303',
    background: '#fcf6ed',
    borderColor: '#ffc885',
  },
  error: {
    color: '#FF4E4EFF',
    background: '#f8ecec',
    borderColor: '#ffc5c5',
  },
  info: {
    color: '#2196F3',
    background: '#f2f9fd',
    borderColor: '#bee9ff',
  },
}

let send = 1
let messageBars: string[] = []

/** 重新计算所有存活消息的垂直排布（每条向下堆叠 50px） */
function relayoutMessages(): void {
  messageBars.forEach((barId, index) => {
    const bar = document.getElementById(barId)
    if (bar) {
      bar.style.top = 20 + index * 50 + 'px'
    }
  })
}

/** 消息配置 */
interface MessageConfig {
  /** 消息内容 */
  text: string
  /** 消息类型：success/warn(warning)/error/info，默认 info */
  type?: string
  /** 持续时间（毫秒），默认 4000 */
  duration?: number
}

/**
 * 消息渲染的统一实现：创建元素、套用色板、淡入淡出并在到期后销毁
 * @param text 消息内容
 * @param type 消息类型，取 colorStyle 的键：success / warn(warning) / error / info
 * @param duration 持续时间（毫秒），未传或传 0 时取 4000
 */
function showMessage(text: string, type?: string, duration?: number): void {
  const stay = duration || 4000

  send++

  // 创建一个 message 元素
  const messageBar = document.createElement('div')

  // 赋予 message 元素基础样式
  Object.assign(messageBar.style, baseStyle)

  // 赋予 message 元素的类型颜色样式（type 非法时跳过，保持基础样式）
  const typeStyle = colorStyle[type ?? '']
  if (typeStyle) {
    Object.assign(messageBar.style, typeStyle)
  }

  // 赋予 message 元素独立 id 并登记到存活列表
  messageBar.id = 'messageBar' + send
  messageBars.push(messageBar.id)

  // 向 message 元素写入文本并挂载到页面
  messageBar.textContent = text
  document.body.appendChild(messageBar)

  // 淡入，并重新排布所有消息的位置
  setTimeout(() => {
    messageBar.style.opacity = '1'
    relayoutMessages()
  }, 16)

  // 在消息消失前 300ms 开始淡出，与 transition 保持一致
  setTimeout(() => {
    messageBar.style.opacity = '0'
  }, stay - 300)

  // 持续时间结束后销毁元素，并按 id 精确移除（各条 duration 可不同），剩余消息上移补位
  setTimeout(() => {
    messageBar.remove()
    messageBars = messageBars.filter((barId) => barId !== messageBar.id)
    relayoutMessages()
  }, stay)
}

/**
 * 对象入参形式的消息提示
 * @param config 消息配置 { text: 消息内容, type: 消息类型, duration: 持续时间 }
 */
function createMessage(config: MessageConfig): void {
  showMessage(config.text, config.type || 'info', config.duration)
}

/**
 * 位置参数形式的消息提示
 * @param text 消息内容
 * @param type 消息类型，取 colorStyle 的键：success / warn(warning) / error / info，默认 success
 * @param duration 持续时间（毫秒），默认 4000
 */
function cMessage(text: string, type = 'success', duration = 4000): void {
  showMessage(text, type, duration)
}

export { cMessage, createMessage }
