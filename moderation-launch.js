/* Show the moderation shortcut only after the existing account permission check succeeds. */
(() => {
  'use strict';
  const member = document.getElementById('memberAccount');
  const heading = document.getElementById('memberHeading');
  const legacyPanel = document.getElementById('moderationPanel');
  if (!member || !heading || !legacyPanel) return;
  const row = document.createElement('div');
  row.className = 'profile-heading-row';
  heading.parentNode.insertBefore(row, heading);
  row.appendChild(heading);
  const link = document.createElement('a');
  link.className = 'moderation-launch';
  link.href = new URL('moderacao.html', document.currentScript.src).href;
  link.setAttribute('data-pt', '⚙ Moderação');
  link.setAttribute('data-en', '⚙ Moderation');
  link.textContent = document.documentElement.lang.startsWith('pt') ? '⚙ Moderação' : '⚙ Moderation';
  link.hidden = true;
  row.append(link);
  // The community controller verifies the session and staff privileges via is_moderator().
  // Reuse its result; a hidden button alone is not the security boundary.
  const sync = () => { link.hidden = member.hidden || legacyPanel.hidden; };
  new MutationObserver(sync).observe(member, {attributes:true, attributeFilter:['hidden']});
  new MutationObserver(sync).observe(legacyPanel, {attributes:true, attributeFilter:['hidden']});
  sync();
})();
