import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('moderation loads the safe trash handlers after the existing fanart queue',()=>{
 const html=read('moderacao.html');
 const queue=html.indexOf('src="moderation-fanarts.js"');
 const safe=html.indexOf('src="moderation-trash-review.js"');
 const restore=html.indexOf('src="moderation-trash-restore.js"');
 const panel=html.indexOf('src="moderation-trash-panel.js"');
 assert.ok(queue>0&&safe>queue&&restore>safe&&panel>restore);
 const review=read('moderation-trash-review.js');
 assert.match(review,/oldButton\.disabled=true;oldButton\.hidden=true/);
 assert.match(review,/oldButton\.style\.display='none'/);
 assert.match(review,/MutationObserver\(decorate\).*observe\(queue/);
 assert.match(review,/destinationBucket:'fanart-trash'/);
 assert.ok(review.indexOf(".copy(path,path")<review.indexOf("db.rpc('moderate_fanart_submission'"), 'a published image is backed up BEFORE gallery removal');
 assert.ok(review.indexOf("db.rpc('moderate_fanart_submission'")<review.indexOf(".remove([path])"), 'the public source is deleted only AFTER successful rejection');
 assert.doesNotMatch(review,/from\('fanart-pending'\)\.remove/, 'pending private art must be retained');
});

test('private trash can restore before deadline and has a safe failure path',()=>{
 const list=read('moderation-trash-panel.js');
 const restore=read('moderation-trash-restore.js');
 assert.match(list,/db\.rpc\('is_moderator'\)/);
 assert.match(list,/db\.rpc\('moderation_trash'\)/);
 assert.match(list,/db\.rpc\('restore_trash_comment'/);
 assert.match(restore,/db\.rpc\('restore_trash_fanart'/);
 assert.match(restore,/destinationBucket:'fanart-public'/);
 const copy=restore.indexOf('.copy(work.trash_path');
 const approvedRestore=restore.lastIndexOf("db.rpc('restore_trash_fanart'");
 assert.ok(copy>=0&&approvedRestore>copy,'approved artwork is copied back BEFORE its database record is restored');
 assert.match(list,/expires_at/);
});

test('automated cleanup removes stored files through the Storage API rather than direct SQL',()=>{
 const code=read('supabase/functions/retention-trash/index.ts');
 assert.match(code,/db\.rpc\('trash_authorize_cron'/);
 assert.match(code,/db\.rpc\('trash_due_fanarts'/);
 assert.match(code,/\.storage\.from\(target\.bucket\)\.remove/);
 assert.ok(code.indexOf(".remove([target.path])")<code.indexOf("db.rpc('trash_finalize_fanart'"));
 assert.doesNotMatch(code,/DELETE FROM storage\.objects/i);
 assert.doesNotMatch(code,/sb_secret_[a-zA-Z0-9]+/);
});
