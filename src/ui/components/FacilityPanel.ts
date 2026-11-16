import Phaser from 'phaser';
import { JOBS } from '../../data/jobs';
import { FACILITY_INFO } from '../../data/facilityInfo';
import { GAME_WIDTH, LAYOUT } from '../../game/config/layout';
import type { FacilityDef, SurvivorProfile } from '../../types';
import { TEXT_COLORS, createText } from '../styles/theme';

const PANEL_W = GAME_WIDTH - 32;
const PANEL_H = 176;
const AMBER = 0xf2a93b;
const ROW_Y = [68, 90, 112];

/** 패널에 보여 줄 내용 (BunkerScene 이 게임 상태에서 만들어 넘긴다) */
export interface FacilityPanelView {
  facility: FacilityDef;
  /** 0 이면 잠김 */
  level: number;
  status: 'locked' | 'idle' | 'active';
  /** 개방 조건 (잠겨 있을 때 표시, 최대 3줄) */
  conditions: { text: string; met: boolean }[];
  workers: SurvivorProfile[];
  /** 왼쪽 버튼 글자: "개방" / "업그레이드 (철 40)" / "최고 레벨" */
  primaryText: string;
}

export interface FacilityPanelHandlers {
  onClose: () => void;
  /** 왼쪽 버튼: 개방 또는 업그레이드 */
  onPrimary: () => void;
  /** 오른쪽 버튼: 생존자 배치 */
  onAssign: () => void;
}

/** 시설을 선택하면 나타나는 상세 패널 (아래쪽, 아래층을 선택했을 때는 위쪽에 표시) */
export class FacilityPanel extends Phaser.GameObjects.Container {
  private readonly title: Phaser.GameObjects.Text;
  private readonly level: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly rowLabels: Phaser.GameObjects.Text[];
  private readonly rowValues: Phaser.GameObjects.Text[];
  private readonly primaryLabel: Phaser.GameObjects.Text;
  private readonly assignLabel: Phaser.GameObjects.Text;
  private primaryText = '';
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  private open = false;

  constructor(scene: Phaser.Scene, handlers: FacilityPanelHandlers) {
    super(scene, 16, 0);

    // 배경: 어두운 금속 판 + 위쪽 호박색 선
    const bg = scene.add.graphics();
    bg.fillStyle(0x0d1015, 0.97).fillRect(0, 0, PANEL_W, PANEL_H);
    bg.fillStyle(0x1a1f26, 1).fillRect(3, 3, PANEL_W - 6, PANEL_H - 6);
    bg.lineStyle(2, 0x3a4048, 1).strokeRect(1, 1, PANEL_W - 2, PANEL_H - 2);
    bg.fillStyle(AMBER, 1).fillRect(3, 3, PANEL_W - 6, 3);
    this.add(bg);

    // 패널 뒤의 방이 눌리지 않도록 터치를 막는다.
    this.add(scene.add.zone(PANEL_W / 2, PANEL_H / 2, PANEL_W, PANEL_H).setInteractive());

    this.title = createText(scene, 16, 14, '', { size: 20, bold: true, color: TEXT_COLORS.accent });
    this.level = createText(scene, 0, 20, '', { size: 13, bold: true, color: TEXT_COLORS.sub });
    this.desc = createText(scene, 16, 42, '', { size: 13, color: TEXT_COLORS.sub });
    this.rowLabels = ROW_Y.map((y) => createText(scene, 16, y + 1, '', { size: 13, color: TEXT_COLORS.sub }));
    this.rowValues = ROW_Y.map((y) => createText(scene, 78, y, '', { size: 14, bold: true }));
    this.add([this.title, this.level, this.desc, ...this.rowLabels, ...this.rowValues]);

    // 닫기 버튼
    const close = createText(scene, PANEL_W - 28, 6, '×', { size: 30, bold: true, color: TEXT_COLORS.sub });
    const closeHit = scene.add.zone(PANEL_W - 22, 22, 48, 44).setInteractive({ useHandCursor: true });
    closeHit.on(Phaser.Input.Events.POINTER_DOWN, () => handlers.onClose());
    this.add([close, closeHit]);

    this.primaryLabel = this.makeButton(scene, 16, handlers.onPrimary);
    this.assignLabel = this.makeButton(scene, PANEL_W / 2 + 4, handlers.onAssign);

    this.setDepth(50).setVisible(false);
    scene.add.existing(this);
  }

