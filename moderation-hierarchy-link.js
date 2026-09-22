/* Open the protected Staff tab after the normal authorization checks finish. */
(() => {
  'use strict';
  if (location.hash !== '#staffHierarchyView') return;
  let active = false;
  const open = () => {
    if (active) return;
    const tab = document.getElementById('staffHierarchyTab');
    const workspace = document.getElementById('moderationWorkspace');
    if (!tab || tab.hidden || !workspace || workspace.hidden) return;
    active = true;
    observer.disconnect();
    tab.click();
    document.getElementById('staffHierarchyView')?.scrollIntoView({block: 'start'});
  };
  const observer = new MutationObserver(open);
  observer.observe(document.body, {childList: true, subtree: true, attributes: true,
    attributeFilter: ['hidden']});
  open();
  window.setTimeout(() => observer.disconnect(), 15000);
})();
