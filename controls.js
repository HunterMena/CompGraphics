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
    const c = event.code;
    if (c === 'KeyW') keys.w = true;
    if (c === 'KeyA') keys.a = true;
    if (c === 'KeyS') keys.s = true;
    if (c === 'KeyD') keys.d = true;
    if (c === 'ArrowLeft') keys.turnLeft = true;
    if (c === 'ArrowRight') keys.turnRight = true;
    if (c === 'KeyE') {
      onPickup?.();
    }
    if (c === 'KeyF') onFlashlightToggle?.();
    if (c === 'KeyR') {
      onTurnBack?.();
      onRestart?.();
    }
    if (c === 'Space') {
      keys.space = true;
      onJump?.();
      event.preventDefault();
    }
  };

  const up = (event) => {
    const c = event.code;
    if (c === 'KeyW') keys.w = false;
    if (c === 'KeyA') keys.a = false;
    if (c === 'KeyS') keys.s = false;
    if (c === 'KeyD') keys.d = false;
    if (c === 'ArrowLeft') keys.turnLeft = false;
    if (c === 'ArrowRight') keys.turnRight = false;
    if (c === 'Space') keys.space = false;
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
