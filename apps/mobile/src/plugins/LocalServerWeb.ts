import type { LocalServerPlugin } from './LocalServerPlugin'

/**
 * Web 实现 - 用于浏览器测试
 * 注意：浏览器中无法真正运行服务器，这只是一个模拟实现
 */
export class LocalServerWeb implements LocalServerPlugin {
  private running = false
  private port = 3000
  private listeners: Map<string, Set<(data: any) => void>> = new Map()

  async startServer(options: { port: number }): Promise<{
    success: boolean
    port: number
    ip: string
    error?: string
  }> {
    // 浏览器环境无法运行真正的服务器
    // 返回错误提示用户需要在原生环境中运行
    console.warn('[LocalServerWeb] 浏览器环境无法运行服务器，请在 Android 设备上运行')

    return {
      success: false,
      port: options.port,
      ip: '127.0.0.1',
      error: '浏览器环境不支持运行服务器，请在手机上运行 APK',
    }
  }

  async stopServer(): Promise<{ success: boolean }> {
    this.running = false
    return { success: true }
  }

  async getStatus(): Promise<{
    running: boolean
    port: number
    ip: string
    connectedClients: number
  }> {
    return {
      running: this.running,
      port: this.port,
      ip: '127.0.0.1',
      connectedClients: 0,
    }
  }

  async getLocalIP(): Promise<{ ip: string }> {
    // 尝试使用 WebRTC 获取本机 IP
    try {
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc.close()
          resolve({ ip: '127.0.0.1' })
        }, 1000)

        pc.onicecandidate = (e) => {
          if (!e.candidate) return

          const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
          if (match && !match[1].startsWith('127.')) {
            clearTimeout(timeout)
            pc.close()
            resolve({ ip: match[1] })
          }
        }
      })
    } catch {
      return { ip: '127.0.0.1' }
    }
  }

  async broadcast(options: { event: string; data: string }): Promise<{ success: boolean }> {
    console.log('[LocalServerWeb] Broadcast:', options)
    return { success: false }
  }

  async addListener(
    eventName: 'clientConnected' | 'clientDisconnected' | 'messageReceived',
    listenerFunc: (data: any) => void
  ): Promise<{ remove: () => Promise<void> }> {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(listenerFunc)

    return {
      remove: async () => {
        this.listeners.get(eventName)?.delete(listenerFunc)
      },
    }
  }
}
