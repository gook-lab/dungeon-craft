// Ending scene — opaque victory screen shown after the final boss (Bog Witch).
// Title varies by mercy tone (merciful / ruthless / mixed); below it a short
// run summary (party levels, gold, recruited allies, mercy/slain tally). Z
// returns to the title screen. Post-game free roam is available via "이어하기"
// (the cleared save keeps you in the swamp with the boss gone).
//
// Presentation: a banded gradient sky, drifting light motes tinted by tone,
// a scale+fade-in title, staggered summary fade, and a pulsing prompt.

import * as PIXI from 'pixi.js';
import { label } from '../ui/uikit.js';
import { HEX, FS, FONT, NUM } from '../ui/tokens.js';
import { toneFromFlags } from '../content/dialog.js';
import { epilogueFor, karmaEpilogueLine } from '../content/epilogues.js';

const MEMBER_NAME = { knight: '기사', warrior: '전사', huntress: '사냥꾼', mage: '마법사', duelist: '쌍검사' };
const memberName = (refId) => MEMBER_NAME[refId] || refId;

const TONE = {
  merciful: { text: '자비의 결말', color: HEX.spare, glow: 0x2a5a48, mote: 0x9fffe0 },
  ruthless: { text: '정복의 결말', color: HEX.danger, glow: 0x5a2424, mote: 0xff9f9f },
  mixed: { text: '여정의 끝', color: HEX.gold, glow: 0x4a4020, mote: 0xffe9a0 },
  // True ending — only after the deepest superboss (심연의 군주) falls. Starlight
  // returns to the void: warm gold title, deep-blue sky fading to returning stars.
  true: { text: '진정한 결말', color: 0xfff4d0, glow: 0x1c2452, mote: 0xc8e4ff, sub: '심연을 봉인하고 — 꺼졌던 별빛이 돌아왔다.' },
};

export class EndingScene {
  constructor(game) {
    this.game = game;
    this.opaque = true;
    this.container = new PIXI.Container();
    this.sky = new PIXI.Graphics();
    this.moteLayer = new PIXI.Graphics();
    this.layer = new PIXI.Container(); // text + summary
    this.container.addChild(this.sky, this.moteLayer, this.layer);
    this.t = 0;
    this.ready = false; // brief input lock so the closing confirm doesn't skip it
    this.motes = [];
  }

  enter(args = {}) {
    this.tone = args.tone || toneFromFlags(this.game.runtime.flags);
    this.t = 0;
    this.ready = false;
    this.game.audio?.play('victory_fanfare');
    this.render();
  }

  render() {
    const { w, h } = this.game.renderer.screen;
    const kit = TONE[this.tone] || TONE.mixed;
    this.kit = kit;

    // Banded vertical gradient: ink900 top → tone-glow bottom.
    this.sky.clear();
    const top = NUM.ink900, bot = kit.glow;
    const lerp = (a, b, t) => {
      const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
      const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
      return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
    };
    const bands = 32;
    for (let i = 0; i < bands; i++) {
      const c = lerp(top, bot, i / (bands - 1));
      this.sky.rect(0, (h / bands) * i, w, h / bands + 1).fill({ color: c });
    }

    // Light motes drifting upward (deterministic-enough; UI only).
    this.motes = [];
    const n = 42;
    for (let i = 0; i < n; i++) {
      this.motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.5,
        sp: 8 + Math.random() * 22,
        ph: Math.random() * Math.PI * 2,
      });
    }

    // Text.
    this.layer.removeChildren();
    const rt = this.game.runtime;

    this.title = label(kit.text, FS.display, kit.color, { font: FONT.display });
    this.title.anchor = { x: 0.5, y: 0.5 };
    this.title.x = w / 2; this.title.y = h * 0.20;
    this.layer.addChild(this.title);

    this.sub = label(kit.sub || '던전크래프트 — 모든 지역 클리어', FS.label, HEX.textSoft);
    this.sub.anchor = { x: 0.5, y: 0.5 };
    this.sub.x = w / 2; this.sub.y = h * 0.20 + FS.display + 8;
    this.layer.addChild(this.sub);

    const lines = [];
    for (const p of rt.party) lines.push(`${memberName(p.refId)}  Lv ${p.level}`);
    lines.push('');
    lines.push(`골드  ${rt.gold}`);
    const allyCount = (rt.allies || []).length;
    if (allyCount > 0) lines.push(`영입한 동료  ${allyCount}`);
    lines.push(`자비 ${rt.flags?.mercied || 0}  ·  처치 ${rt.flags?.slain || 0}`);
    if ((rt.ngPlus || 0) > 0) lines.push(`회차  ${(rt.ngPlus || 0) + 1}`);
    // 리더 클래스 에필로그 — 같은 결말이라도 "누구의 눈으로 끝났는가".
    const epi = epilogueFor(rt.party[0]?.refId);
    if (epi) { lines.push(''); for (const ln of epi) lines.push(ln); }
    // Karma-conditioned closer (mercy vs execution playstyle).
    const karmaLine = karmaEpilogueLine(rt.karma || 0);
    if (karmaLine) lines.push(karmaLine);

    this.summary = [];
    let y = h * 0.42;
    for (const ln of lines) {
      const t = label(ln, FS.label, HEX.textSoft);
      t.anchor = { x: 0.5, y: 0.5 };
      t.x = w / 2; t.y = y;
      this.layer.addChild(t);
      this.summary.push(t);
      y += 30;
    }

    this.prompt = label('Z — 타이틀로 돌아가기', FS.caption, HEX.textMute);
    this.prompt.anchor = { x: 0.5, y: 0.5 };
    this.prompt.x = w / 2; this.prompt.y = h - 48;
    this.layer.addChild(this.prompt);
  }

  update(dt) {
    this.t += dt;
    const { w, h } = this.game.renderer.screen;

    // Drift motes upward, wrapping to the bottom; gentle twinkle.
    const g = this.moteLayer;
    g.clear();
    for (const m of this.motes) {
      m.y -= m.sp * dt;
      if (m.y < -4) { m.y = h + 4; m.x = Math.random() * w; }
      const tw = 0.4 + 0.4 * Math.abs(Math.sin(this.t * 1.5 + m.ph));
      g.circle(m.x, m.y, m.r).fill({ color: this.kit.mote, alpha: tw });
    }

    // Title scale+fade in.
    const k = Math.min(1, this.t / 0.5);
    if (this.title) { this.title.scale.set(1.5 - 0.5 * k); this.title.alpha = k; }
    if (this.sub) this.sub.alpha = Math.min(1, Math.max(0, (this.t - 0.4) / 0.4));
    // Staggered summary fade.
    this.summary.forEach((t, i) => { t.alpha = Math.min(1, Math.max(0, (this.t - 0.7 - i * 0.12) / 0.35)); });

    if (this.t > 0.6) this.ready = true;
    if (this.prompt) this.prompt.alpha = this.ready ? (0.45 + 0.45 * Math.abs(Math.sin(this.t * 3))) : 0.15;
    if (!this.ready) return;
    if (this.game.input.pressed('confirm') || this.game.input.pressed('cancel')) {
      // 회차+ (NG+) 제안 — 클리어 보상: 적이 강해진 새 여정 (도감 승계, 리더 재선택).
      // DialogScene은 엔딩 위 오버레이로 뜬다; 거절하면 기존 흐름(타이틀) 그대로.
      if (this.game.offerNgPlus) this.game.offerNgPlus();
      else this.game.toTitle();
    }
  }

  resize() { this.render(); }
}
