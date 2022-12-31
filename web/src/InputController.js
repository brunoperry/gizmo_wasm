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
  };
  static Buttons = new Array(3);
  static Button = {
    LEFT: 0,
    RIGHT: 2,
  };
  static DWheel = 0;
  static MouseX = null;
  static MouseY = null;
  static MouseDX = 0;
  static MouseDY = 0;

  static initialize() {
    for (let i = 0; i < InputController.Keys.length; i++) {
      InputController.Keys[i] = false;
    }

    //keyboard stuff
    document.addEventListener("keydown", (e) => {
      InputController.Keys[e.keyCode] = true;
      if (InputController.getKey(InputController.Key.SPACE)) {
        e.stopPropagation();
        e.preventDefault();
      }
    });
    document.addEventListener("keyup", (e) => (InputController.Keys[e.keyCode] = false));

    //mouse stuff

    let timerID = null;
    const cleanUp = () => {
      InputController.DWheel = 0;
      InputController.MouseDX = 0;
      InputController.MouseDY = 0;
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
      // InputController.MouseX = e.clientX;
      // InputController.MouseY = e.clientY;
      InputController.MouseDX = e.movementX;
      InputController.MouseDY = e.movementY;
      if (timerID) clearTimeout(timerID);
      timerID = setTimeout(cleanUp, 10);
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
