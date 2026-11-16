import Phaser from 'phaser';
import './ui/styles/global.css';
import { gameConfig } from './game/config/gameConfig';

/**
 * 화면에 오류 메시지를 띄운다.
 * 휴대폰처럼 개발자 도구를 열기 어려운 환경에서도 캡처해서 원인을 알 수 있게 한다.
 */
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

new Phaser.Game(gameConfig);
