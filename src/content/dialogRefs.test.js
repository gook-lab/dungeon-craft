// Dialog id 참조 무결성 가드 — 맵 오브젝트가 가리키는 대사 id가 dialog.js에
// 실제로 존재하는지 검증한다. 없으면 게임은 조용히 침묵(말 없는 NPC / 사망대사
// 누락)하므로 테스트만이 오타를 잡는다. 새 존/보스를 추가하고 대사를 깜빡하면
// 여기서 RED — "표지판을 놓고 대사를 안 쓴" 사고의 재발 방지.

import { describe, it, expect } from 'vitest';
import { MAPS } from './maps/index.js';
import { getDialog } from './dialog.js';
import { QUESTS } from './quests.js';

describe('dialog id 참조 무결성 (맵 → dialog.js)', () => {
  it('every map object talk id resolves to a dialog entry', () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      for (const o of map.objects || []) {
        if (!o.talk) continue;
        expect(getDialog(o.talk), `${mapId} (${o.x},${o.y}) talk '${o.talk}'`).toBeTruthy();
      }
    }
  });

  it('every boss win id resolves (사망대사 — endBattle이 톤 변형 폴백으로 읽음)', () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      for (const o of map.objects || []) {
        if (o.kind !== 'boss' || !o.win) continue;
        expect(getDialog(o.win), `${mapId} boss '${o.ref}' win '${o.win}'`).toBeTruthy();
      }
    }
  });

  it('every gated portal lockedTalk resolves', () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      for (const p of map.portals || []) {
        if (!p.lockedTalk) continue;
        expect(getDialog(p.lockedTalk), `${mapId} portal → ${p.to} lockedTalk '${p.lockedTalk}'`).toBeTruthy();
      }
    }
  });

  it('every quest giver NPC references an existing quest', () => {
    for (const [mapId, map] of Object.entries(MAPS)) {
      for (const o of map.objects || []) {
        if (!o.quest) continue;
        expect(QUESTS[o.quest], `${mapId} quest giver '${o.quest}'`).toBeTruthy();
      }
    }
  });
});
