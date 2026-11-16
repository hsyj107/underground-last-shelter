import Phaser from 'phaser';
import type { FacilityType, SurvivorProfile } from '../../types';
import { Survivor } from '../entities/Survivor';
import type { FacilityRoom } from '../entities/FacilityRoom';

/** 생존자 캐릭터를 만들고, 매 프레임 움직임을 갱신한다. */
export class SurvivorSystem {
  readonly survivors: Survivor[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rooms: FacilityRoom[],
    private readonly layer: Phaser.GameObjects.Container,
  ) {
    const onUpdate = (_time: number, delta: number): void => {
      for (const s of this.survivors) s.tick(delta);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
  }

  /** 생존자를 근무 시설 방에 등장시킨다. */
  add(profile: SurvivorProfile): Survivor | undefined {
    const room = this.rooms.find((r) => r.rect.facility.type === profile.facility);
    if (!room) return undefined;
    const survivor = new Survivor(this.scene, room.rect, profile);
    this.layer.add([survivor.shadow, survivor]);
    this.survivors.push(survivor);
    return survivor;
  }

  /** 특정 시설에 배치된 생존자 캐릭터 (없으면 undefined) */
  getSurvivorIn(type: FacilityType): Survivor | undefined {
    return this.survivors.find((s) => s.profile.facility === type);
  }

  /** 특정 시설에서 일하는 생존자 정보 */
  getWorkers(type: FacilityType): SurvivorProfile[] {
    return this.survivors.filter((s) => s.profile.facility === type).map((s) => s.profile);
  }
}
