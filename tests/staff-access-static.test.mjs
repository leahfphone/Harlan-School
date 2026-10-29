// Run with: node --test tests/staff-access-static.test.mjs
// Static regression checks only. These do not replace Firebase emulator tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const rules=read('firestore.rules');
const dashboard=read('teacher-dashboard.html');
const workspace=read('teacher-workspace.html');
const roles=read('staff-access.js');

test('primary administrator remains defined',()=>{
 assert.match(rules,/function isPrimaryAdmin\(\)/);
 assert.match(rules,/lphone@jcatoday\.org/);
});
test('assistant administrator has cross-subject edit authorization',()=>{
 assert.match(rules,/function isAssistantAdmin\(\)/);
 assert.match(rules,/function canManageSubject\(subject\)/);
 assert.match(rules,/isPrimaryAdmin\(\) \|\| isAssistantAdmin\(\)/);
});
test('subject teachers require trusted profile and membership',()=>{
 assert.match(rules,/exists\(\/databases\/\$\(database\)\/documents\/staffAccess\/\$\(request\.auth\.uid\)\)/);
 assert.match(rules,/subject in get\(/);
 assert.match(rules,/allow write: if false;/);
});
test('resource subject cannot be changed by an update',()=>{
 assert.match(rules,/request\.resource\.data\.subject == resource\.data\.subject/);
});
test('legacy submissions are admin-only',()=>{
 assert.match(rules,/allow read: if canReadLegacySubmissions\(\)/);
 assert.match(dashboard,/\['primary_admin','assistant_admin'\]/);
});
test('new subject and workspace are available',()=>{
 assert.match(roles,/life-skills/);
 assert.match(workspace,/loadStaffAccess/);
 assert.match(workspace,/where\('subject','==',subject\)/);
});
test('authentication changes hide protected dashboard content',()=>{
 assert.match(dashboard,/onAuthStateChanged\(auth,async user=>\{\$\('list'\)\.classList\.add\('hidden'\)/);
 assert.match(dashboard,/\$\('testPreview'\)\.removeAttribute\('srcdoc'\)/);
});
