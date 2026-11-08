// In-page replacements for alert/confirm/prompt. Native dialogs are
// blocked in embedded views and look out of place in an installed app.
const Dialog = (() => {
  function open({ message, input, okLabel = 'OK', cancelLabel = 'Cancel', danger = false, cancel = true }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'dialog-backdrop';
      wrap.innerHTML = `
        <form class="dialog" role="dialog" aria-modal="true">
          <p class="dialog-msg"></p>
          ${input != null ? '<input id="dialog-input" class="dialog-input">' : ''}
          <div class="dialog-actions">
            ${cancel ? `<button type="button" class="btn" data-cancel>${cancelLabel}</button>` : ''}
            <button type="submit" class="btn ${danger ? 'danger-fill' : 'primary'}">${okLabel}</button>
          </div>
        </form>`;
      wrap.querySelector('.dialog-msg').textContent = message;
      const field = wrap.querySelector('input');
      if (field) field.value = input;
      const prevFocus = document.activeElement;
      const done = (value) => {
        wrap.remove();
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(value);
      };
      const onKey = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') done(input != null ? null : false);
      };
      document.addEventListener('keydown', onKey, true);
      wrap.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        done(input != null ? field.value : true);
      });
      const c = wrap.querySelector('[data-cancel]');
      if (c) c.addEventListener('click', () => done(input != null ? null : false));
      document.body.appendChild(wrap);
      (field || wrap.querySelector('[type=submit]')).focus();
    });
  }
  return {
    alert: (message) => open({ message, cancel: false }),
    confirm: (message, opts = {}) => open(Object.assign({ message }, opts)),
    prompt: (message, value = '') => open({ message, input: value, okLabel: 'Save' })
  };
})();
