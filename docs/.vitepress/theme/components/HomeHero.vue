<script setup lang="ts">
import { onMounted, ref } from 'vue'

const stars = ref<Array<{ id: number; style: Record<string, string> }>>([])

onMounted(() => {
  // 生成星星
  const starCount = 50
  for (let i = 0; i < starCount; i++) {
    stars.value.push({
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        '--duration': `${2 + Math.random() * 4}s`,
        '--opacity': `${0.3 + Math.random() * 0.5}`,
        animationDelay: `${Math.random() * 3}s`
      }
    })
  }
})
</script>

<template>
  <div class="home-hero-extra">
    <!-- 星星背景 -->
    <div class="stars-bg">
      <div
        v-for="star in stars"
        :key="star.id"
        class="star"
        :style="star.style"
      />
    </div>

    <!-- 浮动装饰 -->
    <div class="floating-decorations">
      <span class="decoration heart">💖</span>
      <span class="decoration sparkle">✨</span>
      <span class="decoration star-deco">⭐</span>
      <span class="decoration cloud">☁️</span>
    </div>
  </div>
</template>

<style scoped>
.home-hero-extra {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.floating-decorations {
  position: absolute;
  width: 100%;
  height: 100%;
}

.decoration {
  position: absolute;
  font-size: 1.5rem;
  opacity: 0.6;
  animation: floatAround 10s ease-in-out infinite;
}

.decoration.heart {
  top: 20%;
  left: 10%;
  animation-delay: 0s;
  animation-duration: 8s;
}

.decoration.sparkle {
  top: 30%;
  right: 15%;
  animation-delay: 2s;
  animation-duration: 12s;
}

.decoration.star-deco {
  bottom: 30%;
  left: 20%;
  animation-delay: 4s;
  animation-duration: 10s;
}

.decoration.cloud {
  top: 15%;
  right: 25%;
  animation-delay: 1s;
  animation-duration: 15s;
  font-size: 2rem;
}

@keyframes floatAround {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0.4;
  }
  25% {
    transform: translate(20px, -30px) rotate(10deg);
    opacity: 0.7;
  }
  50% {
    transform: translate(-10px, -50px) rotate(-5deg);
    opacity: 0.5;
  }
  75% {
    transform: translate(30px, -20px) rotate(15deg);
    opacity: 0.8;
  }
}
</style>
