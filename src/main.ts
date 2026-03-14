import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { initApp } from './App';

inject();
injectSpeedInsights();

const app = document.getElementById('app');
if (app) {
  initApp(app).catch(console.error);
}
