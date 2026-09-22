import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20260922120300_staff_hierarchy_privacy.sql');
const legacy=read('supabase/migrations/20260922120200_staff_hierarchy_hardening.sql');
test('only authorized staff can check target role; creator may handle all other accounts',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.moderator_can_handle/);
 assert.match(sql,/staff_role\(auth\.uid\(\)\) IS NOT NULL/);
 assert.match(sql,/staff_role\(auth\.uid\(\)\)='creator'/);
 assert.match(sql,/NOT EXISTS/);
});
test('hidden comments and reports about staff never enter a lower moderator queue',()=>{
 assert.match(sql,/DROP POLICY comments_read_authenticated/);
 assert.match(sql,/moderator_can_handle\(author_id\)/);
 assert.match(sql,/DROP POLICY fanart_report_staff_read/);
 assert.match(sql,/DROP POLICY fanart_report_staff_update/);
 assert.match(sql,/moderator_can_handle\([\s\S]*c\.author_id/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION community_private\.protect_staff_report/);
 assert.doesNotMatch(sql,/NEW\.status IS DISTINCT FROM OLD\.status/);
 assert.match(legacy,/fanart_report_staff_protection/);
});
test('both historical-edit endpoints filter by the actual comment author',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.moderation_comment_edit_history/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.moderation_recent_comment_edits/);
 assert.match(sql,/JOIN public\.comments c ON c\.id=h\.episode_comment_id/);
 assert.match(sql,/JOIN public\.fanart_comments c ON c\.id=h\.fanart_comment_id/);
 assert.match(sql,/moderator_can_handle\(c\.author_id\)/);
 assert.match(sql,/moderator_can_handle\(f\.author_id\)/);
});
