import Phaser from 'phaser';
import type { SurvivorProfile } from '../../types';
import { FEET_Y, type RoomRect } from '../config/bunkerLayout';
import { ROOM_VISUALS, type Station } from '../config/roomVisuals';

/** 걷는 속도 (화면 px / 초) */
const WALK_SPEED = 34;

type Mode = 'idle' | 'walk' | 'act' | 'talk';

/**
 * 벙커 안을 돌아다니며 시설과 상호작용하는 생존자.
 * 캐릭터 그림은 한 장짜리 PNG 이고, 걷기·작업·점검·휴식은 흔들림/기울임으로 표현한다.
 * (동작 프레임 그림이 생기면 이 클래스에서 애니메이션으로 교체한다.)
 */
export class Survivor extends Phaser.GameObjects.Image {
  readonly profile: SurvivorProfile;
  readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly room: RoomRect;
  private readonly stations: Station[];
  private readonly baseY: number;
  private mode: Mode = 'idle';
  private action: Station['action'] = 'idle';
  private timer = 0;
  private clock = Math.random() * 1000;
  private current = -1;
  private target: Station | null = null;

  constructor(scene: Phaser.Scene, room: RoomRect, profile: SurvivorProfile) {
    const stations = ROOM_VISUALS[room.facility.type].stations;
    const start = stations[Math.floor(Math.random() * stations.length)];
    const baseY = room.y + FEET_Y;

    super(scene, room.x + start.x, baseY, profile.sprite);

    this.profile = profile;
    this.room = room;
    this.stations = stations;
    this.baseY = baseY;
    this.setOrigin(0.5, 1);
    this.shadow = scene.add.ellipse(this.x, baseY - 1, this.width + 8, 7, 0x000000, 0.45);
    scene.add.existing(this);
    this.startIdle();
  }

  /** 하던 일을 멈추고 x 쪽을 바라보며 잠시 대화한다. (메인 캐릭터가 찾아왔을 때) */
  talkTo(x: number, duration: number): void {
    this.mode = 'talk';
    this.action = 'idle';
    this.target = null;
    this.resetPose();
    this.setFlipX(x < this.x);
    this.timer = duration;
  }

  /** 아직 동료가 아닌 생존자: 제자리에서 기다린다. (만나서 대화가 끝나면 endTalk 으로 일을 시작) */
  wait(): void {
    this.talkTo(this.x + 1, Number.POSITIVE_INFINITY);
  }

  /** 대화를 끝내고 하던 일로 돌아간다. */
  endTalk(): void {
    if (this.mode === 'talk') this.startIdle();
  }

  /** 매 프레임 호출 (SurvivorSystem) */
  tick(delta: number): void {
    this.clock += delta;
    const dir = this.flipX ? -1 : 1;

    if (this.mode === 'walk' && this.target) {
      const targetX = this.room.x + this.target.x;
      const dist = targetX - this.x;
      const step = (WALK_SPEED * delta) / 1000;
      if (Math.abs(dist) <= step) {
        this.x = targetX;
        this.beginAct(this.target);
      } else {
        this.x += Math.sign(dist) * step;
        const swing = Math.sin(this.clock * 0.014);
        this.y = this.baseY - Math.abs(swing) * 2.5;
        this.setAngle(swing * 2.5);
      }
      this.shadow.x = this.x;
      return;
    }

    if (this.mode === 'act' && this.action === 'work') {
      // 몸을 앞으로 숙였다 폈다 하며 일한다.
      this.setAngle(dir * (4 + Math.sin(this.clock * 0.011) * 4));
    } else if (this.mode === 'act' && this.action === 'inspect') {
      this.setAngle(dir * 2);
      this.y = this.baseY - (Math.sin(this.clock * 0.004) > 0.7 ? 1 : 0);
    } else {
      // 대기/휴식: 숨쉬기
      this.setScale(1, 1 + Math.sin(this.clock * 0.003) * 0.012);
    }

    this.timer -= delta;
    if (this.timer <= 0) this.chooseNext();
  }

  private resetPose(): void {
    this.setAngle(0).setScale(1, 1);
    this.y = this.baseY;
  }

  private startIdle(): void {
    this.mode = 'idle';
    this.action = 'idle';
    this.resetPose();
    this.timer = 1200 + Math.random() * 1400;
  }

  private chooseNext(): void {
    // 일하던 자리에서 잠깐 쉬었다가 다른 자리로 이동한다.
    if (this.mode === 'act' || this.mode === 'talk') {
      this.startIdle();
      return;
    }

    let next = Math.floor(Math.random() * this.stations.length);
    if (this.stations.length > 1 && next === this.current) {
      next = (next + 1) % this.stations.length;
    }
    this.current = next;
    const station = this.stations[next];
    const targetX = this.room.x + station.x;

    if (Math.abs(targetX - this.x) < 2) {
      this.beginAct(station);
      return;
    }
    this.resetPose();
    this.target = station;
    this.mode = 'walk';
    this.setFlipX(targetX < this.x);
  }

  private beginAct(station: Station): void {
    this.mode = 'act';
    this.action = station.action;
    this.target = null;
    this.resetPose();
    this.setFlipX(station.face === 'left');
    const [min, max] = station.duration;
    this.timer = min + Math.random() * (max - min);
  }
}
