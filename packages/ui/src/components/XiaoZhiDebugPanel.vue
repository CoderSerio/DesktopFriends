<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useXiaoZhi, type XiaoZhiConfig, type XiaoZhiMessage } from '@desktopfriends/core'
import MdCard from './ui/MdCard.vue'
import MdInput from './ui/MdInput.vue'
import MdButton from './ui/MdButton.vue'
import MdSwitch from './ui/MdSwitch.vue'

const props = defineProps<{
  /** 初始配置 */
  initialConfig?: Partial<XiaoZhiConfig>
  /** 是否显示高级选项 */
  showAdvanced?: boolean
}>()

const emit = defineEmits<{
  connected: [sessionId: string]
  disconnected: []
  stt: [text: string]
  llm: [text: string]
  error: [error: Error]
}>()

// XiaoZhi composable
const xiaozhi = useXiaoZhi(props.initialConfig)

// 配置表单
const otaUrl = ref(xiaozhi.config.value.otaUrl)
const deviceMac = ref(xiaozhi.config.value.deviceMac)
const deviceName = ref(xiaozhi.config.value.deviceName || '')
const clientId = ref(xiaozhi.config.value.clientId || '')

// 调试状态
const testMessage = ref('')
const autoScroll = ref(true)
const showRawMessages = ref(false)

// 消息日志
interface LogEntry {
  id: number
  time: string
  type: 'info' | 'send' | 'receive' | 'error' | 'stt' | 'llm' | 'tts'
  content: string
  raw?: unknown
}
const logs = ref<LogEntry[]>([])
let logId = 0

// 状态计算
const statusText = computed(() => {
  switch (xiaozhi.status.value) {
    case 'DISCONNECTED':
      return '未连接'
    case 'CONNECTING':
      return '连接中...'
    case 'CONNECTED':
      return '已连接'
    case 'BINDING_REQUIRED':
      return '需要绑定'
    default:
      return '未知'
  }
})

const statusColor = computed(() => {
  switch (xiaozhi.status.value) {
    case 'CONNECTED':
      return '#4caf50'
    case 'CONNECTING':
      return '#ff9800'
    case 'BINDING_REQUIRED':
      return '#2196f3'
    default:
      return '#9e9e9e'
  }
})

// 添加日志
const addLog = (
  type: LogEntry['type'],
  content: string,
  raw?: unknown
) => {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.push({
    id: logId++,
    time,
    type,
    content,
    raw,
  })

  // 限制日志数量
  if (logs.value.length > 200) {
    logs.value = logs.value.slice(-100)
  }
}

// 连接
const handleConnect = async () => {
  // 更新配置
  xiaozhi.setConfig({
    otaUrl: otaUrl.value,
    deviceMac: deviceMac.value,
    deviceName: deviceName.value,
    clientId: clientId.value,
  })

  addLog('info', '正在连接到 XiaoZhi 服务器...')

  const result = await xiaozhi.connect()

  if (result.success) {
    addLog('info', `连接成功! SessionId: ${xiaozhi.sessionId.value}`)
    if (xiaozhi.sessionId.value) {
      emit('connected', xiaozhi.sessionId.value)
    }
  } else if (result.reason === 'binding_required') {
    addLog('info', `需要设备绑定，验证码: ${xiaozhi.bindingCode.value}`)
  } else {
    addLog('error', `连接失败: ${result.message}`)
    if (xiaozhi.error.value) {
      emit('error', xiaozhi.error.value)
    }
  }
}

// 断开连接
const handleDisconnect = () => {
  xiaozhi.disconnect()
  addLog('info', '已断开连接')
  emit('disconnected')
}

// 重试连接（绑定后）
const handleRetry = async () => {
  addLog('info', '正在重试连接...')
  const result = await xiaozhi.retryConnect()

  if (result.success) {
    addLog('info', `连接成功! SessionId: ${xiaozhi.sessionId.value}`)
    if (xiaozhi.sessionId.value) {
      emit('connected', xiaozhi.sessionId.value)
    }
  } else {
    addLog('error', `连接失败: ${result.message}`)
  }
}

// 发送测试消息
const handleSendTest = () => {
  if (!testMessage.value.trim()) return

  const msg = testMessage.value.trim()
  if (xiaozhi.sendText(msg)) {
    addLog('send', msg)
    testMessage.value = ''
  } else {
    addLog('error', '发送失败: WebSocket 未连接')
  }
}

// 清空日志
const clearLogs = () => {
  logs.value = []
}

// 注册事件监听
const unsubscribers: Array<() => void> = []

unsubscribers.push(
  xiaozhi.onSTT((text) => {
    addLog('stt', `语音识别: ${text}`)
    emit('stt', text)
  })
)

unsubscribers.push(
  xiaozhi.onLLM((text) => {
    addLog('llm', `AI回复: ${text}`)
    emit('llm', text)
  })
)

unsubscribers.push(
  xiaozhi.onTTS((msg) => {
    addLog('tts', `TTS: ${JSON.stringify(msg)}`, msg)
  })
)

unsubscribers.push(
  xiaozhi.onMessage((msg) => {
    if (showRawMessages.value) {
      addLog('receive', `[${msg.type}] ${JSON.stringify(msg)}`, msg)
    }
  })
)

