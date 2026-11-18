import './style.css';
import { startApp, notify } from './ui.ts';
import * as cloud from './cloud.ts';

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

void (async () => {
  const pending: string[] = [];
  try {
    // 로그인 복귀 처리와 서버 저장 맞추기는 게임이 시작되기 전에 끝낸다. 실패해도 이 기기 저장으로 시작한다.
    await cloud.boot((m) => pending.push(m));
  } catch (e) {
    showError(`[클라우드] ${String(e)}`);
  }
  startApp(document.getElementById('app') as HTMLElement);
  cloud.startSync();
  pending.forEach((m) => notify(m));
})();
