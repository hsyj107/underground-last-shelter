import Phaser from 'phaser';
import { ROOM_VISUALS, type FxDef } from '../config/roomVisuals';
import { SHAFT_X, type RoomRect } from '../config/bunkerLayout';
import { roomTextureKey } from '../art/registerArt';
import { createText } from '../../ui/styles/theme';

const SELECT_COLOR = 0xf2a93b;
/** 연출 효과(경고등 등) 스프라이트 배율 */
const FX_SCALE = 2;

/**
 * 벙커의 방 한 칸: 방 배경 PNG + 조명 깜빡임 + 연출 효과 + 이름표.
 * 터치 판정은 BunkerScene 이 좌우 끌기와 함께 처리한다.
 */
export class FacilityRoom {
  readonly rect: RoomRect;
  private readonly scene: Phaser.Scene;
  private border: Phaser.GameObjects.Graphics | null = null;
  private borderTween: Phaser.Tweens.Tween | null = null;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly offSign: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[];

  constructor(scene: Phaser.Scene, rect: RoomRect, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.rect = rect;
    const { x, y, w, h, facility } = rect;
    const visual = ROOM_VISUALS[facility.type];

    // 배경 (그림 크기가 달라도 방 크기에 맞춘다)
    layer.add(scene.add.image(x, y, roomTextureKey(facility.type)).setOrigin(0, 0).setDisplaySize(w, h));

    layer.add(this.drawLadder());

    // 조명 깜빡임
    for (const lx of visual.lamps) {
      const glow = scene.add
        .image(x + lx, y + 40, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(visual.lampColor)
        .setAlpha(0.2)
        .setDisplaySize(150, 110);
      layer.add(glow);
      this.glows.push(glow);
      scene.tweens.add({
        targets: glow,
        alpha: 0.11,
        duration: 700 + Math.random() * 900,
        delay: Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    for (const fx of visual.fx) this.addFx(layer, fx);

    // 인원이 없어 멈춘 방은 어둡게 덮는다.
    this.dim = scene.add.rectangle(x, y, w, h, 0x04060a, 0.62).setOrigin(0, 0).setVisible(false);
    layer.add(this.dim);

    // 이름표
    const label = createText(scene, 0, 0, `B${facility.floor}  ${facility.name}`, { size: 12, bold: true, color: '#e2e6ea' });
    const plateW = Math.ceil(label.width) + 14;
    const plate = scene.add.graphics();
    plate.fillStyle(0x15171a, 0.9).fillRect(0, 0, plateW, 18);
    plate.lineStyle(1, 0x6a7078, 1).strokeRect(0.5, 0.5, plateW - 1, 17);
    plate.setPosition(x + 14, y + 36);
    label.setPosition(x + 21, y + 38);
    layer.add([plate, label]);

    // "운영 중지" 표지 (이름표 옆)
    const off = createText(scene, 0, 0, '운영 중지 · 인원 없음', { size: 11, bold: true, color: '#ff8a7a' });
    const offW = Math.ceil(off.width) + 12;
    const offPlate = scene.add.graphics();
    offPlate.fillStyle(0x2a0f0d, 0.92).fillRect(0, 0, offW, 18);
    offPlate.lineStyle(1, 0xb0463a, 1).strokeRect(0.5, 0.5, offW - 1, 17);
    offPlate.setPosition(x + 14 + plateW + 6, y + 36);
    off.setPosition(x + 14 + plateW + 12, y + 39);
    offPlate.setVisible(false);
    off.setVisible(false);
    this.offSign = [offPlate, off];
    layer.add(this.offSign);
  }

  /** 배치된 인원이 있어야 시설이 가동된다. 없으면 불이 꺼지고 "운영 중지"가 붙는다. */
  setStaffed(staffed: boolean): void {
    this.dim.setVisible(!staffed);
    for (const glow of this.glows) glow.setVisible(staffed);
    for (const obj of this.offSign) obj.setVisible(!staffed);
  }

  /** 층 사이를 잇는 사다리 (방 오른쪽 끝, 층 높이 전체) */
  private drawLadder(): Phaser.GameObjects.Graphics {
    const { x, y, h } = this.rect;
    const lx = x + SHAFT_X - 9;
    const g = this.scene.add.graphics();
    g.fillStyle(0x06080a, 0.5).fillRect(lx - 4, y, 26, h);
    for (let ry = y + 5; ry < y + h - 2; ry += 11) {
      g.fillStyle(0x4d5258, 1).fillRect(lx + 3, ry, 12, 2);
      g.fillStyle(0x121518, 1).fillRect(lx + 3, ry + 2, 12, 1);
    }
    for (const rx of [lx, lx + 15]) {
      g.fillStyle(0x2b2f34, 1).fillRect(rx, y, 3, h);
      g.fillStyle(0x70767d, 1).fillRect(rx, y, 1, h);
    }
    return g;
  }

  contains(worldX: number, worldY: number): boolean {
    const { x, y, w, h } = this.rect;
    return worldX >= x && worldX < x + w && worldY >= y && worldY < y + h;
  }

  /** 선택 테두리는 생존자보다 위에 그려야 해서 나중에 따로 붙인다. */
  addOverlay(layer: Phaser.GameObjects.Container): void {
    const { x, y, w, h } = this.rect;
    const g = this.scene.add.graphics();
    g.lineStyle(3, SELECT_COLOR, 1).strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.lineStyle(1, 0xffe3a8, 0.8).strokeRect(x + 5, y + 5, w - 10, h - 10);
    g.setVisible(false);
    layer.add(g);
    this.border = g;
  }

  setSelected(selected: boolean): void {
    if (!this.border) return;
    this.borderTween?.stop();
    this.borderTween = null;
    this.border.setVisible(selected).setAlpha(1);
    if (selected) {
      this.borderTween = this.scene.tweens.add({
        targets: this.border,
        alpha: 0.55,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private addFx(layer: Phaser.GameObjects.Container, fx: FxDef): void {
    const scene = this.scene;
    const px = this.rect.x + fx.x;
    const py = this.rect.y + fx.y;

    if (fx.kind === 'warn') {
      const lamp = scene.add.sprite(px, py, 'fx-warn', 'warn_0').setOrigin(0, 0).setScale(FX_SCALE);
      const halo = scene.add
        .image(px + 3 * FX_SCALE, py + 3 * FX_SCALE, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff3b2a)
        .setAlpha(0.5)
        .setDisplaySize(54, 54);
      layer.add([halo, lamp]);
      let on = true;
      scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          on = !on;
          lamp.setFrame(on ? 'warn_0' : 'warn_1');
          halo.setAlpha(on ? 0.5 : 0.05);
        },
      });
    } else if (fx.kind === 'drip') {
      const drip = scene.add.sprite(px, py, 'fx-drip', 'drip_0').setOrigin(0, 0).setScale(FX_SCALE);
      layer.add(drip);
      drip.play('fx-drip');
    } else {
      const spark = scene.add.sprite(px, py, 'fx-spark', 'spark_0').setOrigin(0, 0).setScale(FX_SCALE);
      spark.setVisible(false);
      layer.add(spark);
      const fire = (): void => {
        spark.setPosition(px + Math.random() * 14, py).setVisible(true);
        spark.play('fx-spark');
        spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spark.setVisible(false));
        scene.time.delayedCall(2500 + Math.random() * 4000, fire);
      };
      scene.time.delayedCall(1500 + Math.random() * 2500, fire);
    }
  }
}
