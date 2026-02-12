import { initApp } from './App';

const app = document.getElementById('app');
if (app) {
  initApp(app).catch(console.error);
}
