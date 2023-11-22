import {
  KeyEvent,
  OutputHandler,
  PrintOptions,
  VM
} from 'greybel-interpreter';

import PseudoTerminal from '../helper/pseudo-terminal';
import transform from '../helper/text-mesh-transform';
import transformStringToKeyEvent from '../helper/transform-string-to-key-event';

export class VSOutputHandler extends OutputHandler {
  static previousTerminal: PseudoTerminal | null;

  private _terminal: PseudoTerminal;
  private _hideUnsupportedTags: boolean;

  constructor(hideUnsupportedTags: boolean) {
    super();

    VSOutputHandler.previousTerminal?.dispose();

    this._terminal = new PseudoTerminal('greybel');
    this._hideUnsupportedTags = hideUnsupportedTags;

    VSOutputHandler.previousTerminal = this._terminal;
    this._terminal.focus();
  }

  print(
    _vm: VM,
    message: string,
    { appendNewLine = true, replace = false }: Partial<PrintOptions> = {}
  ) {
    const transformed = transform(message, this._hideUnsupportedTags).replace(
      /\\n/g,
      '\n'
    );

    if (replace) {
      this._terminal.replace(transformed);
      return;
    }

    this._terminal.print(transformed, appendNewLine);
  }

  clear() {
    this._terminal.clear();
  }

  progress(vm: VM, timeout: number): PromiseLike<void> {
    const startTime = Date.now();
    const max = 20;

    this._terminal.print(`[${'-'.repeat(max)}]`);

    return new Promise((resolve, _reject) => {
      const onExit = () => {
        clearInterval(interval);
        resolve();
      };
      const interval = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;

        if (elapsed > timeout) {
          this._terminal.updateLast(`[${'#'.repeat(max)}]`);
          vm.getSignal().removeListener('exit', onExit);
          clearInterval(interval);
          resolve();
          return;
        }

        const elapsedPercentage = (100 * elapsed) / timeout;
        const progress = Math.floor((elapsedPercentage * max) / 100);
        const right = max - progress;

        this._terminal.updateLast(
          `[${'#'.repeat(progress)}${'-'.repeat(right)}]`
        );
      });

      vm.getSignal().once('exit', onExit);
    });
  }

  waitForInput(
    vm: VM,
    isPassword: boolean,
    message: string
  ): PromiseLike<string> {
    this.print(vm, message, {
      appendNewLine: false
    });
    return PseudoTerminal.getActiveTerminal().waitForInput(vm, isPassword);
  }

  waitForKeyPress(
    vm: VM,
    message: string
  ): PromiseLike<KeyEvent> {
    this.print(vm, message, {
      appendNewLine: false
    });

    return PseudoTerminal.getActiveTerminal()
      .waitForKeyPress(vm)
      .then((key) => {
        return transformStringToKeyEvent(key);
      });
  }

  get terminal(): PseudoTerminal {
    return this._terminal;
  }
}
