import Phaser from 'phaser';
import { FEET_Y } from '../../art/roomShell';
import { JOBS } from '../../data/jobs';
import type { SurvivorProfile } from '../../types';
import { survivorAnimKey, survivorTextureKey } from '../art/registerArt';
import type { RoomRect } from '../config/bunkerLayout';
import { PX } from '../config/layout';
import { ROOM_VISUALS, type Station } from '../config/roomVisuals';

/** 걷는 속도 (화면 px / 초) */
const WALK_SPEED = 14 * PX;

type Mode = 'idle' | 'walk' | 'act';

/**
 * 벙커 안을 돌아다니며 시설과 상호작용하는 생존자.
 * 배정된 방의 작업 위치(station)를 오가며 걷기 → 작업/점검/휴식 → 대기를 반복한다.
 */
export class Survivor extends Phaser.GameObjects.Sprite {
  readonly profile: SurvivorProfile;
  private readonly room: RoomRect;
  private readonly look: string;
  private readonly stations: Station[];
  private readonly baseY: number;
  private mode: Mode = 'idle';
  private timer = 0;
  private current = -1;
  private target: Station | null = null;

  constructor(scene: Phaser.Scene, room: RoomRect, profile: SurvivorProfile) {
    const look = JOBS[profile.job].look;
    const stations = ROOM_VISUALS[room.facility.type].stations;
    const start = stations[Math.floor(Math.random() * stations.length)];
    const baseY = room.y + FEET_Y * PX;

    super(scene, room.x + start.x * PX, baseY, survivorTextureKey(look), 'idle_0');

    this.profile = profile;
    this.room = room;
    this.look = look;
    this.stations = stations;
    this.baseY = baseY;

    this.setOrigin(0.5, 1).setScale(PX);
    scene.add.existing(this);
    this.startIdle();
  }

  /** 매 프레임 호출 (SurvivorSystem) */
  tick(delta: number): void {
    if (this.mode === 'walk' && this.target) {
      const targetX = this.room.x + this.target.x * PX;
      const dist = targetX - this.x;
      const step = (WALK_SPEED * delta) / 1000;
      if (Math.abs(dist) <= step) {
        this.x = targetX;
        this.beginAct(this.target);
      } else {
        this.x += Math.sign(dist) * step;
      }
      return;
    }

    this.timer -= delta;
    if (this.timer <= 0) this.chooseNext();
  }

  private startIdle(): void {
    this.mode = 'idle';
    this.y = this.baseY;
    this.timer = 1200 + Math.random() * 1400;
    this.play(survivorAnimKey(this.look, 'idle'), true);
  }

  private chooseNext(): void {
    // 일하던 자리에서 잠깐 쉬었다가 다른 자리로 이동한다.
    if (this.mode === 'act') {
      this.startIdle();
      return;
    }

    let next = Math.floor(Math.random() * this.stations.length);
    if (this.stations.length > 1 && next === this.current) {
      next = (next + 1) % this.stations.length;
    }
    this.current = next;
    const station = this.stations[next];
    const targetX = this.room.x + station.x * PX;

    if (Math.abs(targetX - this.x) < 2) {
      this.beginAct(station);
      return;
    }
    this.target = station;
    this.mode = 'walk';
    this.y = this.baseY;
    this.setFlipX(targetX < this.x);
    this.play(survivorAnimKey(this.look, 'walk'), true);
  }

  private beginAct(station: Station): void {
    this.mode = 'act';
    this.target = null;
    this.setFlipX(station.face === 'left');
    this.y = this.baseY - (station.lift ?? 0) * PX;
    const [min, max] = station.duration;
    this.timer = min + Math.random() * (max - min);
    this.play(survivorAnimKey(this.look, station.action), true);
  }
}
