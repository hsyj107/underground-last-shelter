import { EXPEDITION_AREAS } from '../../data/expeditions';
import { JOBS } from '../../data/jobs';
import { AGE_LABEL, GENDER_LABEL, playerSprite } from '../../data/player';
import { xpToNext } from '../../data/progression';
import {
  assignSurvivor, capacity, claimExpedition, currentArea, expeditionSecondsLeft, facilityName, game,
  startExpedition, type ExpeditionResult,
} from '../../game/state/gameState';
import type { FacilityType, PlayerProfile, SurvivorProfile } from '../../types';

/**
 * 글과 목록이 많은 화면(캐릭터 만들기, 탐험, 생존자)은 게임 화면 위에 HTML 창으로 띄운다.
 * 모양은 ui/styles/global.css 의 .uls-* 에 있다.
 */

type Attrs = { class?: string; text?: string };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Node[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  for (const child of children) node.appendChild(child);
  return node;
}

function sprite(key: string, scale: number): HTMLImageElement {
  const img = el('img', { class: 'uls-sprite' });
  img.alt = '';
  img.addEventListener('load', () => {
    img.width = img.naturalWidth * scale;
    img.height = img.naturalHeight * scale;
  });
  img.src = `assets/characters/${key}.png`;
  return img;
}

interface Modal {
  body: HTMLDivElement;
  close: () => void;
  /** 창이 닫힐 때 같이 멈출 것(타이머 등)을 등록한다. */
  onCleanup: (fn: () => void) => void;
}

/** 열려 있는 창이 있는지 (게임 화면 조작을 막을 때 쓴다) */
export const isScreenOpen = (): boolean => document.querySelector('.uls-overlay') !== null;

function openModal(title: string, onClose?: () => void): Modal {
  const body = el('div', { class: 'uls-body' });
  const head = el('div', { class: 'uls-head' }, [el('div', { class: 'uls-title', text: title })]);
  const overlay = el('div', { class: 'uls-overlay' }, [el('div', { class: 'uls-window' }, [head, body])]);
  let cleanup: (() => void) | null = null;
  const close = (): void => {
    cleanup?.();
    overlay.remove();
  };
  if (onClose) {
    const x = el('button', { class: 'uls-close', text: '×' });
    x.addEventListener('click', () => {
      close();
      onClose();
    });
    head.appendChild(x);
  }
  // 창을 연 그 누르기가 창 안의 버튼까지 눌러 버리지 않게, 잠깐 동안은 입력을 받지 않는다.
  overlay.style.pointerEvents = 'none';
  window.setTimeout(() => {
    overlay.style.pointerEvents = '';
  }, 250);
  document.body.appendChild(overlay);
  return {
    body,
    close,
    onCleanup: (fn) => {
      cleanup = fn;
    },
  };
}

function button(text: string, onClick: () => void, small = false): HTMLButtonElement {
  const b = el('button', { class: small ? 'uls-btn small' : 'uls-btn', text });
  b.addEventListener('click', onClick);
  return b;
}

// ───────── 캐릭터 만들기 ─────────

