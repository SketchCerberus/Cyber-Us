/* Shared episode panel. The page supplies only its canonical episode slug. */
(() => {
  'use strict';
  const root = document.querySelector('[data-community-episode]');
  if (!root) return;
  const panel = document.createElement('section');
  panel.className = 'community-panel';
  panel.setAttribute('aria-labelledby', 'communityHeading');
  panel.innerHTML = `
    <h2 id="communityHeading" data-pt="Converse sobre este episódio" data-en="Discuss this episode">Converse sobre este episódio</h2>
    <p class="community-hint" data-pt="Comentários e votos são compartilhados entre as versões em português e inglês. A leitura não exige conta." data-en="Comments and votes are shared by the Portuguese and English versions. Reading does not require an account.">Comentários e votos são compartilhados entre as versões em português e inglês. A leitura não exige conta.</p>
    <p id="communityStatus" class="community-notice" role="status" aria-live="polite" data-pt="Carregando a comunidade…" data-en="Loading the community…">Carregando a comunidade…</p>
    <div class="community-votes" role="group" aria-label="Reações ao episódio"><button id="voteLike" class="community-vote" type="button" aria-pressed="false" disabled><span aria-hidden="true">👍</span> <span data-pt="Gostei" data-en="Like">Gostei</span> <span id="likeCount" aria-live="polite">—</span></button><button id="voteDislike" class="community-vote" type="button" aria-pressed="false" disabled><span aria-hidden="true">👎</span> <span data-pt="Não gostei" data-en="Dislike">Não gostei</span> <span id="dislikeCount" aria-live="polite">—</span></button></div>
    <p id="joinCommunity" class="community-hint"><a href="../comunidade.html" data-pt="Entre na sua conta para votar e comentar." data-en="Sign in to vote and comment.">Entre na sua conta para votar e comentar.</a></p>
    <h3 data-pt="Comentários" data-en="Comments">Comentários</h3>
    <form id="commentForm" class="community-form" hidden><label for="commentBody" data-pt="Seu comentário (até 2.000 caracteres)" data-en="Your comment (up to 2,000 characters)">Seu comentário (até 2.000 caracteres)</label><textarea id="commentBody" maxlength="2000" minlength="1" rows="4" required></textarea><button type="submit" class="action" data-pt="Publicar comentário" data-en="Post comment">Publicar comentário</button></form>
    <ol id="commentList" class="comment-list" aria-live="polite"></ol><button id="moreComments" class="community-more" type="button" hidden data-pt="Carregar mais comentários" data-en="Load more comments">Carregar mais comentários</button>`;
  root.append(panel);
  if (document.documentElement.lang === 'en') {
    panel.querySelectorAll('[data-en]').forEach(item => { item.textContent = item.dataset.en; });
  }
})();
