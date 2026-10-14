/* Shared, offline lesson behavior. No analytics, network requests, or stored answers. */
'use strict';
document.addEventListener('DOMContentLoaded', () => {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
      throwOnError: false, strict: 'warn', trust: false
    });
  }
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(a => {
    if (a.getAttribute('href').split('/').pop() === path) a.setAttribute('aria-current','page');
  });
  document.querySelectorAll('.table-wrap').forEach(wrap => {
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', wrap.querySelector('caption')?.textContent.trim() || 'Scrollable data table');
  });
  document.querySelectorAll('.katex-display').forEach(equation => {
    equation.tabIndex = 0;
    equation.setAttribute('role', 'region');
    equation.setAttribute('aria-label', 'Scrollable equation');
  });
  document.querySelectorAll('.plot-area').forEach(region => {
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    if (!region.hasAttribute('aria-label')) {
      region.setAttribute('aria-label', region.querySelector('svg')?.getAttribute('aria-label') || 'Scrollable experiment figures');
    }
  });
});
