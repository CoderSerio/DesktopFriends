import type { CapacitorConfig } from '@capacitor/cli'
import type { KeyboardResize } from '@capacitor/keyboard'

const config: CapacitorConfig = {
  appId: 'com.desktopfriends.app',
  appName: 'DesktopFriends',
  webDir: 'dist',
  server: {
    androidScheme: 'http', // 使用 HTTP 避免 Mixed Content 问题
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#00000000', // 透明背景
  },
  plugins: {
    Keyboard: {
      // 键盘弹出时调整 WebView 大小
      resize: 'body' as KeyboardResize,
      // 键盘弹出时滚动到焦点元素
      scrollAssist: true,
      scrollPadding: true,
    },
  },
}

export default config