export function openCharacterCreator(onDone: (profile: PlayerProfile) => void): void {
  const modal = openModal('생존자 등록');
  const draft: PlayerProfile = { nickname: '', gender: 'male', age: 'young' };

  const preview = el('div', { class: 'uls-preview' });
  const showPreview = (): void => preview.replaceChildren(sprite(playerSprite(draft), 2));

  const input = el('input', { class: 'uls-input' });
  input.type = 'text';
  input.maxLength = 8;
  input.placeholder = '닉네임 (2~8자)';

  const start = button('이 모습으로 시작', () => {
    draft.nickname = input.value.trim();
    modal.close();
    onDone(draft);
  });
  const validate = (): void => {
    start.disabled = input.value.trim().length < 2;
  };
  input.addEventListener('input', validate);

  const choices = <T extends string>(labels: Record<T, string>, current: () => T, set: (v: T) => void): HTMLDivElement => {
    const row = el('div', { class: 'uls-choices' });
    const render = (): void => {
      row.replaceChildren(
        ...(Object.keys(labels) as T[]).map((key) => {
          const b = el('button', { class: key === current() ? 'uls-choice on' : 'uls-choice', text: labels[key] });
          b.addEventListener('click', () => {
            set(key);
            render();
            showPreview();
          });
          return b;
        }),
      );
    };
    render();
    return row;
  };

  modal.body.append(
    el('p', { class: 'uls-note', text: '당신은 누구입니까? 벙커의 대장이 될 사람을 정하세요.' }),
    preview,
    el('div', { class: 'uls-label', text: '닉네임' }),
    input,
    el('div', { class: 'uls-label', text: '성별' }),
    choices(GENDER_LABEL, () => draft.gender, (v) => (draft.gender = v)),
    el('div', { class: 'uls-label', text: '연령대' }),
    choices(AGE_LABEL, () => draft.age, (v) => (draft.age = v)),
    start,
  );
  showPreview();
  validate();
}

// ───────── 생존자 카드 ─────────

function survivorCard(s: SurvivorProfile, action?: HTMLElement): HTMLDivElement {
  const title = el('div', { class: 'uls-card-title', text: s.name });
  title.appendChild(el('span', { class: s.named ? 'uls-tag' : 'uls-tag gray', text: s.named ? '네임드' : '일반' }));
  const where = s.facility ? `${facilityName(s.facility)} 근무` : '대기 중';
  const best = s.best ? ` · 적성: ${facilityName(s.best)}` : '';
  const main = el('div', { class: 'uls-card-main' }, [
    title,
    el('div', { class: 'uls-card-sub', text: `${JOBS[s.job].label} · ${s.trait}` }),
    el('div', { class: 'uls-card-sub', text: `${where}${best}` }),
  ]);
  return el('div', { class: 'uls-card' }, action ? [sprite(s.sprite, 1), main, action] : [sprite(s.sprite, 1), main]);
}

/** 생존자 목록 (보기 전용) */
export function openSurvivorList(onClose: () => void): void {
  const modal = openModal(`생존자 ${game.survivors.length}/${capacity()}`, onClose);
  if (game.survivors.length === 0) {
    modal.body.append(el('p', { class: 'uls-note', text: '아직 함께하는 생존자가 없습니다. [탐험]에서 생존자를 찾아 데려오세요.' }));
    return;
  }
  modal.body.append(
    el('p', { class: 'uls-note', text: '시설을 누른 뒤 [생존자 배치]로 일할 곳을 정합니다. 숙소 레벨이 오르면 더 많이 받을 수 있습니다.' }),
    ...game.survivors.map((s) => survivorCard(s)),
  );
}

/** 시설에 배치할 생존자 고르기 */
export function openSurvivorPicker(type: FacilityType, onClose: () => void): void {
  const modal = openModal(`${facilityName(type)} 배치`, onClose);
  const done = (): void => {
    modal.close();
    onClose();
  };
  if (game.survivors.length === 0) {
    modal.body.append(el('p', { class: 'uls-note', text: '배치할 생존자가 없습니다. [탐험]에서 생존자를 찾아 데려오세요.' }));
    return;
  }
  modal.body.append(el('p', { class: 'uls-note', text: '이 시설을 맡을 사람을 고르세요. 다른 곳에서 일하던 사람을 고르면 이쪽으로 옮겨 옵니다.' }));
  for (const s of game.survivors) {
    const here = s.facility === type;
    const act = button(here ? '빼기' : '배치', () => {
      assignSurvivor(s.id, here ? null : type);
      done();
    }, true);
    modal.body.append(survivorCard(s, act));
  }
}

// ───────── 탐험 ─────────

const clock = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
};

