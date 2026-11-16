import Phaser from 'phaser';
import { ROOM_VISUALS, type FxDef } from '../config/roomVisuals';
import type { RoomRect } from '../config/bunkerLayout';
import { PX } from '../config/layout';
import { roomTextureKey } from '../art/registerArt';
import { createText } from '../../ui/styles/theme';

const SELECT_COLOR = 0xf2a93b;

/**
 * 벙커의 방 한 칸: 픽셀 아트 배경 + 조명 번짐 + 연출 효과 + 이름표 + 터치 영역.
 * 그림은 src/art/rooms.ts, 조명/연출 설정은 src/game/config/roomVisuals.ts 에 있다.
 */
export class FacilityRoom {
  readonly rect: RoomRect;
  private readonly scene: Phaser.Scene;
  private readonly zone: Phaser.GameObjects.Zone;
  private border: Phaser.GameObjects.Graphics | null = null;
  private borderTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    rect: RoomRect,
    layer: Phaser.GameObjects.Container,
    onSelect: (room: FacilityRoom) => void,
  ) {
    this.scene = scene;
    this.rect = rect;
    const { x, y, w, h, facility } = rect;
    const visual = ROOM_VISUALS[facility.type];

    // 배경
    const image = scene.add
      .image(x, y, roomTextureKey(facility.type))
      .setOrigin(0, 0)
      .setScale(PX);
    layer.add(image);

    // 조명 번짐 (은은하게 깜빡임)
    for (const light of visual.lights) {
      const size = light.radius * 2 * PX;
      const glow = scene.add
        .image(x + light.x * PX, y + light.y * PX, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(light.color)
        .setAlpha(light.alpha)
        .setDisplaySize(size, size);
      layer.add(glow);
      scene.tweens.add({
        targets: glow,
        alpha: light.alpha * 0.78,
        duration: 600 + Math.random() * 900,
        delay: Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 연출 효과
    for (const fx of visual.fx) this.addFx(layer, fx);

    // 이름표
    const label = createText(scene, 0, 0, facility.name, { size: 11, bold: true, color: '#d8dde3' });
    const plateW = Math.ceil(label.width) + 12;
    const plate = scene.add.graphics();
    plate.fillStyle(0x1b1e23, 0.92).fillRect(0, 0, plateW, 15);
    plate.lineStyle(1, 0x5d636c, 1).strokeRect(0.5, 0.5, plateW - 1, 14);
    plate.setPosition(x + 10, y + 39);
    label.setPosition(x + 16, y + 41);
    layer.add([plate, label]);

    // 터치 영역
    this.zone = scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    this.zone.on(Phaser.Input.Events.POINTER_DOWN, () => onSelect(this));
    layer.add(this.zone);
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

  setInputEnabled(enabled: boolean): void {
    if (this.zone.input) this.zone.input.enabled = enabled;
  }

  private addFx(layer: Phaser.GameObjects.Container, fx: FxDef): void {
    const { x, y } = this.rect;
    const scene = this.scene;
    const px = x + fx.x * PX;
    const py = y + fx.y * PX;

    if (fx.kind === 'warn') {
      const lamp = scene.add.sprite(px, py, 'fx-warn', 'warn_0').setOrigin(0, 0).setScale(PX);
      const halo = scene.add
        .image(px + 3 * PX, py + 3 * PX, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff3b2a)
        .setAlpha(0.55)
        .setDisplaySize(21 * PX, 21 * PX);
      layer.add([halo, lamp]);
      let on = true;
      scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          on = !on;
          lamp.setFrame(on ? 'warn_0' : 'warn_1');
          halo.setAlpha(on ? 0.55 : 0.06);
        },
      });
    } else if (fx.kind === 'drip') {
      const drip = scene.add.sprite(px, py, 'fx-drip', 'drip_0').setOrigin(0, 0).setScale(PX);
      layer.add(drip);
      drip.play('fx-drip');
    } else {
      const spark = scene.add.sprite(px, py, 'fx-spark', 'spark_0').setOrigin(0, 0).setScale(PX);
      spark.setVisible(false);
      layer.add(spark);
      const fire = (): void => {
        spark.setPosition(px + Math.random() * 6 * PX, py).setVisible(true);
        spark.play('fx-spark');
        spark.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spark.setVisible(false));
        scene.time.delayedCall(2500 + Math.random() * 4000, fire);
      };
      scene.time.delayedCall(1500 + Math.random() * 2500, fire);
    }
  }
}
