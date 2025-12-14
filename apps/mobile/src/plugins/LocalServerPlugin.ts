import { registerPlugin } from '@capacitor/core'

export interface LocalServerPlugin {
  /**
   * 启动本地服务器
   */
  startServer(options: { port: number }): Promise<{ success: boolean; port: number; ip: string; error?: string }>

  /**
   * 停止本地服务器
   */
  stopServer(): Promise<{ success: boolean }>

  /**
   * 获取服务器状态
   */
  getStatus(): Promise<{
    running: boolean
    port: number
    ip: string
    connectedClients: number
  }>

  /**
   * 获取本机 IP 地址
   */
  getLocalIP(): Promise<{ ip: string }>

  /**
   * 广播消息给所有连接的客户端
   */
  broadcast(options: { event: string; data: string }): Promise<{ success: boolean }>

  /**
   * 添加事件监听器
   */
  addListener(
    eventName: 'clientConnected' | 'clientDisconnected' | 'messageReceived',
    listenerFunc: (data: any) => void
  ): Promise<{ remove: () => Promise<void> }>
}

// 注册插件
const LocalServer = registerPlugin<LocalServerPlugin>('LocalServer', {
  web: () => import('./LocalServerWeb').then(m => new m.LocalServerWeb()),
})

export default LocalServer
