import Phaser from 'phaser';
import { FEET_Y, SHAFT_X, type RoomRect } from '../config/bunkerLayout';
import { createText } from '../../ui/styles/theme';

/** 걷는 속도 / 사다리 오르내리는 속도 (화면 px / 초) */
const WALK_SPEED = 135;
const CLIMB_SPEED = 380;
/** 방 안에서 걸어 다닐 수 있는 x 범위 (방 왼쪽 기준) */
const MIN_X = 24;
const MAX_X = 500;

export interface TravelPlan {
  /** 가려는 방 */
  room: RoomRect;
  /** 방 안에서 설 위치 (방 왼쪽 기준이 아닌 벙커 전체 x). 상대가 움직일 수 있어 매번 다시 묻는다. */
  targetX: () => number;
  onArrive: () => void;
}

/**
 * 내 메인 캐릭터. 방을 누르면 사다리로 층을 옮겨 그 방까지 직접 걸어간다.
 * 그림은 한 장짜리 PNG 라서 걷기·오르기는 흔들림으로 표현한다.
 */
export class Player extends Phaser.GameObjects.Image {
  readonly shadow: Phaser.GameObjects.Ellipse;
  /** 머리 위 표시 (내 캐릭터임을 알려 준다) */
  readonly marker: Phaser.GameObjects.Text;
  private plan: TravelPlan | null = null;
  private climbing = false;
  /** 흔들림을 뺀 발 높이 */
  private baseY: number;
  private clock = 0;

  constructor(scene: Phaser.Scene, room: RoomRect, x: number, sprite: string) {
    const baseY = room.y + FEET_Y;
    super(scene, room.x + x, baseY, sprite);
    this.baseY = baseY;
    this.setOrigin(0.5, 1);
    this.shadow = scene.add.ellipse(this.x, baseY - 1, this.width + 8, 7, 0x000000, 0.45);
    this.marker = createText(scene, this.x, baseY - this.height - 6, '▼', {
      size: 12,
      bold: true,
      color: '#f2a93b',
      originX: 0.5,
      originY: 1,
    });
    scene.add.existing(this);
  }

  /** 발이 닿아 있는 높이 (화면 따라가기용) */
  get feetY(): number {
    return this.baseY;
  }

  get isTraveling(): boolean {
    return this.plan !== null;
  }

  travelTo(plan: TravelPlan): void {
    this.plan = plan;
  }

  /** 이동은 계속하되, 도착했을 때 하려던 일은 취소한다. */
  cancelArrival(): void {
    if (this.plan) this.plan = { ...this.plan, onArrive: () => undefined };
  }

  /** 캐릭터 그림을 바꾼다 (캐릭터를 새로 만들었을 때). */
  setLook(sprite: string): void {
    this.setTexture(sprite);
  }

  face(x: number): void {
    this.setFlipX(x < this.x);
  }

  /** 매 프레임 호출 (BunkerScene) */
  tick(delta: number): void {
    this.clock += delta;
    const plan = this.plan;

    if (!plan) {
      // 대기: 숨쉬기
      this.setScale(1, 1 + Math.sin(this.clock * 0.003) * 0.012);
    } else {
      const goalY = plan.room.y + FEET_Y;
      if (this.climbing) {
        this.climb(goalY, delta);
      } else if (Math.abs(this.baseY - goalY) > 0.5) {
        // 다른 층이면 먼저 사다리까지 걸어간다.
        if (this.walkToward(plan.room.x + SHAFT_X, delta)) this.climbing = true;
      } else {
        const targetX = Phaser.Math.Clamp(plan.targetX(), plan.room.x + MIN_X, plan.room.x + MAX_X);
        if (this.walkToward(targetX, delta)) {
          this.plan = null;
          plan.onArrive();
        }
      }
    }

    this.shadow.setPosition(this.x, this.baseY - 1).setVisible(!this.climbing);
    this.marker.setPosition(this.x, this.y - this.height - 6 - Math.abs(Math.sin(this.clock * 0.004)) * 3);
  }

  private climb(goalY: number, delta: number): void {
    const dist = goalY - this.baseY;
    const step = (CLIMB_SPEED * delta) / 1000;
    this.setScale(1, 1).setAngle(0);
    if (Math.abs(dist) <= step) {
      this.baseY = goalY;
      this.climbing = false;
      this.y = this.baseY;
      return;
    }
    this.baseY += Math.sign(dist) * step;
    this.y = this.baseY;
    // 사다리를 잡고 좌우로 살짝 흔들린다.
    this.setAngle(Math.sin(this.clock * 0.02) * 3);
  }

  /** targetX 쪽으로 한 걸음. 도착하면 true. */
  private walkToward(targetX: number, delta: number): boolean {
    const dist = targetX - this.x;
    const step = (WALK_SPEED * delta) / 1000;
    this.setScale(1, 1);
    if (Math.abs(dist) <= step) {
      this.x = targetX;
      this.y = this.baseY;
      this.setAngle(0);
      return true;
    }
    this.setFlipX(dist < 0);
    this.x += Math.sign(dist) * step;
    const swing = Math.sin(this.clock * 0.018);
    this.y = this.baseY - Math.abs(swing) * 2.5;
    this.setAngle(swing * 2.5);
    return false;
  }
}
