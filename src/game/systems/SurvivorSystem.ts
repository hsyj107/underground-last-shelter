import Phaser from 'phaser';
import type { FacilityType, SurvivorProfile } from '../../types';
import { Survivor } from '../entities/Survivor';
import type { FacilityRoom } from '../entities/FacilityRoom';

/** 시설에 배치된 생존자 캐릭터를 방에 세우고, 매 프레임 움직임을 갱신한다. */
export class SurvivorSystem {
  private survivors: Survivor[] = [];

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

  /**
   * 배치 상태에 맞춰 캐릭터를 다시 세운다. 시설에 배치된 생존자만 방에 나타난다.
   * (대기 중인 생존자는 생존자 목록에서만 보인다)
   */
  sync(profiles: SurvivorProfile[]): void {
    for (const s of this.survivors) {
      s.shadow.destroy();
      s.destroy();
    }
    this.survivors = [];

    for (const profile of profiles) {
      const room = this.rooms.find((r) => r.rect.facility.type === profile.facility);
      if (!room) continue;
      const survivor = new Survivor(this.scene, room.rect, profile);
      this.layer.add([survivor.shadow, survivor]);
      this.survivors.push(survivor);
    }
  }

  /** 특정 시설에 배치된 생존자 캐릭터 (없으면 undefined) */
  getSurvivorIn(type: FacilityType): Survivor | undefined {
    return this.survivors.find((s) => s.profile.facility === type);
  }
}
