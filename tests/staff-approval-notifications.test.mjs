import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20260922120400_staff_approval_notifications.sql');
const bell=read('header-notifications.js');
test('staff-approval and moderator-appeal system alerts target Creator only',()=>{
 assert.match(sql,/CREATE FUNCTION community_private\.notify_creator_staff_request/);
 assert.match(sql,/CREATE FUNCTION community_private\.notify_creator_staff_appeal/);
 assert.match(sql,/FROM community_private\.creator_anchor a/g);
 assert.match(sql,/AFTER INSERT ON community_private\.staff_requests/);
 assert.match(sql,/AFTER INSERT ON community_private\.staff_role_appeals/);
 assert.match(sql,/REVOKE ALL ON FUNCTION community_private\.notify_creator_staff_request/);
 assert.doesNotMatch(sql,/GRANT INSERT|GRANT SELECT/);
});
test('existing social notifications stay valid and staff notices have exclusive private targets',()=>{
 assert.match(sql,/kind IN \('reply','mention','staff_request','staff_role_appeal'\)/);
 assert.match(sql,/DROP CONSTRAINT notification_target/);
 assert.match(sql,/staff_request_id IS NOT NULL AND staff_role_appeal_id IS NULL/);
 assert.match(sql,/staff_request_id IS NULL AND staff_role_appeal_id IS NOT NULL/);
 assert.match(sql,/staff_request_id IS NULL AND staff_role_appeal_id IS NULL/);
 assert.match(sql,/UNIQUE INDEX community_notice_unique_staff_request/);
 assert.match(sql,/UNIQUE INDEX community_notice_unique_staff_role_appeal/);
});
test('single existing bell deep-links both approval messages without exposing private request IDs',()=>{
 assert.match(bell,/item\.kind === 'staff_request'/);
 assert.match(bell,/item\.kind === 'staff_role_appeal'/);
 assert.match(bell,/moderacao\.html#staffHierarchyView/);
 assert.match(bell,/staff_request: t\(/);
 assert.match(bell,/staff_role_appeal: t\(/);
 assert.doesNotMatch(bell,/select\('[^']*staff_request_id/);
});
