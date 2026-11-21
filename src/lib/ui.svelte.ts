// Small app-wide UI services: dialogs (prompt/confirm), toasts and haptics.

export interface DialogState {
  kind: 'prompt' | 'confirm' | 'choose';
  options?: { label: string; value: string; danger?: boolean }[];
  title: string;
  message?: string;
  value?: string;
  placeholder?: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

export const ui = $state<{ dialog: DialogState | null; toast: { id: number; text: string } | null; haptics: boolean }>({
  dialog: null,
  toast: null,
  haptics: true,
});

export function prompt(title: string, opts: { value?: string; placeholder?: string; confirmLabel?: string } = {}) {
  return new Promise<string | null>((resolve) => {
    ui.dialog = {
      kind: 'prompt',
      title,
      value: opts.value ?? '',
      placeholder: opts.placeholder,
      confirmLabel: opts.confirmLabel ?? 'Save',
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    };
  });
}

export function confirm(title: string, opts: { message?: string; confirmLabel?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    ui.dialog = {
      kind: 'confirm',
      title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'OK',
      danger: opts.danger,
      resolve: (v) => resolve(v === true),
    };
  });
}

/** Pick one of several options; resolves to the option's value, or null if cancelled. */
export function choose(title: string, message: string, options: { label: string; value: string; danger?: boolean }[]) {
  return new Promise<string | null>((resolve) => {
    ui.dialog = {
      kind: 'choose',
      title,
      message,
      options,
      confirmLabel: '',
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    };
  });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, ms = 2200) {
  ui.toast = { id: Date.now(), text };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = null), ms);
}

export function buzz(ms = 8) {
  if (ui.haptics) navigator.vibrate?.(ms);
}