unsubscribers.push(
  xiaozhi.onConnected((msg) => {
    addLog('info', `握手成功: ${JSON.stringify(msg)}`, msg)
  })
)

unsubscribers.push(
  xiaozhi.onAudio(() => {
    addLog('receive', '[音频数据]')
  })
)

// 监听错误
watch(
  () => xiaozhi.error.value,
  (err) => {
    if (err) {
      addLog('error', err.message)
    }
  }
)

// 清理
onUnmounted(() => {
  unsubscribers.forEach((unsub) => unsub())
  xiaozhi.disconnect()
})

// 暴露给父组件
defineExpose({
  xiaozhi,
  sendText: xiaozhi.sendText,
  connect: handleConnect,
  disconnect: handleDisconnect,
})
</script>

<template>
  <div class="xiaozhi-debug-panel">
    <!-- 连接配置 -->
    <MdCard title="XiaoZhi 连接配置">
      <div class="config-form">
        <MdInput v-model="otaUrl" label="OTA 服务器地址" />
        <MdInput v-model="deviceMac" label="设备 MAC 地址 (可选)" />

        <template v-if="showAdvanced">
          <MdInput v-model="deviceName" label="设备名称" />
          <MdInput v-model="clientId" label="客户端 ID" />
        </template>

        <div class="status-row">
          <span class="status-label">状态:</span>
          <span class="status-indicator" :style="{ background: statusColor }" />
          <span class="status-text">{{ statusText }}</span>
          <span v-if="xiaozhi.sessionId.value" class="session-id">
            ({{ xiaozhi.sessionId.value }})
          </span>
        </div>

        <!-- 绑定验证码 -->
        <div v-if="xiaozhi.status.value === 'BINDING_REQUIRED'" class="binding-info">
          <div class="binding-code">
            验证码: <strong>{{ xiaozhi.bindingCode.value }}</strong>
          </div>
          <p class="binding-hint">请在 XiaoZhi 后台管理界面输入此验证码完成设备绑定</p>
        </div>

        <div class="button-row">
          <MdButton
            v-if="xiaozhi.status.value === 'DISCONNECTED'"
            @click="handleConnect"
          >
            连接
          </MdButton>
          <MdButton
            v-else-if="xiaozhi.status.value === 'BINDING_REQUIRED'"
            @click="handleRetry"
          >
            绑定完成，重试连接
          </MdButton>
          <MdButton
            v-else-if="xiaozhi.status.value === 'CONNECTED'"
            @click="handleDisconnect"
          >
            断开连接
          </MdButton>
          <MdButton v-else disabled>
            连接中...
          </MdButton>
        </div>
      </div>
    </MdCard>

    <!-- 消息测试 -->
    <MdCard title="消息测试" v-if="xiaozhi.isConnected.value">
      <div class="test-form">
        <div class="test-input-row">
          <input
            v-model="testMessage"
            type="text"
            class="test-input"
            placeholder="输入测试消息..."
            @keyup.enter="handleSendTest"
          />
          <MdButton @click="handleSendTest" :disabled="!testMessage.trim()">
            发送
          </MdButton>
        </div>
      </div>
    </MdCard>

    <!-- 消息日志 -->
    <MdCard title="消息日志">
      <div class="log-controls">
        <MdSwitch v-model="autoScroll" label="自动滚动" />
        <MdSwitch v-model="showRawMessages" label="显示原始消息" />
        <MdButton @click="clearLogs">清空日志</MdButton>
      </div>

      <div class="log-container" :class="{ 'auto-scroll': autoScroll }">
        <div
          v-for="log in logs"
          :key="log.id"
          class="log-entry"
          :class="log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-type">[{{ log.type.toUpperCase() }}]</span>
          <span class="log-content">{{ log.content }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">
          暂无日志
        </div>
      </div>
    </MdCard>
  </div>
</template>

<style scoped>
.xiaozhi-debug-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.status-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: background 0.3s ease;
}

.status-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.session-id {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: monospace;
}

.binding-info {
  background: rgba(33, 150, 243, 0.15);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.binding-code {
  font-size: 18px;
  color: white;
  text-align: center;
  margin-bottom: 8px;
}

.binding-code strong {
  color: #2196f3;
  font-size: 24px;
  letter-spacing: 4px;
}

.binding-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  margin: 0;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.test-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-input-row {
  display: flex;
  gap: 8px;
}

.test-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: white;
  outline: none;
  transition: background 0.2s ease;
}

.test-input:focus {
  background: rgba(255, 255, 255, 0.12);
}

.test-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.log-container {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.log-container.auto-scroll {
  scroll-behavior: smooth;
}

.log-entry {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.log-type {
  flex-shrink: 0;
  font-weight: 600;
}

.log-content {
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
}

/* 日志类型颜色 */
.log-entry.info .log-type {
  color: #64b5f6;
}

.log-entry.send .log-type {
  color: #81c784;
}

.log-entry.receive .log-type {
  color: #ba68c8;
}

.log-entry.error .log-type {
  color: #ef5350;
}

.log-entry.error .log-content {
  color: #ef5350;
}

.log-entry.stt .log-type {
  color: #4fc3f7;
}

.log-entry.llm .log-type {
  color: #ffb74d;
}

.log-entry.tts .log-type {
  color: #aed581;
}

.log-empty {
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 24px;
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-track {
  background: transparent;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
