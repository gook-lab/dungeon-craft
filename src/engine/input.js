// Keyboard input. Uses e.code (KeyW / ArrowUp) NOT e.key — Korean IME breaks
// e.key for letters (game's known WASD/IME trap). Edge-triggered `pressed()`
// for menu navigation + dialog advance; held `isDown()` for field walking.
// SceneManager calls endFrame() after each update to clear the just-pressed set.

const ACTION_CODES = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  confirm: ['Enter', 'Space', 'KeyZ'],
  cancel: ['Escape', 'KeyX', 'Backspace'],
  quest: ['KeyQ'],      // open the quest log directly from the field
  inventory: ['KeyI'],  // open the item/inventory menu directly
  map: ['KeyM'],        // toggle the enlarged minimap overlay
  worldmap: ['KeyW'],   // from the enlarged minimap → world-map fast travel
  tab: ['Tab'],         // settings tab switch
  reset: ['KeyR'],      // settings → reset to defaults
};

export function createInput() {
  const held = new Set();
  const justPressed = new Set();
  const heldSince = new Map(); // code -> seconds held (for auto-repeat gating)

  const onDown = (e) => {
    // Prevent the page from scrolling on arrows/space.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!held.has(e.code)) { justPressed.add(e.code); heldSince.set(e.code, 0); }
    held.add(e.code);
  };
  const onUp = (e) => { held.delete(e.code); heldSince.delete(e.code); };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  const codesFor = (action) => ACTION_CODES[action] || [];

  return {
    isDown: (action) => codesFor(action).some((c) => held.has(c)),
    pressed: (action) => codesFor(action).some((c) => justPressed.has(c)),
    // First active direction this frame for grid stepping. Held (hold-to-walk)
    // OR just-pressed (tap-step, and survives a fast keydown→keyup between
    // frames). Returns {dx,dy,dir} or null.
    dir: function () {
      const on = (a) => this.isDown(a) || this.pressed(a);
      if (on('up')) return { dx: 0, dy: -1, dir: 'north' };
      if (on('down')) return { dx: 0, dy: 1, dir: 'south' };
      if (on('left')) return { dx: -1, dy: 0, dir: 'west' };
      if (on('right')) return { dx: 1, dy: 0, dir: 'east' };
      return null;
    },
    // Seconds the action's key has been held (0 if not held). Used to gate
    // grid auto-repeat: a tap steps once, a hold past a delay walks.
    heldFor(action) {
      let max = 0;
      for (const c of codesFor(action)) if (heldSince.has(c)) max = Math.max(max, heldSince.get(c));
      return max;
    },
    // Accumulate hold durations — call once per frame from the main loop.
    tick: (dt) => { for (const c of held) heldSince.set(c, (heldSince.get(c) || 0) + dt); },
    endFrame: () => justPressed.clear(),
    dispose: () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}