/** 탐험 화면: 지역 고르기 → 진행 중(남은 시간) → 결과 */
export function openExpeditionScreen(onClose: () => void): void {
  const modal = openModal('탐험', onClose);
  let timer: number | undefined;
  modal.onCleanup(() => window.clearInterval(timer));

  const showResult = (r: ExpeditionResult): void => {
    const nodes: Node[] = [
      el('p', { class: 'uls-note uls-center', text: `${r.area.name} 탐험 완료` }),
      el('div', { class: 'uls-card' }, [
        el('div', { class: 'uls-card-main' }, [
          el('div', { class: 'uls-card-title', text: `철 +${r.iron}   식량 +${r.food}   물 +${r.water}` }),
          el('div', {
            class: 'uls-card-sub',
            text: `경험치 +${r.xp}${r.levelUps > 0 ? `  ·  레벨 업! 대장 Lv.${game.level}` : ''}`,
          }),
        ]),
      ]),
    ];
    if (r.survivor) {
      nodes.push(el('div', { class: 'uls-label uls-good', text: '생존자를 구했습니다' }), survivorCard(r.survivor));
      if (r.rescue) nodes.push(el('p', { class: 'uls-quote', text: r.rescue }));
    } else if (r.full) {
      nodes.push(el('p', { class: 'uls-note uls-warn', text: '생존자를 만났지만 벙커에 자리가 없어 데려오지 못했습니다. 숙소를 개방하거나 레벨을 올리세요.' }));
    } else {
      nodes.push(el('p', { class: 'uls-note', text: '이번에는 생존자를 만나지 못했습니다.' }));
    }
    nodes.push(button('확인', render));
    modal.body.replaceChildren(...nodes);
  };

  const showProgress = (): void => {
    const area = currentArea();
    const left = el('div', { class: 'uls-big' });
    const claim = button('결과 확인', () => {
      const result = claimExpedition();
      if (result) showResult(result);
    });
    const tick = (): void => {
      const seconds = expeditionSecondsLeft();
      left.textContent = seconds > 0 ? clock(seconds) : '귀환 완료';
      claim.disabled = seconds > 0;
    };
    modal.body.replaceChildren(
      el('p', { class: 'uls-note uls-center', text: `${area?.name ?? ''} 탐험 중` }),
      left,
      el('p', { class: 'uls-note uls-center', text: '창을 닫아도 탐험은 계속됩니다.' }),
      claim,
    );
    tick();
    window.clearInterval(timer);
    timer = window.setInterval(tick, 500);
  };

  const showAreas = (): void => {
    const nodes: Node[] = [
      el('p', {
        class: 'uls-note',
        text: `대장 Lv.${game.level} (경험치 ${game.xp}/${xpToNext(game.level)}) · 생존자 ${game.survivors.length}/${capacity()}. 탐험으로 자원과 경험치를 얻고 생존자를 구해 옵니다. 지역마다 사연 있는 생존자가 숨어 있습니다.`,
      }),
    ];
    for (const area of EXPEDITION_AREAS) {
      const locked = game.level < area.playerLevel;
      const go = button(locked ? `Lv.${area.playerLevel} 필요` : '출발', () => {
        if (startExpedition(area.id)) render();
      }, true);
      go.disabled = locked;
      const card = el('div', { class: locked ? 'uls-card dim' : 'uls-card' }, [
        el('div', { class: 'uls-card-main' }, [
          el('div', { class: 'uls-card-title', text: area.name }),
          el('div', { class: 'uls-card-sub', text: area.description }),
          el('div', { class: 'uls-card-sub', text: `${clock(area.seconds)} · 경험치 ${area.xp} · 철 ${area.iron[0]}~${area.iron[1]}` }),
        ]),
        go,
      ]);
      nodes.push(card);
    }
    modal.body.replaceChildren(...nodes);
  };

  function render(): void {
    window.clearInterval(timer);
    if (game.expedition) showProgress();
    else showAreas();
  }
  render();
}
