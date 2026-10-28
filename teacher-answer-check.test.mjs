// Run with: node --test teacher-answer-check.test.mjs
// These tests use no Firebase account and contain no protected test answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./teacher-answer-check.js',import.meta.url),'utf8');
const moduleUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {validateTeacherKey,checkTeacherAnswer}=await import(moduleUrl);
const key=validateTeacherKey({schemaVersion:'teacher-key-v1',questions:[
 {number:1,type:'exact',correctAnswer:'6',acceptedAnswers:['six']},
 {number:2,type:'multiple-choice',correctAnswer:'B'},
 {number:3,type:'manual'}
]});
test('accepts valid teacher-only key schema',()=>assert.equal(key.length,3));
test('normalizes case and whitespace',()=>assert.equal(checkTeacherAnswer({number:1,answer:'  SIX  '},key).status,'correct'));
test('reports incorrect answer with verified correction',()=>assert.deepEqual(checkTeacherAnswer({number:2,answer:'C'},key),{status:'incorrect',correctAnswer:'B'}));
test('leaves manual questions for teacher review',()=>assert.equal(checkTeacherAnswer({number:3,answer:'Explanation'},key).status,'teacher-review'));
test('leaves missing keys unchecked',()=>assert.equal(checkTeacherAnswer({number:4,answer:'4'},key).status,'not-checked'));
test('rejects unversioned keys',()=>assert.equal(validateTeacherKey({questions:[{number:1,type:'exact',correctAnswer:'6'}]}),null));
test('rejects duplicate question numbers',()=>assert.equal(validateTeacherKey({schemaVersion:'teacher-key-v1',questions:[{number:1,type:'exact',correctAnswer:'6'},{number:1,type:'exact',correctAnswer:'7'}]}),null));
test('rejects keys without answers',()=>assert.equal(validateTeacherKey({schemaVersion:'teacher-key-v1',questions:[{number:1,type:'exact'}]}),null));
test('rejects unsupported question type',()=>assert.equal(validateTeacherKey({schemaVersion:'teacher-key-v1',questions:[{number:1,type:'essay',correctAnswer:'yes'}]}),null));
