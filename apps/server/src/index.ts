import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server } from 'socket.io'
import { setupSocketHandlers } from './socket.js'
import { publishService, unpublishService, getLocalIP } from './mdns.js'
import type { PetInfo, ServerToClientEvents, ClientToServerEvents } from '@desktopfriends/shared'

const DEFAULT_PORT = Number(process.env.PORT) || 3000
const MAX_PORT_ATTEMPTS = 10  // 最多尝试10个端口
const HOST = process.env.HOST || '0.0.0.0'

// 创建 Fastify 实例
const fastify = Fastify({
  logger: true,
})

// 注册 CORS
await fastify.register(cors, {
  origin: true,
})

// 创建 Socket.io 服务器
const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// 存储在线宠物
const onlinePets = new Map<string, PetInfo>()

// 设置 Socket 处理器
setupSocketHandlers(io, onlinePets)

// 实际使用的端口
let actualPort = DEFAULT_PORT

// 健康检查接口
fastify.get('/health', async () => {
  return { status: 'ok', pets: onlinePets.size }
})

// 获取在线宠物列表
fastify.get('/pets', async () => {
  return Array.from(onlinePets.values())
})

// 获取服务器信息（供移动端发现使用）
fastify.get('/info', async () => {
  return {
    name: 'DesktopFriends Server',
    version: '1.0',
    ip: getLocalIP(),
    port: actualPort,
    pets: onlinePets.size,
  }
})

// 尝试在指定端口启动，失败则递增端口
async function tryListen(port: number, attempts: number = 0): Promise<number> {
  if (attempts >= MAX_PORT_ATTEMPTS) {
    throw new Error(`无法找到可用端口 (尝试了 ${DEFAULT_PORT} - ${DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1})`)
  }

  try {
    await fastify.listen({ port, host: HOST })
    return port
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  端口 ${port} 已被占用，尝试端口 ${port + 1}...`)
      return tryListen(port + 1, attempts + 1)
    }
    throw err
  }
}

// 启动服务器
const start = async () => {
  try {
    actualPort = await tryListen(DEFAULT_PORT)
    console.log(`🚀 Server running at http://${HOST}:${actualPort}`)
    console.log(`📡 Socket.io ready for connections`)

    // 发布 mDNS 服务
    publishService(actualPort)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// 优雅关闭
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 收到 ${signal}，正在关闭服务...`)

  try {
    // 取消 mDNS 服务发布
    unpublishService()

    // 关闭所有 Socket 连接
    io.close()

    // 关闭 Fastify 服务器
    await fastify.close()

    console.log('✅ 服务已安全关闭')
    process.exit(0)
  } catch (err) {
    console.error('❌ 关闭时发生错误:', err)
    process.exit(1)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err)
  gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason)
})

start()
