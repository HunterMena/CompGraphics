export function createControls({ onPickup, onFlashlightToggle, onRestart, onTurnLeft, onTurnRight, onTurnBack, onJump }) {
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    turnLeft: false,
    turnRight: false,
    space: false,
  };

  const down = (event) => {
    const k = event.key.toLowerCase();
    if (k === 'w') keys.w = true;
    if (k === 'a') keys.a = true;
    if (k === 's') keys.s = true;
    if (k === 'd') keys.d = true;
    if (k === 'arrowleft') keys.turnLeft = true;
    if (k === 'arrowright') keys.turnRight = true;
    if (k === 'e') {
      onPickup?.();
    }
    if (k === 'f') onFlashlightToggle?.();
    if (k === 'r') {
      onTurnBack?.();
      onRestart?.();
    }
    if (k === ' ') {
      keys.space = true;
      onJump?.();
      event.preventDefault();
    }
  };

  const up = (event) => {
    const k = event.key.toLowerCase();
    if (k === 'w') keys.w = false;
    if (k === 'a') keys.a = false;
    if (k === 's') keys.s = false;
    if (k === 'd') keys.d = false;
    if (k === 'arrowleft') keys.turnLeft = false;
    if (k === 'arrowright') keys.turnRight = false;
    if (k === ' ') keys.space = false;
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  return {
    keys,
    dispose() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    },
  };
}
