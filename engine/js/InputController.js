export default class InputController {
  static Keys = new Array(65536);
  static Key = {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    ESC: 27,
    SPACE: 32,
    J: 74,
    F: 70,
    C: 67,
    R: 82,
    P: 80,
    SHIFT: 16,
  };
  // Keys whose browser default (page scrolling) is blocked while held.
  static #NO_SCROLL = new Set([32, 37, 38, 39, 40]);
  static Buttons = new Array(3);
  static Button = {
    LEFT: 0,
    RIGHT: 2,
  };
  static DWheel = 0;
  static MouseX = 0;
  static MouseY = 0;
  static MouseDX = 0;
  static MouseDY = 0;

  static initialize() {
    for (let i = 0; i < InputController.Keys.length; i++) {
      InputController.Keys[i] = false;
    }

    //keyboard stuff
    document.addEventListener("keydown", (e) => {
      InputController.Keys[e.keyCode] = true;
      // Not while typing in a form field.
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (InputController.#NO_SCROLL.has(e.keyCode) && !typing) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
    document.addEventListener("keyup", (e) => (InputController.Keys[e.keyCode] = false));
    // Keys released while the window wasn't focused never send keyup.
    window.addEventListener("blur", () => InputController.Keys.fill(false));

    //mouse stuff

    let timerID = null;
    const cleanUp = () => {
      InputController.DWheel = 0;
    };
    document.addEventListener("mousedown", (e) => {
      InputController.Buttons[e.which - 1] = true;
      InputController.MouseX = e.clientX;
      InputController.MouseY = e.clientY;
    });
    document.addEventListener("mouseup", (e) => {
      InputController.MouseX = null;
      InputController.MouseY = null;
      InputController.Buttons[e.which - 1] = false;
    });

    document.addEventListener("mousemove", (e) => {
      // Only mouse look counts: moving over the page while unlocked would
      // make the camera jump when play starts.
      if (!document.pointerLockElement) return;
      // Chrome sometimes reports a huge jump right after locking: drop it.
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      // Accumulate: several mousemove events can fire between two frames.
      InputController.MouseDX += e.movementX;
      InputController.MouseDY += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      InputController.MouseDX = 0;
      InputController.MouseDY = 0;
    });

    document.addEventListener(
      "wheel",
      (e) => {
        InputController.DWheel = e.deltaY;
        if (timerID) clearTimeout(timerID);
        timerID = setTimeout(cleanUp, 10);
      },
      { passive: true }
    );
  }

  /**
   * Returns the mouse movement since the last call and resets it.
   * Call once per frame.
   */
  static consumeMouseDelta() {
    const delta = { dx: InputController.MouseDX, dy: InputController.MouseDY };
    InputController.MouseDX = 0;
    InputController.MouseDY = 0;
    return delta;
  }

  static getValues() {
    return [
      InputController.Keys[InputController.Key.W],
      InputController.Keys[InputController.Key.A],
      InputController.Keys[InputController.Key.S],
      InputController.Keys[InputController.Key.D],
      InputController.Keys[InputController.Key.J],
    ];
  }

  /**
   * @param {number} keyCode
   * @returns {boolean}
   */
  static getKey(keyCode) {
    return InputController.Keys[keyCode];
  }
  static setKey(keyCode, value) {
    InputController.Keys[keyCode] = value;
  }
  static getButton(buttonCode) {
    return InputController.Buttons[buttonCode];
  }
}
