type GameTextInputOptions = {
  onEnter?: () => void;
};

export const configureGameTextInput = (input: HTMLInputElement, options?: GameTextInputOptions): void => {
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      options?.onEnter?.();
    }
  });

  for (const eventName of ["keyup", "keypress", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"]) {
    input.addEventListener(eventName, (event) => {
      event.stopPropagation();
    });
  }
};
