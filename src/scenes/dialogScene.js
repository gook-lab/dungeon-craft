// Dialog scene — overlay message box at the bottom. Confirm advances lines;
// after the last line it closes and runs the dialog's `action` (shop/inn) or
// resumes the field. Non-opaque so the field stays visible underneath.

import * as PIXI from 'pixi.js';
import { frame, label } from '../ui/uikit.js';
import { HEX, FS, FONT } from '../ui/tokens.js';
import { getDialog } from '../content/dialog.js';
import { textSpeedSec } from '../data/settings.js';

export class DialogScene {
  constructor(game) {
    this.game = game;
    this.opaque = false;
    this.container = new PIXI.Container();
    this.box = new PIXI.Container();
    this.container.addChild(this.box);
    this.lines = [];
    this.idx = 0;
    this.action = null;
    this.afterClose = null;
    this.hintAlpha = 1;
    this.hintDirection = -0.04; // for blinking animation
  }

  enter(args = {}) {
    // Accept either a dialog id (content/dialog.js) or raw lines/speaker.
    const d = args.lines ? { speaker: args.speaker || '', lines: args.lines, action: args.action }
      : (getDialog(args.dialogId) || { speaker: '', lines: ['...'] });
    this.lines = d.lines;
    this.action = d.action || null;
    this.shop = d.shop || null; // which merchant stock (for action 'shop')
    this.speaker = d.speaker || '';
    this.afterClose = args.afterClose || null;
    // Optional terminal CHOICE: after the last line, show a vertical selector of
    // `choices` (string labels); picking one pops the dialog and calls
    // onChoice(index). Reusable for moral-choice rooms, yes/no prompts, etc.
    this.choices = args.choices || d.choices || null;
    this.onChoice = args.onChoice || null;
    this.choosing = false;
    this.choiceIdx = 0;
    this.idx = 0;
    this.hintAlpha = 1;
    this.hintDirection = -0.04;
    this.layout();
    this.render();
  }

  layout() {
    this.box.removeChildren();
    const { w, h } = this.game.renderer.screen;
    const bw = Math.min(720, w - 48);
    const bh = 150;
    const win = frame(bw, bh, 'classic');
    win.x = (w - bw) / 2; win.y = h - bh - 24;
    this.box.addChild(win);

    if (this.speaker) {
      const tagW = 160;
      const tagH = 34;
      const tag = frame(tagW, tagH, 'classic');
      tag.x = win.x; tag.y = win.y - tagH;
      const nt = label(this.speaker, FS.label, HEX.gold, { font: FONT.ui });
      nt.x = tag.x + 12; nt.y = tag.y + 6;
      this.box.addChild(tag, nt);
    }
    this.text = label('', FS.body, HEX.text, {
      font: FONT.ui,
      wordWrap: true,
      wordWrapWidth: bw - 44,
    });
    this.text.x = win.x + 22; this.text.y = win.y + 20;
    this.box.addChild(this.text);

    this.hint = label('▼', FS.caption, HEX.textMute, { font: FONT.ui });
    this.hint.x = win.x + bw - 32; this.hint.y = win.y + bh - 28;
    this.hintAlpha = 1;
    this.hintDirection = -0.04;
    this.box.addChild(this.hint);
    this.winX = win.x; this.winY = win.y; this.bw = bw; this.bh = bh;
    this.choiceLabels = [];
  }

  render() {
    // 타자기 효과 — 설정 텍스트 속도(초/글자). 즉시(0)면 한 번에 출력.
    this.fullText = this.lines[this.idx] || '';
    const spd = textSpeedSec();
    if (spd <= 0) { this.reveal = this.fullText.length; this.text.text = this.fullText; }
    else { this.reveal = 0; this.charT = 0; this.text.text = ''; }
  }

  // Terminal choice selector — replaces the message text with a vertical option
  // list; ▶ marks the cursor. Picking (confirm) pops + calls onChoice(index).
  renderChoices() {
    this.hint.visible = false;
    this.text.text = '';
    for (const l of this.choiceLabels) this.box.removeChild(l);
    this.choiceLabels = [];
    this.choices.forEach((c, i) => {
      const sel = i === this.choiceIdx;
      const t = label(`${sel ? '▶ ' : '   '}${c}`, FS.body, sel ? HEX.gold : HEX.text, { font: FONT.ui });
      t.x = this.winX + 28; t.y = this.winY + 18 + i * 30;
      this.box.addChild(t);
      this.choiceLabels.push(t);
    });
  }

  update(dt = 0.016) {
    // 타자기 진행 — 아직 다 안 나왔으면 글자 노출.
    if (!this.choosing && this.fullText !== undefined && this.reveal < this.fullText.length) {
      const spd = textSpeedSec();
      if (spd > 0) {
        this.charT = (this.charT || 0) + dt;
        while (this.charT >= spd && this.reveal < this.fullText.length) { this.charT -= spd; this.reveal++; }
        this.text.text = this.fullText.slice(0, this.reveal);
      }
    }
    // Blink the hint by cycling alpha
    this.hintAlpha += this.hintDirection;
    if (this.hintAlpha <= 0.3) this.hintDirection = 0.04;
    if (this.hintAlpha >= 1) this.hintDirection = -0.04;
    this.hint.alpha = this.hintAlpha;

    // Choice mode: ↑↓ move the cursor, confirm picks. (cancel is inert — you must
    // make the call; this is a deliberate moral fork, not a skippable prompt.)
    if (this.choosing) {
      if (this.game.input.pressed('up')) { this.choiceIdx = (this.choiceIdx - 1 + this.choices.length) % this.choices.length; this.renderChoices(); }
      else if (this.game.input.pressed('down')) { this.choiceIdx = (this.choiceIdx + 1) % this.choices.length; this.renderChoices(); }
      else if (this.game.input.pressed('confirm')) {
        const pick = this.choiceIdx;
        this.game.scenes.pop();
        if (this.onChoice) this.onChoice(pick); else if (this.afterClose) this.afterClose();
        else this.game.resumeField();
      }
      return;
    }

    if (this.game.input.pressed('confirm') || this.game.input.pressed('cancel')) {
      // 타자 중이면 먼저 전체 노출 (한 번 더 눌러야 다음 줄).
      if (this.fullText !== undefined && this.reveal < this.fullText.length) {
        this.reveal = this.fullText.length; this.text.text = this.fullText; return;
      }
      this.idx++;
      if (this.idx >= this.lines.length) {
        // After the last line: enter the choice selector if this dialog has one.
        if (this.choices && this.choices.length) { this.choosing = true; this.renderChoices(); return; }
        this.close(); return;
      }
      this.render();
    }
  }

  close() {
    this.game.scenes.pop(); // remove this dialog
    const after = this.afterClose;
    if (this.action === 'shop') { this.game.openShop(this.shop); }
    else if (this.action === 'inn') { this.game.tryInn(); }
    else if (this.action === 'heal') { this.game.healSpring(); }
    else if (this.action === 'warp') { this.game.openFastTravel(); }
    else if (after) { after(); }
    else { this.game.resumeField(); }
  }
}
