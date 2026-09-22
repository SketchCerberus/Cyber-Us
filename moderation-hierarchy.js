/* Creator / Right Hand staff administration. All decisions are enforced by server RPCs. */
(() => {
  'use strict';
  const workspace=document.getElementById('moderationWorkspace');
  const tabs=workspace?.querySelector('.moderation-tabs');
  if(!workspace||!tabs||!window.supabase?.createClient)return;
  const db=window.supabase.createClient('https://znenamrszhjsiztllcit.supabase.co',
    'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
    {auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const pt=()=>document.documentElement.lang.startsWith('pt');
  const t=(br,en)=>pt()?br:en;
  const elem=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;
    if(text!==undefined)x.textContent=text;return x;};
  const tab=elem('button','community-action');tab.type='button';tab.hidden=true;
  tab.id='staffHierarchyTab';tab.setAttribute('aria-pressed','false');tabs.append(tab);
  const view=elem('section','staff-hierarchy');view.hidden=true;view.id='staffHierarchyView';
  const title=elem('h2'),intro=elem('p','community-hint'),notice=elem('p','community-notice');
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const form=elem('form','community-form staff-assign-form');
  const username=elem('input');username.required=true;username.autocomplete='off';
  username.maxLength=24;username.pattern='[A-Za-z0-9_]{3,24}';
  const usernameLabel=elem('label');usernameLabel.append(username);
  const role=elem('select');
  for(const value of ['moderator','right_hand']){const option=elem('option');option.value=value;role.append(option);}
  const roleLabel=elem('label');roleLabel.append(role);
  const send=elem('button','community-action');send.type='submit';form.append(usernameLabel,roleLabel,send);
  const rosterTitle=elem('h3'),roster=elem('ol','comment-list');
  const requestTitle=elem('h3'),requests=elem('ol','comment-list');
  const appealTitle=elem('h3'),appeals=elem('ol','comment-list');
  const refresh=elem('button','community-action');refresh.type='button';
  view.append(title,intro,form,notice,refresh,rosterTitle,roster,requestTitle,requests,appealTitle,appeals);
  workspace.append(view);
  let ownRole=null,identity=0,loading=0;
  const say=(text,bad=false)=>{notice.textContent=text;notice.classList.toggle('error',bad);};
  const reason=(br,en,min=5,max=500)=>{
    const input=window.prompt(t(br,en));
    return input&&input.trim().length>=min&&input.trim().length<=max?input.trim():null;
  };
  const button=(br,en,action,danger=false)=>{
    const x=elem('button','community-action'+(danger?' danger':''),t(br,en));x.type='button';
    x.addEventListener('click',async()=>{
      x.disabled=true;
      try{await action();}catch(error){say(error.message||t('Falha na operação.','Operation failed.'),true);}
      finally{x.disabled=false;}
    });return x;
  };
  async function rpc(name,args){const result=await db.rpc(name,args);if(result.error)throw result.error;return result.data;}
  async function resolveUsername(name){
    const result=await db.from('profiles').select('id,username').eq('username',name.toLowerCase()).maybeSingle();
    if(result.error)throw result.error;
    if(!result.data?.id)throw Error(t('Conta não encontrada.','Account not found.'));
    return result.data.id;
  }
  function labelInput(label,input,br,en){label.replaceChildren(document.createTextNode(t(br,en)),input);}
  function sync(){
    tab.textContent=t('Equipe','Staff');title.textContent=t('Hierarquia da equipe','Staff hierarchy');
    intro.textContent=ownRole==='creator'
      ? t('Você é o Criador. Só você autoriza cargos, decisões sobre moderadores e seus recursos.',
        'You are the Creator. Only you approve staff roles, staff discipline and appeals.')
      : t('Você é Braço Direito. Solicitações sobre moderadores dependem do Criador.',
        'You are Right Hand. Actions affecting moderators require Creator approval.');
    labelInput(usernameLabel,username,'Usuário (sem @): ','Username (without @): ');
    labelInput(roleLabel,role,'Cargo: ','Role: ');
    role.options[0].text=t('Moderador normal','Normal moderator');
    role.options[1].text=t('Braço Direito','Right Hand');
    role.options[1].hidden=ownRole!=='creator';
    if(ownRole!=='creator')role.value='moderator';
    send.textContent=ownRole==='creator'?t('Conceder cargo','Grant role'):t('Solicitar nomeação','Request appointment');
    refresh.textContent=t('Atualizar','Refresh');
    rosterTitle.textContent=t('Equipe atual','Current staff');
    requestTitle.textContent=t('Solicitações para aprovação','Approval requests');
    appealTitle.textContent=t('Recursos de moderadores','Moderator appeals');
    requestTitle.hidden=requests.hidden=appealTitle.hidden=appeals.hidden=ownRole!=='creator';
  }
  async function load(){
    if(!ownRole)return;
    const ticket=++loading;say(t('Carregando equipe…','Loading staff…'));
    try{
      const people=await rpc('staff_roster');if(ticket!==loading)return;
      roster.replaceChildren();
      if(!people?.length)roster.append(elem('li','community-hint',t('Ainda não há outros moderadores.','No other moderators yet.')));
      for(const person of people||[]){
        const li=elem('li','comment-item');
        const name=person.display_name||person.username||person.user_id;
        const rank=person.role==='creator'?t('Criador','Creator'):
          person.role==='right_hand'?t('Braço Direito','Right Hand'):t('Moderador normal','Normal moderator');
        li.append(elem('strong','',`${name} · ${rank}`));
        // The Creator's own account is displayed, but never gets remove/ban buttons.
        if(person.role==='creator'){roster.append(li);continue;}
        const actions=elem('div','community-actions');
        if(ownRole==='creator'){
          const next=person.role==='right_hand'?'moderator':'right_hand';
          actions.append(button(next==='right_hand'?'Promover':'Rebaixar',next==='right_hand'?'Promote':'Demote',async()=>{
            const why=reason('Motivo da mudança (5–500 caracteres):','Reason for role change (5–500 characters):');
            if(!why||!window.confirm(t('Confirmar mudança de cargo?','Confirm role change?')))return;
            await rpc('staff_assign',{p_user_id:person.user_id,p_role:next,p_reason:why});
            say(t('Cargo atualizado.','Role updated.'));await load();
          }));
        }
        if(person.role==='moderator'||ownRole==='creator'){
          actions.append(button(ownRole==='creator'?'Remover cargo':'Solicitar remoção',
            ownRole==='creator'?'Remove role':'Request removal',async()=>{
              const why=reason('Motivo da remoção (5–500 caracteres):','Removal reason (5–500 characters):');
              if(!why||!window.confirm(t('Confirmar solicitação?','Confirm request?')))return;
              if(ownRole==='creator')await rpc('staff_assign',{p_user_id:person.user_id,p_role:'remove',p_reason:why});
              else await rpc('staff_request',{p_user_id:person.user_id,p_kind:'remove_normal',p_reason:why});
              say(ownRole==='creator'?t('Cargo removido.','Role removed.'):t('Pedido enviado ao Criador.','Request sent to Creator.'));await load();
            },true));
          actions.append(button(ownRole==='creator'?'Banir moderador':'Solicitar banimento permanente',
            ownRole==='creator'?'Ban staff':'Request permanent ban',async()=>{
              const why=reason('Motivo do banimento (5–500 caracteres):','Ban reason (5–500 characters):');
              if(!why||!window.confirm(t('Confirmar banimento ou pedido?','Confirm ban or request?')))return;
              if(ownRole==='creator'){
                const days=window.prompt(t('Duração em dias (0 = permanente, máximo 3650):',
                  'Duration in days (0 = permanent, max 3650):'),'7');
                if(days===null||!/^(0|[1-9][0-9]{0,3})$/.test(days)||Number(days)>3650)return;
                await rpc('creator_ban_staff',{p_user_id:person.user_id,p_reason:why,
                  p_expires_at:Number(days)?new Date(Date.now()+Number(days)*86400000).toISOString():null});
              }else await rpc('staff_request',{p_user_id:person.user_id,p_kind:'ban_normal',p_reason:why});
              say(ownRole==='creator'?t('Banimento registrado.','Ban recorded.'):t('Pedido enviado ao Criador.','Request sent to Creator.'));await load();
            },true));
        }
        if(ownRole==='creator')actions.append(button('Desbanir (se necessário)','Unban (if needed)',async()=>{
          const why=reason('Motivo do desbanimento (5–500 caracteres):','Unban reason (5–500 characters):');
          if(!why)return;
          const done=await rpc('unban_member',{p_user_id:person.user_id,p_reason:why});
          say(done?t('Conta desbanida.','Account unbanned.'):t('Não havia banimento ativo.','No active ban.'));await load();
        }));
        li.append(actions);roster.append(li);
      }
      if(ownRole==='creator'){
        const [pending,review]=await Promise.all([rpc('staff_pending_requests'),rpc('staff_pending_role_appeals')]);
        if(ticket!==loading)return;
        requests.replaceChildren();appeals.replaceChildren();
        if(!pending?.length)requests.append(elem('li','community-hint',t('Nenhuma solicitação pendente.','No pending requests.')));
        for(const req of pending||[]){
          const li=elem('li','comment-item');
          const kind={grant_normal:t('Nomear moderador','Appoint moderator'),
            remove_normal:t('Remover moderador','Remove moderator'),
            ban_normal:t('Banir moderador permanentemente','Permanently ban moderator')}[req.kind];
          li.append(elem('strong','',`${kind} · ${req.target_name||req.target_id}`),
            elem('p','comment-meta',`${t('Solicitado por','Requested by')}: ${req.requester||req.requested_by}`),
            elem('p','comment-body',req.reason));
          const actions=elem('div','community-actions');
          for(const [approved,br,en] of [[true,'Aprovar','Approve'],[false,'Recusar','Reject']])
            actions.append(button(br,en,async()=>{
              const note=reason('Justificativa da decisão (5–500 caracteres):','Decision reason (5–500 characters):');
              if(!note||!window.confirm(t('Confirmar esta decisão?','Confirm this decision?')))return;
              await rpc('staff_decide_request',{p_request_id:req.request_id,p_approve:approved,p_note:note});
              say(t('Decisão registrada.','Decision recorded.'));await load();
            }));
          li.append(actions);requests.append(li);
        }
        if(!review?.length)appeals.append(elem('li','community-hint',t('Nenhum recurso pendente.','No pending appeals.')));
        for(const item of review||[]){
          const li=elem('li','comment-item');
          li.append(elem('strong','',item.display_name||item.user_id),
            elem('p','comment-body',`${t('Motivo da remoção','Removal reason')}: ${item.reason}`),
            elem('p','comment-body',`${t('Recurso','Appeal')}: ${item.body}`));
          const actions=elem('div','community-actions');
          for(const [approved,br,en] of [[true,'Restaurar cargo','Restore role'],[false,'Negar recurso','Reject appeal']])
            actions.append(button(br,en,async()=>{
              const note=reason('Justificativa (5–500 caracteres):','Decision note (5–500 characters):');
              if(!note||!window.confirm(t('Confirmar decisão sobre recurso?','Confirm appeal decision?')))return;
              await rpc('staff_decide_role_appeal',{p_appeal_id:item.appeal_id,p_approve:approved,p_note:note});
              say(t('Recurso analisado.','Appeal reviewed.'));await load();
            }));
          li.append(actions);appeals.append(li);
        }
      }
      say(t('Equipe atualizada.','Staff updated.'));
    }catch(error){if(ticket===loading)say(error.message||t('Não foi possível carregar.','Unable to load.'),true);}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ownRole||send.disabled)return;
    send.disabled=true;
    try{
      const id=await resolveUsername(username.value.trim());
      const why=reason('Motivo da nomeação (5–500 caracteres):','Appointment reason (5–500 characters):');
      if(!why)return;
      if(ownRole==='creator')await rpc('staff_assign',{p_user_id:id,p_role:role.value,p_reason:why});
      else await rpc('staff_request',{p_user_id:id,p_kind:'grant_normal',p_reason:why});
      username.value='';say(ownRole==='creator'?t('Permissão concedida.','Role granted.'):
        t('Solicitação enviada ao Criador.','Request sent to Creator.'));await load();
    }catch(error){say(error.message||t('Falha ao enviar.','Could not submit.'),true);}
    finally{send.disabled=false;}
  });
  tab.addEventListener('click',()=>{
    workspace.querySelectorAll(':scope > section').forEach(section=>{section.hidden=section!==view;});
    tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button===tab)));
    load();
  });
  tabs.addEventListener('click',event=>{
    if(event.target.closest('button')!==tab){view.hidden=true;tab.setAttribute('aria-pressed','false');}
  },true);
  refresh.addEventListener('click',load);
  async function verify(){
    const ticket=++identity;ownRole=null;tab.hidden=true;view.hidden=true;++loading;
    try{
      const auth=await db.auth.getUser();if(ticket!==identity||auth.error||!auth.data?.user)return;
      const response=await db.rpc('my_staff_role');if(ticket!==identity||response.error)return;
      ownRole=['creator','right_hand'].includes(response.data)?response.data:null;
      tab.hidden=!ownRole;if(ownRole)sync();
    }catch(_){/* No management UI when authorization is unavailable. */}
  }
  db.auth.onAuthStateChange(()=>setTimeout(verify,0));
  new MutationObserver(()=>{if(ownRole){sync();if(!view.hidden)load();}})
    .observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  verify();
})();
