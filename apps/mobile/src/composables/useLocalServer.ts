import { ref, computed, onUnmounted } from 'vue'
import LocalServer from '../plugins/LocalServerPlugin'

export interface LocalServerState {
  isRunning: boolean
  port: number
  ip: string
  url: string
  error: string | null
  connectedClients: number
}

// 全局状态
const serverState = ref<LocalServerState>({
  isRunning: false,
  port: 3000,
  ip: '',
  url: '',
  error: null,
  connectedClients: 0,
})

// 检测运行环境
const detectEnvironment = () => {
  // 检测是否在 Capacitor 原生环境
  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.()

  // 检测是否在 Electron 环境
  const isElectron = !!(window as any).electron || navigator.userAgent.includes('Electron')

  // 检测是否在开发环境
  const isDev = import.meta.env.DEV

  return {
    isCapacitor,
    isElectron,
    isDev,
    canRunServer: isCapacitor || isElectron, // Capacitor 和 Electron 环境都可以运行服务器
    platform: isCapacitor ? 'mobile' : (isElectron ? 'electron' : 'web'),
  }
}

// 事件监听器清理函数
let clientConnectedListener: { remove: () => Promise<void> } | null = null
let clientDisconnectedListener: { remove: () => Promise<void> } | null = null
let messageReceivedListener: { remove: () => Promise<void> } | null = null

export function useLocalServer() {
  const environment = detectEnvironment()

  // 计算属性
  const isRunning = computed(() => serverState.value.isRunning)
  const serverUrl = computed(() => serverState.value.url)
  const serverError = computed(() => serverState.value.error)
  const connectedClients = computed(() => serverState.value.connectedClients)

  // 获取本机 IP
  const getLocalIP = async (): Promise<string> => {
    try {
      const result = await LocalServer.getLocalIP()
      return result.ip
    } catch {
      // 降级到 WebRTC 方式
      return getLocalIPViaWebRTC()
    }
  }

  // 通过 WebRTC 获取本机 IP（备用方案）
  const getLocalIPViaWebRTC = async (): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({ iceServers: [] })
        pc.createDataChannel('')

        pc.createOffer().then(offer => pc.setLocalDescription(offer))

        const timeout = setTimeout(() => {
          pc.close()
          resolve('127.0.0.1')
        }, 1000)

        pc.onicecandidate = (e) => {
          if (!e.candidate) return

          const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
          if (match && !match[1].startsWith('127.')) {
            clearTimeout(timeout)
            pc.close()
            resolve(match[1])
          }
        }
      } catch {
        resolve('127.0.0.1')
      }
    })
  }

  // 启动服务器
  const startServer = async (port: number = 3000): Promise<boolean> => {
    if (!environment.canRunServer) {
      serverState.value.error = '当前环境不支持运行服务器'
      return false
    }

    serverState.value.error = null

    try {
      const result = await LocalServer.startServer({ port })

      if (result.success) {
        serverState.value = {
          isRunning: true,
          port: result.port,
          ip: result.ip,
          url: `http://${result.ip}:${result.port}`,
          error: null,
          connectedClients: 0,
        }

        // 设置事件监听器
        await setupEventListeners()

        return true
      } else {
        serverState.value.error = result.error || '启动失败'
        return false
      }
    } catch (e) {
      serverState.value.error = e instanceof Error ? e.message : '启动失败'
      return false
    }
  }

  // 停止服务器
  const stopServer = async (): Promise<boolean> => {
    try {
      await LocalServer.stopServer()

      // 清理事件监听器
      await cleanupEventListeners()

      serverState.value = {
        isRunning: false,
        port: 3000,
        ip: '',
        url: '',
        error: null,
        connectedClients: 0,
      }
      return true
    } catch (e) {
      serverState.value.error = e instanceof Error ? e.message : '停止失败'
      return false
    }
  }

  // 获取服务器状态
  const getStatus = async () => {
    try {
      const status = await LocalServer.getStatus()
      serverState.value.isRunning = status.running
      serverState.value.port = status.port
      serverState.value.ip = status.ip
      serverState.value.connectedClients = status.connectedClients
      if (status.running) {
        serverState.value.url = `http://${status.ip}:${status.port}`
      }
      return status
    } catch {
      return null
    }
  }

  // 广播消息
  const broadcast = async (event: string, data: any): Promise<boolean> => {
    try {
      const result = await LocalServer.broadcast({
        event,
        data: JSON.stringify(data),
      })
      return result.success
    } catch {
      return false
    }
  }

  // 设置事件监听器
  const setupEventListeners = async () => {
    try {
      clientConnectedListener = await LocalServer.addListener('clientConnected', (data) => {
        console.log('[LocalServer] Client connected:', data)
        serverState.value.connectedClients++
      })

      clientDisconnectedListener = await LocalServer.addListener('clientDisconnected', (data) => {
        console.log('[LocalServer] Client disconnected:', data)
        serverState.value.connectedClients = Math.max(0, serverState.value.connectedClients - 1)
      })

      messageReceivedListener = await LocalServer.addListener('messageReceived', (data) => {
        console.log('[LocalServer] Message received:', data)
      })
    } catch (e) {
      console.error('[LocalServer] Failed to setup event listeners:', e)
    }
  }

  // 清理事件监听器
  const cleanupEventListeners = async () => {
    try {
      await clientConnectedListener?.remove()
      await clientDisconnectedListener?.remove()
      await messageReceivedListener?.remove()
      clientConnectedListener = null
      clientDisconnectedListener = null
      messageReceivedListener = null
    } catch (e) {
      console.error('[LocalServer] Failed to cleanup event listeners:', e)
    }
  }

  // 生成启动命令（用于非原生环境的提示）
  const getStartCommand = () => {
    return 'cd apps/server && pnpm start'
  }

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    }
  }

  // 组件卸载时不停止服务器（保持运行）
  // 只清理事件监听器
  onUnmounted(() => {
    // 不调用 stopServer，让服务器继续运行
  })

  return {
    // 状态
    isRunning,
    serverUrl,
    serverError,
    serverState,
    environment,
    connectedClients,

    // 方法
    startServer,
    stopServer,
    getStatus,
    broadcast,
    getStartCommand,
    getLocalIP,
    copyToClipboard,
  }
}
