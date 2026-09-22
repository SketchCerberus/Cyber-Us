/* Private trash listing: access and restoration are validated by Supabase RPCs. */
(() => {
  'use strict';
  const root=document.getElementById('moderationWorkspace');
  const tabs=document.querySelector('.moderation-tabs');
  if(!root||!tabs||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co','sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c', {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const t=(pt,en)=>document.documentElement.lang.startsWith('pt')?pt:en;
  const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const tab=element('button','community-action');tab.type='button';tab.id='moderationTrashTab';tab.setAttribute('aria-pressed','false');
  const view=element('section','moderation-trash');view.id='moderationTrashView';view.hidden=true;
  const heading=element('h2');heading.id='moderationTrashTitle';view.setAttribute('aria-labelledby',heading.id);
  const description=element('p','community-hint');
  const refresh=element('button','community-action');refresh.type='button';
  const status=element('p','community-notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=element('ol','comment-list');view.append(heading,description,refresh,status,list);tabs.append(tab);root.append(view);
  const labels=()=>{tab.textContent=t('Lixeira','Trash');heading.textContent=t('Lixeira','Trash');description.textContent=t('Comentários e fanarts removidos ficam privados por dois meses. Após esse prazo, a limpeza é automática. Denúncias abertas podem adiar a exclusão.','Removed comments and artwork are kept privately for two months, then cleaned up automatically. Open reports may delay deletion.');refresh.textContent=t('Atualizar','Refresh');};
  const say=(pt,en,error=false)=>{status.textContent=t(pt,en);status.classList.toggle('error',error);};
  const date=value=>new Intl.DateTimeFormat(document.documentElement.lang.startsWith('pt')?'pt-BR':'en',{dateStyle:'medium'}).format(new Date(value));
  let sequence=0;
  async function load(){
    const ticket=++sequence;refresh.disabled=true;list.replaceChildren();say('Carregando…','Loading…');
    const permission=await db.rpc('is_moderator');if(ticket!==sequence)return;
    if(permission.error||permission.data!==true||root.hidden||view.hidden){refresh.disabled=false;say('Acesso restrito.','Restricted access.',true);return;}
    const result=await db.rpc('moderation_trash');if(ticket!==sequence)return;
    refresh.disabled=false;
    if(result.error){say('Falha ao carregar lixeira.','Could not load trash.',true);return;}
    const items=result.data||[];say(`${items.length} item(ns).`,`${items.length} item(s).`);
    for(const item of items){
      const li=element('li','comment-item');
      li.append(element('strong','',item.title),element('p','comment-body',item.preview||''),element('p','comment-meta',`${t('Excluído','Removed')}: ${date(item.removed_at)} · ${t('Prazo','Deadline')}: ${date(item.expires_at)}`));
      if(item.restorable){
        const button=element('button','community-action',t('Restaurar','Restore'));button.type='button';
        button.addEventListener('click',async()=>{
          const reason=window.prompt(t('Justificativa (3–500 caracteres):','Reason (3–500 characters):'));
          if(!reason||reason.trim().length<3||reason.trim().length>500)return;
          if(!window.confirm(t('Confirmar restauração?','Confirm restoration?')))return;
          button.disabled=true;
          const output=item.kind==='fanart'
            ? await window.CyberUsTrashRestore?.(db,item.item_id,reason.trim())
            : await db.rpc('restore_trash_comment',{p_kind:item.kind,p_id:item.item_id,p_reason:reason.trim()});
          if(!output||output.error||output.data!==true){say('Não foi possível restaurar.','Could not restore.',true);button.disabled=false;return;}
          await load();say('Item restaurado.','Item restored.');
        });
        li.append(button);
      }
      list.append(li);
    }
  }
  tab.addEventListener('click',()=>{
    if(root.hidden)return;
    root.querySelectorAll('[id$="View"]').forEach(section=>section.hidden=true);
    tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'));
    tab.setAttribute('aria-pressed','true');view.hidden=false;load();
  });
  tabs.addEventListener('click',event=>{if(event.target!==tab){view.hidden=true;tab.setAttribute('aria-pressed','false');++sequence;}});
  refresh.addEventListener('click',load);
  db.auth.onAuthStateChange(()=>{++sequence;list.replaceChildren();view.hidden=true;});
  new MutationObserver(()=>{labels();if(!view.hidden)load();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  labels();
})();
