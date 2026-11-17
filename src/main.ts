import './style.css';
import { startApp } from './ui.ts';

/** 휴대폰처럼 개발자 도구를 열기 어려운 환경에서도 오류 원인을 볼 수 있게 화면에 띄운다 */
function showError(message: string): void {
  let box = document.getElementById('error-overlay');
  if (!box) {
    box = document.createElement('pre');
    box.id = 'error-overlay';
    box.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;margin:0;padding:8px;' +
      'background:rgba(120,0,0,0.92);color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;z-index:9999;';
    document.body.appendChild(box);
  }
  box.textContent += `${message}\n`;
}
window.addEventListener('error', (e) => showError(`[오류] ${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => showError(`[오류] ${String(e.reason)}`));

startApp(document.getElementById('app') as HTMLElement);
