import { clamp } from './core';
import type { BodyPart, Rng, Survivor, Wound } from './types';

/** 부위별 부상, 후유증, 의수·의족. 계산만 하고 게임 상태 전체는 모른다. */

export const PART_LABEL: Record<BodyPart, string> = {
  head: '머리', torso: '몸통', arm_l: '왼팔', arm_r: '오른팔', leg_l: '왼다리', leg_r: '오른다리',
};
export const KIND_LABEL = { wound: '부상', scar: '흉터', lost: '결손', prosthetic: '의수·의족' } as const;

const PARTS: BodyPart[] = ['head', 'torso', 'arm_l', 'arm_r', 'leg_l', 'leg_r'];
const LIMBS: BodyPart[] = ['arm_l', 'arm_r', 'leg_l', 'leg_r'];
const isLeg = (p: BodyPart): boolean => p === 'leg_l' || p === 'leg_r';

/** 의수·의족 제작 비용과 조건 (⚠ 임시 수치) */
export const PROSTHETIC = { scrap: 40, medicine: 2, workshop: 2 };

export const woundOn = (s: Survivor, part: BodyPart): Wound | undefined => s.wounds.find((w) => w.part === part);

/** 새 상처를 하나 입힌다. 이미 상처가 있는 부위는 피한다. 설명 문장을 돌려준다. */
export function injure(s: Survivor, rng: Rng, day: number, heavy: boolean): string | null {
  const free = PARTS.filter((p) => !woundOn(s, p));
  if (free.length === 0) return null;
  // 팔다리가 더 자주 다친다
  const pool = free.flatMap((p) => (LIMBS.includes(p) ? [p, p] : [p]));
  const part = pool[Math.floor(rng() * pool.length)];
  if (heavy && LIMBS.includes(part) && rng() < 0.4) {
    s.wounds.push({ part, kind: 'lost' });
    return `${PART_LABEL[part]}을(를) 잃었다`;
  }
  if (heavy && (part === 'head' || part === 'torso') && rng() < 0.35) {
    s.wounds.push({ part, kind: 'scar' });
    return `${PART_LABEL[part]}에 깊은 후유증이 남았다`;
  }
  s.wounds.push({ part, kind: 'wound', until: day + 3 + Math.floor(rng() * 4) });
  return `${PART_LABEL[part]} 부상`;
}

/** 하루 지나며 낫는 상처를 정리한다. 낫고 나면 일부는 흉터로 남는다 */
export function healWounds(s: Survivor, rng: Rng, day: number): string[] {
  const notes: string[] = [];
  for (const w of s.wounds) {
    if (w.kind !== 'wound' || (w.until ?? 0) > day) continue;
    if (rng() < 0.4 && (w.part === 'head' || w.part === 'torso')) {
      w.kind = 'scar';
      delete w.until;
      notes.push(`${PART_LABEL[w.part]}에 후유증이 남았습니다`);
    } else {
      w.kind = 'scar';
      delete w.until;
    }
  }
  // 팔다리 흉터는 기능에 영향이 없으므로 기록만 남기지 않고 정리한다
  s.wounds = s.wounds.filter((w) => !(w.kind === 'scar' && LIMBS.includes(w.part)));
  return notes;
}

/** 몸 상태가 일 능률에 주는 배수 (0.3~1) */
export function bodyFactor(s: Survivor): number {
  let f = 1;
  const legs = s.wounds.filter((w) => isLeg(w.part));
  const arms = s.wounds.filter((w) => !isLeg(w.part) && LIMBS.includes(w.part));
  const lostLegs = legs.filter((w) => w.kind === 'lost').length;
  const legPros = legs.filter((w) => w.kind === 'prosthetic').length;
  const lostArms = arms.filter((w) => w.kind === 'lost').length;
  const armPros = arms.filter((w) => w.kind === 'prosthetic').length;
  f *= lostLegs === 2 ? 0.45 : lostLegs === 1 ? 0.82 : 1;
  f *= legPros === 2 ? 0.85 : legPros === 1 ? 0.92 : 1;
  f *= lostArms === 2 ? 0.35 : lostArms === 1 ? 0.75 : 1;
  f *= armPros === 2 ? 0.8 : armPros === 1 ? 0.9 : 1;
  if (s.wounds.some((w) => w.part === 'head' && w.kind === 'scar')) f *= 0.93;
  f *= Math.pow(0.92, s.wounds.filter((w) => w.kind === 'wound').length);
  return clamp(f, 0.3, 1);
}

/** 원정을 나갈 수 있는 몸인지 (두 다리를 잃고 의족도 없으면 못 간다) */
export function canTravel(s: Survivor): boolean {
  const lost = s.wounds.filter((w) => isLeg(w.part) && w.kind === 'lost').length;
  return lost < 2;
}

/** 체력 상한 보정: 몸통 후유증이 있으면 낮아진다 */
export const hpPenalty = (s: Survivor): number => (s.wounds.some((w) => w.part === 'torso' && w.kind === 'scar') ? 10 : 0);

export function bodySummary(s: Survivor): string[] {
  return s.wounds.map((w) => `${PART_LABEL[w.part]} ${KIND_LABEL[w.kind]}`);
}
