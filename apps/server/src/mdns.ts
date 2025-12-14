import BonjourService from 'bonjour-service'
import type { Service } from 'bonjour-service'
import os from 'os'

// 处理 ESM/CommonJS 兼容性
const Bonjour = (BonjourService as any).default || BonjourService

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bonjour: any = null
let publishedService: Service | null = null

// RemoteService 类型（bonjour-service 未导出）
interface RemoteService {
  name: string
  host: string
  port: number
  txt?: Record<string, string>
}

/**
 * 获取本机局域网 IP 地址
 */
export function getLocalIP(): string {
  const interfaces = os.networkInterfaces()

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // 跳过内部地址和 IPv6
      if (iface.internal || iface.family !== 'IPv4') continue
      // 返回第一个找到的局域网 IP
      if (iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          iface.address.startsWith('172.')) {
        return iface.address
      }
    }
  }

  return '127.0.0.1'
}

/**
 * 发布 mDNS 服务
 */
export function publishService(port: number, name?: string): Service | null {
  bonjour = new Bonjour()

  const serviceName = name || `DesktopFriends-${os.hostname()}`
  const localIP = getLocalIP()

  publishedService = bonjour.publish({
    name: serviceName,
    type: 'desktopfriends',  // 服务类型: _desktopfriends._tcp
    port: port,
    txt: {
      version: '1.0',
      ip: localIP,
    },
  })

  console.log(`📡 mDNS service published: ${serviceName}._desktopfriends._tcp`)
  console.log(`   Local IP: ${localIP}:${port}`)

  return publishedService
}

/**
 * 发现局域网内的 DesktopFriends 服务
 */
export function discoverServices(
  onFound: (service: { name: string; host: string; port: number; ip?: string }) => void,
  onRemoved?: (service: { name: string }) => void
): () => void {
  if (!bonjour) {
    bonjour = new Bonjour()
  }

  const browser = bonjour.find({ type: 'desktopfriends' })

  browser.on('up', (service: RemoteService) => {
    console.log(`🔍 Found service: ${service.name}`)
    onFound({
      name: service.name,
      host: service.host,
      port: service.port,
      ip: service.txt?.ip,
    })
  })

  if (onRemoved) {
    browser.on('down', (service: RemoteService) => {
      console.log(`❌ Service removed: ${service.name}`)
      onRemoved({ name: service.name })
    })
  }

  // 返回停止发现的函数
  return () => {
    browser.stop()
  }
}

/**
 * 取消发布服务
 */
export function unpublishService(): void {
  if (publishedService) {
    publishedService.stop?.()
    publishedService = null
  }
  if (bonjour) {
    bonjour.destroy()
    bonjour = null
  }
  console.log('📡 mDNS service unpublished')
}
