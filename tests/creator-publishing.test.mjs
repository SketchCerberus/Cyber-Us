import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('creator uploads stay in a private bucket',()=>{const sql=read('sql/creator-storage.sql');assert.match(sql,/values\('comic-pages','comic-pages',false/);assert.match(sql,/cyberus_is_creator\(\)/)});
test('scheduled publication requires pages and a date',()=>{const sql=read('sql/creator-publishing.sql');assert.match(sql,/cardinality\(page_paths\) > 0/);assert.match(sql,/status <> 'scheduled' or publish_at is not null/)});
test('dynamic reader uses signed URLs, not public URLs',()=>{const js=read('comic-dynamic.js');assert.match(js,/createSignedUrl\(path,300\)/);assert.doesNotMatch(js,/getPublicUrl/)});
test('creator panel blocks duplicate submissions',()=>{const js=read('creator-panel.js');assert.match(js,/submit.disabled=true/);assert.match(js,/finally\{submit.disabled=false\}/)});

test('dynamic reader preserves community panel container',()=>{const html=read('leitor-dinamico.html');const js=read('comic-dynamic.js');assert.match(html,/dataset\.communityEpisode/);assert.match(html,/id="comicDynamicContent"/);assert.match(js,/#comicDynamicContent/)});
test('creator episodes register into existing discussions',()=>{const sql=read('sql/creator-episode-community.sql');assert.match(sql,/insert into public\.episodes/);assert.match(sql,/cyberus_sync_comic_episode/)});

test('scheduled discussions are gated by release in existing episodes RLS',()=>{const sql=read('sql/creator-episode-community.sql');assert.match(sql,/alter policy episodes_read_enabled/);assert.match(sql,/cyberus_episode_is_released\(slug\)/);assert.match(sql,/publish_at<=now\(\)/)});

test('SQL function bodies use matching dollar quotes',()=>{for(const name of ['sql/creator-publishing.sql','sql/creator-episode-community.sql','sql/creator-discussion-extensions.sql']){const sql=read(name);assert.equal((sql.match(/\$\$/g)||[]).length%2,0,name+' has unmatched $$ delimiters')}});

test('pin policy verifies comment belongs to the same episode',()=>{const sql=read('sql/creator-discussion-extensions.sql');assert.match(sql,/c\.id=creator_pinned_comments\.comment_id and c\.episode_slug=creator_pinned_comments\.episode_slug/)});

test('existing comic bucket is forced to stay private',()=>{const sql=read('sql/creator-storage.sql');assert.match(sql,/on conflict\(id\) do update set public=false/)});

test('partial uploads are checkpointed while the episode remains a draft',()=>{const js=read('creator-panel.js');assert.match(js,/page_paths:\[\.\.\.uploaded\]/);assert.match(js,/checkpoint\.error/);assert.match(js,/catch\(error\)\{message\('Falha inesperada/)});
