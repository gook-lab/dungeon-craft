// 설정 화면 — 사운드/게임/조작 3탭. 슬라이더·토글·세그먼트 라디오 + 키보드 네비.
// ul/settings-export 시안 이식. 값은 data/settings(전역 localStorage), 변경 즉시
// 저장 + audio/battle/dialog에 반영. 호출 씬 위에 opaque로 push, X/확인으로 pop.

import * as PIXI from 'pixi.js';
import { label, frame } from '../ui/uikit.js';
import { HEX, NUM, FS, FONT } from '../ui/tokens.js';
import { getSettings, saveSettings, resetSettings, applyAudioSettings } from '../data/settings.js';

const TABS = [['audio', '사운드'], ['game', '게임'], ['controls', '조작']];
const PAGES = {
  audio: [
    { id: 'master', name: '전체 음량', type: 'slider', hint: '모든 소리의 기준 음량' },
    { id: 'bgm', name: '배경음악 (BGM)', type: 'slider', hint: '지역별 음악 · SFX 아래로 깔림' },
    { id: 'sfx', name: '효과음 (SFX)', type: 'slider', hint: '타격·메뉴·발소리 등' },
    { id: 'mute', name: '음소거', type: 'toggle', hint: '모든 소리를 일시 정지' },
  ],
  game: [
    { id: 'textSpeed', name: '텍스트 속도', type: 'radio', opts: ['느림', '보통', '빠름', '즉시'], hint: '대사 출력 속도' },
    { id: 'battleSpeed', name: '전투 속도', type: 'radio', opts: ['보통', '빠름', '2배'], hint: '전투 연출·애니메이션 배속' },
    { id: 'autosave', name: '자동 저장', type: 'toggle', hint: '끄면 잦은 저장을 줄임 (전투·이동·상자 등 진행 지점은 항상 저장)' },
    { id: 'screenShake', name: '화면 흔들림', type: 'toggle', hint: '강타·피격 시 카메라 셰이크' },
    { id: 'colorblind', name: '색맹 모드', type: 'toggle', hint: '상태·속성을 색 외에 기호로도 구분', prev: true },
  ],
};
const CB_CHIPS = [['독', '☣', HEX.hpHigh], ['수면', '☾', 0xb59cff], ['약화', '▼', 0xd98446], ['약점', '▲', HEX.goldGlow], ['반감', '◇', HEX.textSoft]];
const CONTROLS = [
  ['이동', '방향키 / WASD'], ['확인 · 조사 · 대화', 'Z / Enter'], ['취소 · 뒤로', 'X / Esc'],
  ['메뉴 (상태·편성·퀘스트)', 'X (필드)'], ['소지품 · 지도 · 퀘스트', 'I · M · Q'], ['빠른 이동', '룬게이트 Z / 지도 W'],
  ['전투 명령·대상', '방향키 + Z'], ['설정', 'Esc'], ['전체화면', 'F11'],
];

