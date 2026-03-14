import { inject } from '@vercel/analytics';
import { initApp } from './App';

inject();

const app = document.getElementById('app');
if (app) {
  initApp(app).catch(console.error);
}
