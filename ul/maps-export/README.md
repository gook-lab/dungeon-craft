# 맵 리디자인 18종 v2 (확장 스케일) — 삽입 가이드

v3 광활 스케일: 야외 6종을 72~96폭 규모로 확장 — town 56×40 · wild 80×52 · frost/swamp 76×48 · starfall 72×44 · empire_city 80×56. 나머지 12종은 v2 크기 유지 (인테리어는 과대화하면 빈 복도만 늘어남).

## 넣는 법
1. `*.js`를 `src/content/maps/`에 복사
2. `index.js`의 REDESIGNED_MAPS를 기존 MAPS 레지스트리에 병합
3. **용암(ground 4)**: starfall(웅덩이)·starfall_crater·lava_gate·lava_core 사용 — fieldScene 타일 변환에 물(3) 패턴으로 케이스 추가 (통행불가는 collision 반영됨)
4. **props**: `props: [{x,y,kind}]` — door(돌문)·brazier(화로)·rune(룬) + 장식: grave(묘비)·tree(나무)·rock(바위)·barrel(나무통)·statue(석상)·bones(유골)·mushroom(버섯)·crystal(수정)·bush(덤불) — 장식 프롭은 통행 허용/차단을 게임에서 결정(권장: tree·rock·statue·barrel·grave는 차단, bones·mushroom·bush·crystal은 통행). terrain.html 드로잉을 fieldScene prop 렌더로 이식하거나 structures/ 스프라이트로 대체
5. objects는 주석 스케치 — 실제 스키마로 채우기 · encounters는 null — 지역 몬스터 풀로 채우기

## 포탈 연결 그래프 (v2 좌표 왕복 배선)
town ↔ wild ↔ (darkforest) / wild ↔ dungeon ↔ frost ↔ swamp ↔ empire_gate ↔ empire_camp ↔ (empire_bridge) / empire_camp ↔ empire_city ↔ (ruins_below) / empire_city ↔ empire_throne ↔ starfall ↔ starfall_crater ↔ lava_gate ↔ lava_core ↔ void_gate ↔ void_core → (귀환) town

## 샘플맵 7종 정식 편성 (v3)
- 호숫가 마을 30×20: wild(78,26) ↔ lake_town ↔ darkforest — 어둠숲 앞 휴식촌
- 지하 수로 30×20: dungeon 서측 금고(2,14) ↔ waterway — 비밀 사이드(단상 보상)
- 협곡 스위치백 30×20: frost(60,1) ↔ switchback — 등반 사이드(제단 보상)
- 대륙 오버월드 64×44: swamp ↔ overworld ↔ empire_gate — 1막→2막 대여정 삽입
- 운하 항구도시 44×30: empire_camp(30,26) ↔ port_city — 보급항 서브타운
- 대성채 48×36: empire_city 귀족구 테라스(66,1) ↔ grand_citadel — 옵션 던전
- 용암 요새 30×20: lava_gate(34,4) ↔ lava_keep — 옵션 보스(화염 파수장)
