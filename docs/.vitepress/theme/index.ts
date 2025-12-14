import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import HomeHero from './components/HomeHero.vue'
import FeatureCard from './components/FeatureCard.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(HomeHero)
    })
  },
  enhanceApp({ app }) {
    app.component('HomeHero', HomeHero)
    app.component('FeatureCard', FeatureCard)
  }
}
