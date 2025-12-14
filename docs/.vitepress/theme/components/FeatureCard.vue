<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="feature-card">
    <span v-if="icon" class="icon">{{ icon }}</span>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<style scoped>
.feature-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-3));
  transform: scaleX(0);
  transition: transform 0.4s;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border-color: var(--vp-c-brand-1);
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.icon {
  font-size: 2.5rem;
  margin-bottom: 16px;
  display: block;
  animation: iconFloat 3s ease-in-out infinite;
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

h3 {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
}

p {
  color: var(--vp-c-text-2);
  line-height: 1.7;
  margin: 0;
}
</style>
