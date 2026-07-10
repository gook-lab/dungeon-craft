// Scene stack (locked via /plan-eng-review D1). Field is the base scene;
// menu/dialog/shop PUSH as overlays (scenes below stay visible); battle/title
// PUSH as opaque scenes (everything below is hidden but state is preserved, so
// popping a battle resumes the field exactly where it was).
//
// Only the TOP scene receives update()/input. Render is retained-mode (Pixi):
// scenes mutate their own container; visibility is recomputed on every push/pop.
//
//   STACK (top = last):  [Dialog]  overlay → visible, gets update
//                        [Field]   base    → visible (under overlay), no update
//   battle:              push [Battle] opaque → Field hidden, state kept
//                        pop  → Field visible again

export function createSceneManager(root) {
  const stack = [];

  function recomputeVisibility() {
    // Find topmost opaque scene; hide everything below it.
    let firstVisible = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].opaque) { firstVisible = i; break; }
    }
    stack.forEach((s, i) => { s.container.visible = i >= firstVisible; });
  }

  const mgr = {
    get top() { return stack[stack.length - 1] || null; },
    get depth() { return stack.length; },

    push(scene, args) {
      root.addChild(scene.container);
      stack.push(scene);
      recomputeVisibility();
      scene.enter?.(args);
      return scene;
    },

    pop() {
      const s = stack.pop();
      if (!s) return null;
      s.exit?.();
      root.removeChild(s.container);
      s.container.destroy?.({ children: true });
      recomputeVisibility();
      return s;
    },

    // Pop the current top and push a new scene (used sparingly; battle uses
    // push/pop to preserve the field underneath).
    replace(scene, args) {
      this.pop();
      return this.push(scene, args);
    },

    update(dt) {
      this.top?.update?.(dt);
    },

    resize(w, h) {
      stack.forEach((s) => s.resize?.(w, h));
    },
  };
  return mgr;
}
