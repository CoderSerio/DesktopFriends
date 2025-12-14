import type { Server, Socket } from 'socket.io'
import type {
  PetInfo,
  PetMessage,
  PetAction,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@desktopfriends/shared'

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  onlinePets: Map<string, PetInfo>
) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`🐾 Pet connected: ${socket.id}`)

    // 宠物注册
    socket.on('pet:register', (info: Omit<PetInfo, 'id' | 'joinedAt'>) => {
      const petInfo: PetInfo = {
        ...info,
        id: socket.id,
        joinedAt: new Date().toISOString(),
      }
      onlinePets.set(socket.id, petInfo)

      // 通知所有人新宠物上线
      io.emit('pet:online', petInfo)

      // 发送当前在线宠物列表给新加入的宠物
      socket.emit('pets:list', Array.from(onlinePets.values()))

      console.log(`✅ Pet registered: ${info.name} (${socket.id})`)
    })

    // 宠物间消息
    socket.on('pet:message', (message: Pick<PetMessage, 'content' | 'to' | 'toName' | 'messageType'>) => {
      const sender = onlinePets.get(socket.id)
      if (!sender) return

      // 获取目标宠物名称
      let toName = message.toName
      if (message.to && !toName) {
        const targetPet = onlinePets.get(message.to)
        if (targetPet) {
          toName = targetPet.name
        }
      }

      const baseMessage: PetMessage = {
        content: message.content,
        to: message.to,
        toName,
        messageType: message.messageType,
        from: sender.name,
        fromId: socket.id,
        timestamp: new Date().toISOString(),
      }

      // 发送给目标宠物（只收到原始消息内容）
      // 添加 isDirectTarget 标记，让客户端知道自己是直接目标
      if (message.to) {
        const targetSocket = io.sockets.sockets.get(message.to)
        if (targetSocket) {
          targetSocket.emit('pet:message', {
            ...baseMessage,
            isDirectTarget: true,  // 标记为直接目标
          })
        }
      }

      // 广播给其他宠物（不包括发送者和目标）
      // 其他宠物收到的消息不带 isDirectTarget 标记
      for (const [socketId, pet] of onlinePets) {
        // 跳过发送者
        if (socketId === socket.id) continue
        // 跳过目标（已单独发送）
        if (message.to && socketId === message.to) continue

        const otherSocket = io.sockets.sockets.get(socketId)
        if (otherSocket) {
          otherSocket.emit('pet:message', {
            ...baseMessage,
            isDirectTarget: false,  // 标记为非直接目标（旁观者）
          })
        }
      }

      console.log(`💬 ${sender.name}: ${message.content}`)
    })

    // 宠物动作同步（可选）
    socket.on('pet:action', (action: Omit<PetAction, 'petId' | 'petName'>) => {
      const sender = onlinePets.get(socket.id)
      if (!sender) return

      // 广播动作给其他宠物
      socket.broadcast.emit('pet:action', {
        ...action,
        petId: socket.id,
        petName: sender.name,
      })
    })

    // 断开连接
    socket.on('disconnect', () => {
      const pet = onlinePets.get(socket.id)
      if (pet) {
        onlinePets.delete(socket.id)
        io.emit('pet:offline', socket.id)
        console.log(`👋 Pet disconnected: ${pet.name} (${socket.id})`)
      }
    })
  })
}
