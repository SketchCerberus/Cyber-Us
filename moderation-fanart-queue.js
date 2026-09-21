/* Review real fanart submissions inside the existing moderator-only Fanarts tab. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const view=$('moderationFanartsView'),tab=$('moderationFanartsTab');
  if(!view||!tab||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const queue=el('section','fanart-review-queue');queue.id='fanartReviewQueue';
  const heading=el('h3');const hint=el('p','community-hint');
  const controls=el('div','community-actions');
  const label=el('label');const filter=el('select');
  filter.id='fanartQueueFilter';label.htmlFor=filter.id;
  const statuses=[['pending','Pendentes','Pending'],['approved','Aprovadas','Approved'],
    ['rejected','Rejeitadas','Rejected'],['removed','Removidas','Removed'],['withdrawn','Retiradas','Withdrawn']];
  for(const [value,br,en] of statuses){const option=el('option','',t(br,en));option.value=value;option.dataset.pt=br;option.dataset.en=en;filter.append(option);}
  const reload=el('button','community-action');reload.type='button';
  const list=el('ol','comment-list');list.id='fanartReviewList';
  const more=el('button','community-more');more.type='button';more.hidden=true;
  const message=el('p','community-notice');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  controls.append(label,filter,reload);queue.append(heading,hint,controls,message,list,more);
  view.insertBefore(queue,view.children[2]||null);
  let offset=0,request=0,authorized=false;
  const notice=(text,error=false)=>{message.textContent=text;message.classList.toggle('error',error);};
  const date=value=>value?new Intl.DateTimeFormat(pt()?'pt-BR':'en',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'';
  const statusLabel=value=>{const item=statuses.find(row=>row[0]===value);return item?item[pt()?1:2]:value;};
  function translate(){
    heading.textContent=t('Obras recebidas para revisão','Submitted artwork review');
    hint.textContent=t('Confira a arte e o autor antes de aprovar, rejeitar, retirar ou banir. Ações exigem motivo e ficam registradas.','Check the artwork and account before approving, rejecting, removing or banning. Actions require a reason and are logged.');
    label.textContent=t('Mostrar obras','Show artwork');reload.textContent=t('Atualizar fila','Refresh queue');
    more.textContent=t('Carregar mais obras','Load more artwork');
    for(const option of filter.options)option.textContent=pt()?option.dataset.pt:option.dataset.en;
  }
  async function auth(){
    const result=await db.auth.getUser();
    if(result.error||!result.data?.user)return false;
    const staff=await db.rpc('is_moderator');
    return !staff.error&&staff.data===true;
  }
  function confirmAction(art,action) {
    return window.confirm(t(`Confirmar ação sobre "${art.title}" da conta ${art.owner_id}?`,`Confirm action on "${art.title}" by account ${art.owner_id}?`));
  }
  async function decision(art,action,button) {
    const prompt=action==='approve'?t('Justificativa da aprovação (5–500 caracteres):','Approval note (5–500 characters):'):
      t('Motivo da moderação (5–500 caracteres; visível ao autor):','Moderation reason (5–500 characters; visible to the artist):');
    const reason=window.prompt(prompt);
    if(!reason||reason.trim().length<5||reason.trim().length>500||!confirmAction(art,action))return;
    button.disabled=true;
    const response=await db.rpc('moderate_fanart',{p_id:art.id,p_action:action,p_reason:reason.trim()});
    if(response.error){notice(response.error.message||t('Erro na ação.','Action failed.'),true);button.disabled=false;return;}
    notice(t('Obra atualizada.','Artwork updated.'));
    await load(false);
  }
  async function banAuthor(art,button) {
    const reason=window.prompt(t('Motivo específico do banimento (5–500 caracteres):','Specific ban reason (5–500 characters):'));
    if(!reason||reason.trim().length<5||reason.trim().length>500)return;
    const duration=window.prompt(t('Dias: 0 = permanente, 1–3650 = temporário.','Days: 0 = permanent, 1–3650 = temporary.'),'7');
    if(duration===null||!/^(0|[1-9][0-9]{0,3})$/.test(duration)||Number(duration)>3650)return;
    if(!window.confirm(t(`Banir a conta ${art.owner_id} da comunidade inteira por esta obra?`,
      `Ban account ${art.owner_id} from the entire community for this artwork?`)))return;
    button.disabled=true;
    const expiry=Number(duration)?new Date(Date.now()+Number(duration)*86400000).toISOString():null;
    const result=await db.rpc('ban_fanart_author',{p_id:art.id,p_reason:reason.trim(),p_expires_at:expiry});
    if(result.error){notice(result.error.message||t('Falha ao banir.','Ban failed.'),true);button.disabled=false;return;}
    notice(t('Banimento vinculado à obra e registrado.','Ban recorded and linked to artwork.'));
    await load(false);
  }
  async function makeCard(art,ticket) {
    const card=el('li','comment-item fanart-review-card');
    card.append(el('strong','',art.title),el('p','comment-meta',
      `${art.artist} · ${art.owner_id} · ${statusLabel(art.status)} · ${date(art.created_at)}`));
    const signed=await db.storage.from('cyber-fanarts').createSignedUrl(art.image_path,60);
    if(ticket!==request||!authorized)return null;
    if(!signed.error&&signed.data?.signedUrl) {
      const img=el('img','fanart-review-image');img.src=signed.data.signedUrl;
      img.alt=`${art.title} — ${art.artist}`;img.loading='lazy';img.referrerPolicy='no-referrer';card.append(img);
    }else card.append(el('p','community-hint',t('Prévia indisponível.','Preview unavailable.')));
    if(art.region)card.append(el('p','comment-meta',`${t('Região informada','Submitted region')}: ${art.region} · ${t('Exibir?','Display?')} ${art.show_region?t('Sim','Yes'):t('Não','No')}`));
    if(art.tags?.length)card.append(el('p','comment-meta',art.tags.map(tag=>'#'+tag).join(' ')));
    if(art.artist_url)card.append(el('p','comment-meta',art.artist_url));
    if(art.review_note)card.append(el('p','comment-body',`${t('Nota da moderação','Moderation note')}: ${art.review_note}`));
    const actions=el('div','community-actions');
    const available=art.status==='pending'?[['approve','Aprovar','Approve'],['reject','Rejeitar','Reject']]:
      art.status==='approved'?[['remove','Retirar da galeria','Remove from gallery']]:[];
    for(const [action,br,en] of available){const button=el('button','community-action',t(br,en));
      button.type='button';button.addEventListener('click',()=>decision(art,action,button));actions.append(button);}
    if(art.status!=='withdrawn'){
      const ban=el('button','community-action danger',t('Banir autor','Ban author'));ban.type='button';
      ban.addEventListener('click',()=>banAuthor(art,ban));actions.append(ban);
    }
    card.append(actions);return card;
  }
  async function load(next=false) {
    const ticket=++request;
    if(tab.hidden||view.hidden)return;
    authorized=false;more.disabled=true;reload.disabled=true;
    if(!next){offset=0;list.replaceChildren();}
    notice(t('Verificando acesso e carregando obras…','Checking access and loading artwork…'));
    try{
      if(!await auth())throw Error(t('Acesso restrito.','Restricted access.'));
      if(ticket!==request)return;
      authorized=true;
      const response=await db.rpc('moderation_fanart_queue',{p_status:filter.value,p_offset:offset});
      if(ticket!==request||!authorized)return;
      if(response.error)throw response.error;
      const rows=response.data||[];
      for(const art of rows){const card=await makeCard(art,ticket);if(ticket!==request||!authorized)return;if(card)list.append(card);}
      offset+=rows.length;more.hidden=rows.length<25;
      notice(!rows.length&&!next?t('Nenhuma obra neste estado.','No artwork in this status.'):
        t('Obras carregadas.','Artwork loaded.'));
    }catch(error){if(ticket===request)notice(error?.message||t('Falha ao carregar.','Could not load.'),true);}
    finally{if(ticket===request){more.disabled=false;reload.disabled=false;}}
  }
  tab.addEventListener('click',()=>load(false));
  reload.addEventListener('click',()=>load(false));
  filter.addEventListener('change',()=>load(false));
  more.addEventListener('click',()=>load(true));
  db.auth.onAuthStateChange(()=>{++request;authorized=false;list.replaceChildren();more.hidden=true;});
  new MutationObserver(()=>{translate();if(!view.hidden)load(false);})
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();
})();