export class SettingsScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
    this.page = 'audio';
    this.sel = 0;
    this._saveT = 0;
  }

  enter() { this.render(); }

  toHex(c) { return typeof c === 'string' ? c : '#' + c.toString(16).padStart(6, '0'); }

  render() {
    this.layer.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const s = getSettings();
    const bg = new PIXI.Graphics(); bg.rect(0, 0, w, h).fill({ color: 0x0a0b16 }); this.layer.addChild(bg);

    const title = label('설정', FS.display, HEX.gold, { font: FONT.display });
    title.x = 28; title.y = 18; this.layer.addChild(title);

    // 탭
    let tx = 28; const ty = 64;
    for (const [key, name] of TABS) {
      const on = key === this.page;
      const t = label(name, FS.command, on ? HEX.gold : HEX.textMute, { font: FONT.ui });
      t.x = tx; t.y = ty; this.layer.addChild(t);
      if (on) { const u = new PIXI.Graphics(); u.rect(tx, ty + FS.command + 4, t.width, 2).fill({ color: NUM.gold }); this.layer.addChild(u); }
      tx += t.width + 28;
    }
    const tabHint = label('Tab 탭 전환', FS.caption, HEX.textMute); tabHint.anchor = { x: 1, y: 0 }; tabHint.x = w - 28; tabHint.y = ty + 4; this.layer.addChild(tabHint);

    const panel = frame(w - 56, h - 150, 'bevel'); panel.x = 28; panel.y = 100; this.layer.addChild(panel);
    const px = 48, pw = w - 96;
    let yy = 120;

    if (this.page === 'controls') {
      for (const [act, key] of CONTROLS) {
        const a = label(act, FS.command, HEX.text, { font: FONT.ui }); a.x = px; a.y = yy;
        const k = label(key, FS.command, HEX.goldGlow, { font: FONT.ui }); k.anchor = { x: 1, y: 0 }; k.x = px + pw; k.y = yy;
        this.layer.addChild(a, k); yy += 34;
      }
      const hn = label('조작은 현재 고정입니다. 리매핑은 추후 지원 예정.', FS.caption, HEX.textMute); hn.x = px; hn.y = yy + 8; this.layer.addChild(hn);
    } else {
      const items = PAGES[this.page];
      items.forEach((it, i) => {
        const on = i === this.sel;
        if (on) { const hl = new PIXI.Graphics(); hl.roundRect(px - 10, yy - 4, pw + 20, 34, 4).fill({ color: 0x1a1c30, alpha: 0.8 }); this.layer.addChild(hl); }
        const cur = label(on ? '▶' : '', FS.command, HEX.gold); cur.x = px - 4; cur.y = yy; this.layer.addChild(cur);
        const nm = label(it.name, FS.command, on ? HEX.gold : HEX.text, { font: FONT.ui }); nm.x = px + 18; nm.y = yy; this.layer.addChild(nm);
        // 컨트롤 (우측)
        if (it.type === 'slider') {
          const barW = 200, bx = px + pw - barW - 52, by = yy + 4;
          const n = 10, f = Math.round(s[it.id] / 100 * n);
          for (let seg = 0; seg < n; seg++) {
            const g = new PIXI.Graphics();
            g.rect(bx + seg * (barW / n), by, barW / n - 3, 16).fill({ color: seg < f ? NUM.gold : 0x2a2c40 });
            this.layer.addChild(g);
          }
          const v = label(String(s[it.id]), FS.stat, HEX.text); v.anchor = { x: 1, y: 0 }; v.x = px + pw; v.y = yy; this.layer.addChild(v);
        } else if (it.type === 'toggle') {
          const val = s[it.id];
          const tg = label(val ? 'ON' : 'OFF', FS.command, val ? HEX.hpHigh : HEX.textOff, { font: FONT.ui });
          tg.anchor = { x: 1, y: 0 }; tg.x = px + pw; tg.y = yy; this.layer.addChild(tg);
        } else if (it.type === 'radio') {
          let rx = px + pw; // right-anchored, lay out right→left
          for (let oi = it.opts.length - 1; oi >= 0; oi--) {
            const o = it.opts[oi]; const on2 = s[it.id] === o;
            const b = label(o, FS.caption, on2 ? HEX.gold : HEX.textMute, { font: FONT.ui });
            b.anchor = { x: 1, y: 0 }; b.x = rx; b.y = yy + 3;
            const bgc = new PIXI.Graphics(); bgc.roundRect(b.x - b.width - 8, yy, b.width + 16, 26, 3).stroke({ color: on2 ? NUM.gold : NUM.frame, width: 1 });
            this.layer.addChild(bgc, b);
            rx -= b.width + 24;
          }
        }
        yy += 34;
        if (on && it.hint) { const hn = label(it.hint, FS.caption, HEX.textMute); hn.x = px + 18; hn.y = yy - 2; this.layer.addChild(hn); yy += 22; }
        if (on && it.prev) { // 색맹 미리보기 칩
          let cx = px + 18;
          for (const [name2, sym, col] of CB_CHIPS) {
            const txt = s.colorblind ? `${name2} ${sym}` : name2;
            const chip = label(txt, FS.caption, this.toHex(col)); chip.x = cx + 6; chip.y = yy;
            const box = new PIXI.Graphics(); box.roundRect(cx, yy - 2, chip.width + 12, chip.height + 4, 3).fill({ color: 0x0a0b16 }).stroke({ color: typeof col === 'string' ? NUM[Object.keys(HEX).find((k) => HEX[k] === col)] || NUM.frame : col, width: 1 });
            this.layer.addChild(box, chip); cx += chip.width + 22;
          }
          yy += 28;
        }
      });
    }

    // 하단 힌트 + 저장 토스트 + 기본값
    const foot = label('↑↓ 항목 · ←→ 조절 · X 닫기 · R 기본값', FS.caption, HEX.textMute);
    foot.anchor = { x: 0.5, y: 1 }; foot.x = w / 2; foot.y = h - 16; this.layer.addChild(foot);
    if (this._saveT > 0) { const sv = label('◆ 저장됨', FS.caption, HEX.gold); sv.anchor = { x: 1, y: 1 }; sv.x = w - 28; sv.y = h - 16; this.layer.addChild(sv); }
  }

  items() { return PAGES[this.page] || []; }

  adjust(dir) {
    const it = this.items()[this.sel]; if (!it) return;
    const s = getSettings();
    if (it.type === 'slider') saveSettings({ [it.id]: Math.max(0, Math.min(100, s[it.id] + dir * 5)) });
    else if (it.type === 'toggle') saveSettings({ [it.id]: dir > 0 });
    else if (it.type === 'radio') { const i = it.opts.indexOf(s[it.id]); const ni = Math.max(0, Math.min(it.opts.length - 1, i + dir)); saveSettings({ [it.id]: it.opts[ni] }); }
    this.afterChange();
  }

  afterChange() {
    applyAudioSettings(this.game.audio);
    this._saveT = 1.1;
    this.game.audio?.play('menu_cursor');
    this.render();
  }

  update(dt) {
    if (this._saveT > 0) { const prev = this._saveT; this._saveT -= dt; if (prev > 0 && this._saveT <= 0) this.render(); }
    const input = this.game.input;
    if (input.pressed('tab')) { this.switchTab(1); return; }
    if (input.pressed('reset')) { resetSettings(); this.afterChange(); return; }
    if (this.page === 'controls') {
      if (input.pressed('cancel') || input.pressed('confirm')) return this.close();
      if (input.pressed('left')) this.switchTab(-1);
      else if (input.pressed('right')) this.switchTab(1);
      return;
    }
    const n = this.items().length;
    if (input.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.game.audio?.play('menu_cursor'); this.render(); }
    else if (input.pressed('down')) { this.sel = (this.sel + 1) % n; this.game.audio?.play('menu_cursor'); this.render(); }
    else if (input.pressed('left')) this.adjust(-1);
    else if (input.pressed('right')) this.adjust(1);
    else if (input.pressed('cancel')) this.close();
    else if (input.pressed('confirm')) { const it = this.items()[this.sel]; if (it && it.type === 'toggle') this.adjust(getSettings()[it.id] ? -1 : 1); }
  }

  switchTab(dir) {
    const order = TABS.map((t) => t[0]);
    let i = order.indexOf(this.page); i = (i + dir + order.length) % order.length; this.page = order[i]; this.sel = 0;
    this.game.audio?.play('menu_cursor'); this.render();
  }

  close() {
    this.game.audio?.play('menu_cancel');
    this.game.scenes.pop();
    if (this.game.scenes.top && this.game.scenes.top.resume) this.game.scenes.top.resume();
  }
}
