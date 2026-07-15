# game-ready 맵 7종 — 통합 패치 가이드

이 폴더의 7개 파일은 **실제 게임 스키마 그대로**입니다 (실측 시맨틱: 프롭=objects ref, 실존 아이템/몬스터/대화 id만 사용, walkable 클러터로 flood-fill 안전). 
`src/content/maps/`에 복사한 뒤 아래 패치만 붙이면 됩니다.

## 1) index.js 등록
```js
import lake_town from './lake_town.js';
import waterway from './waterway.js';
import switchback from './switchback.js';
import overworld from './overworld.js';
import port_city from './port_city.js';
import grand_citadel from './grand_citadel.js';
import lava_keep from './lava_keep.js';
// MAPS 객체에: lake_town, waterway, switchback, overworld, port_city, grand_citadel, lava_keep 추가
```

## 2) wild.js — 호숫가 마을 (서쪽 가장자리)
```js
// collision 선언 뒤에:
collision[14 * W] = 0; collision[15 * W] = 0; // west gate → lake town
// portals에 추가:
{ x: 0, y: 14, to: 'lake_town', tx: 24, ty: 10 },
{ x: 0, y: 15, to: 'lake_town', tx: 24, ty: 11 },
```

## 3) dungeon.js — 지하 수로 (금고 안쪽 비밀 통로!)
```js
// vault 봉인 코드 뒤에:
collision[20 * W] = 0; // secret waterway mouth (inside the key vault)
// portals에 추가:
{ x: 0, y: 20, to: 'waterway', tx: 24, ty: 9 },
```
열쇠로 금고를 연 플레이어만 발견 — 기존 crypt_key 셋피스의 보상이 깊어집니다.

## 4) frost.js — 협곡 스위치백 (남쪽 가장자리)
```js
collision[(H - 1) * W + 12] = 0; // south pass → switchback ridge
// portals에 추가:
{ x: 12, y: 25, to: 'switchback', tx: 12, ty: 18 },
```

## 5) swamp.js + empire_gate.js — 몰락 평원 삽입 (기존 링크 재지정)
```js
// swamp.js portals — 기존 empire_gate행을 교체 (requires 게이트 유지):
{ x: W - 1, y: 8, to: 'overworld', tx: 1, ty: 15, requires: 'swampBossDefeated', lockedTalk: 'empire_gate_locked' },
// empire_gate.js portals — 기존 swamp행을 교체:
{ x: 0, y: 8, to: 'overworld', tx: 42, ty: 15 },
```

## 6) empire_camp.js — 운하 항구 (남쪽 두 번째 통로)
```js
collision[(H - 1) * W + 12] = 0; // second south gap → port city
// portals에 추가:
{ x: 12, y: 12, to: 'port_city', tx: 12, ty: 1 },
```

## 7) empire_city.js — 대성채 (북쪽 가장자리)
```js
collision[14] = 0; // north gate → grand citadel
// portals에 추가:
{ x: 14, y: 0, to: 'grand_citadel', tx: 14, ty: 24 },
```

## 8) lava_gate.js — 용암 요새 (북쪽 가장자리)
```js
collision[2] = 0; // north pass → lava keep
// portals에 추가:
{ x: 2, y: 0, to: 'lava_keep', tx: 2, ty: 18 },
```

## 검증
- `npm test` — content.test의 flood-fill 완주 가드가 새 맵 스폰→포탈/상자 경로를 검증합니다.
- 신규 맵의 상자는 실존 아이템 id(sage_amulet·elixir·mythril_mail·silver_sword·flame_brand·power_ring·guard_brooch)와 gold만 사용.
- 매복 트리거는 실존 몬스터 id만 사용 (거미·서리·제국·화염 풀).
- NPC 대화는 실존 talk id(inn·shop·shop_smith·shop_alchemist·shop_jeweler)만 재사용 — 신규 대사를 붙이려면 dialog.js에 id 추가 후 교체하세요.
- 미니보스(성채 집사·화염 파수장 등)를 원하면 monsters.js에 정의 후 objects에 kind:'boss' 행을 추가 — 위치 제안: grand_citadel (16,4) 앞 왕좌, lava_keep (12,7) 왕좌.

## 성격 요약
| 맵 | 연결 | 성격 |
|---|---|---|
| 호숫가 마을 26×20 | wild 서쪽 | 안전 허브 (여관·상점·대장간) |
| 지하 수로 26×18 | dungeon 금고 뒤 | 비밀 보상 사이드 |
| 협곡 스위치백 26×20 | frost 남쪽 | 등반 사이드 (제단 보상) |
| 몰락 평원 44×30 | swamp↔empire_gate 삽입 | 2막 진입 대여정 |
| 운하 항구 30×22 | camp 남쪽 | 안전 허브 (연금·보석) |
| 대성채 34×26 | city 북쪽 | 옵션 던전 (보상 2+매복 2) |
| 용암 요새 26×20 | lava_gate 북쪽 | 포스트게임 옵션 존 |