  /** 화면 좌표가 열려 있는 패널 위인지 (벙커 터치와 겹치지 않게 할 때 사용) */
  containsPoint(x: number, y: number): boolean {
    return this.open && x >= this.x && x <= this.x + PANEL_W && y >= this.y - 14 && y <= this.y + PANEL_H + 14;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** animate 가 false 면 위치는 그대로 두고 내용만 바꾼다. */
  show(view: FacilityPanelView, placeTop: boolean, animate = true): void {
    const info = FACILITY_INFO[view.facility.type];
    const locked = view.status === 'locked';
    this.title.setText(view.facility.name);
    this.level.setText(locked ? '잠김' : `Lv.${view.level}`).setX(16 + this.title.width + 10);
    this.desc.setText(info.description);

    const rows: { label: string; value: string; color: string }[] = locked
      ? view.conditions.slice(0, 3).map((c, i) => ({
          label: i === 0 ? '개방 조건' : '',
          value: `${c.met ? '✔' : '✘'} ${c.text}`,
          color: c.met ? TEXT_COLORS.good : TEXT_COLORS.warn,
        }))
      : [
          view.status === 'active'
            ? { label: '효과', value: info.effect, color: TEXT_COLORS.good }
            : { label: '효과', value: '운영 중지 · 맡을 사람이 필요합니다', color: TEXT_COLORS.warn },
          { label: '소비', value: info.consume, color: '#e8a27a' },
          view.workers.length > 0
            ? { label: '작업자', value: view.workers.map((w) => `${w.name} (${JOBS[w.job].label})`).join(', '), color: TEXT_COLORS.main }
            : { label: '작업자', value: '배치된 생존자 없음', color: TEXT_COLORS.sub },
        ];
    ROW_Y.forEach((_, i) => {
      const row = rows[i];
      this.rowLabels[i].setText(row ? row.label : '');
      this.rowValues[i].setText(row ? row.value : '').setColor(row ? row.color : TEXT_COLORS.main);
      // 잠김 상태의 "개방 조건" 글자가 길어서 값 위치를 조금 민다.
      this.rowValues[i].setX(locked ? 92 : 78);
    });

    this.flashTimer?.remove(false);
    this.flashTimer = null;
    this.primaryText = view.primaryText;
    this.primaryLabel.setText(view.primaryText).setColor(TEXT_COLORS.main);
    this.assignLabel.setText('생존자 배치').setColor(locked ? TEXT_COLORS.sub : TEXT_COLORS.main);

    this.open = true;
    if (!animate) return;
    const y = placeTop ? LAYOUT.contentTop + 4 : LAYOUT.contentBottom - PANEL_H - 4;
    const slide = placeTop ? -14 : 14;
    this.setVisible(true).setAlpha(0).setY(y + slide);
    this.scene.tweens.add({ targets: this, alpha: 1, y, duration: 140, ease: 'Sine.easeOut' });
  }

  /** 버튼에 잠깐 안내 글을 띄운다 (예: "철이 부족합니다"). */
  notice(which: 'primary' | 'assign', text: string): void {
    const label = which === 'primary' ? this.primaryLabel : this.assignLabel;
    const original = which === 'primary' ? this.primaryText : '생존자 배치';
    this.primaryLabel.setText(this.primaryText);
    this.assignLabel.setText('생존자 배치');
    label.setText(text);
    this.flashTimer?.remove(false);
    this.flashTimer = this.scene.time.delayedCall(1400, () => label.setText(original));
  }

  hide(): void {
    this.open = false;
    this.flashTimer?.remove(false);
    this.flashTimer = null;
    this.setVisible(false);
  }

  private makeButton(scene: Phaser.Scene, x: number, onPress: () => void): Phaser.GameObjects.Text {
    const w = PANEL_W / 2 - 20;
    const h = 36;
    const y = 134;
    const g = scene.add.graphics();
    g.fillStyle(0x252b33, 1).fillRect(x, y, w, h);
    g.fillStyle(0x3a4048, 1).fillRect(x, y, w, 2);
    g.lineStyle(2, 0x3a4048, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
    const label = createText(scene, x + w / 2, y + h / 2, '', { size: 15, bold: true, originX: 0.5, originY: 0.5 });
    const hit = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.open) onPress();
    });
    this.add([g, label, hit]);
    return label;
  }
}
