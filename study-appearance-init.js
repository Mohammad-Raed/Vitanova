/* Resolve the saved appearance before the lecture stylesheet paints. */
(() => {
  const root = document.documentElement;
  const device = matchMedia('(prefers-color-scheme: dark)');
  let saved, legacy;
  try {
    legacy = localStorage.getItem('vitanova:theme:v1');
    saved = JSON.parse(localStorage.getItem('vitanova:appearance:v1'));
  } catch {}
  const palette = ['atlas', 'linen', 'orchid', 'graphite'].includes(saved?.palette) ? saved.palette : 'atlas';
  const mode = ['light', 'dark', 'auto'].includes(saved?.mode) ? saved.mode : legacy;
  root.dataset.palette = palette;
  root.dataset.theme = ['light', 'dark'].includes(mode) ? mode : device.matches ? 'dark' : 'light';
})();
