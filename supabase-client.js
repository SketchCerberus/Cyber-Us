/* One authentication client per page, shared by community and header modules. */
(() => {
  'use strict';
  let client = null;
  window.CyberUsGetClient = () => {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(
      'https://znenamrszhjsiztllcit.supabase.co',
      'sb_publishable_3VRFxwtDuYq4ETHs4xof8g_Fp3GRl6c',
      {auth: {flowType: 'pkce', persistSession: true, autoRefreshToken: true,
        detectSessionInUrl: document.body.dataset.communityPage === 'account'}}
    );
    return client;
  };
})();
