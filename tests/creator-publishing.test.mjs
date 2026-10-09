import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('creator uploads stay in a private bucket',()=>{const sql=read('sql/creator-storage.sql');assert.match(sql,/comic-pages','comic-pages',false/);assert.match(sql,/cyberus_is_creator\(\)/)});
test('scheduled publication requires pages and a date',()=>{const sql=read('sql/creator-publishing.sql');assert.match(sql,/cardinality\(page_paths\) > 0/);assert.match(sql,/status <> 'scheduled' or publish_at is not null/)});
test('dynamic reader uses signed URLs, not public URLs',()=>{const js=read('comic-dynamic.js');assert.match(js,/createSignedUrl\(path,300\)/);assert.doesNotMatch(js,/getPublicUrl/)});
test('creator panel blocks duplicate submissions',()=>{const js=read('creator-panel.js');assert.match(js,/submit.disabled=true/);assert.match(js,/finally\{submit.disabled=false\}/)});

test('dynamic reader preserves community panel container',()=>{const html=read('leitor-dinamico.html');const js=read('comic-dynamic.js');assert.match(html,/data\.communityEpisode/);assert.match(html,/id="comicDynamicContent"/);assert.match(js,/#comicDynamicContent/)});
test('creator episodes register into existing discussions',()=>{const sql=read('sql/creator-episode-community.sql');assert.match(sql,/insert into public\.episodes/);assert.match(sql,/cyberus_sync_comic_episode/)});
