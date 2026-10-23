import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const gitExe=process.env.GIT_EXECUTABLE||'git';
const git=(cwd,...args)=>execFileSync(gitExe,args,{cwd,encoding:'utf8'}).trim();
test('offline release archive records exact files and refuses dirty or changed legacy sources',async()=>{
 await mkdir(join(source,'.runtime'),{recursive:true});
 const fixture=await mkdtemp(join(source,'.runtime','release-check-')),repo=join(fixture,'source');await mkdir(repo);
 const paths=[...new Set([...git(source,'ls-files','-z').split('\0'),...git(source,'ls-files','--others','--exclude-standard','-z').split('\0')])].filter(Boolean);
 for(const path of paths){await mkdir(dirname(join(repo,path)),{recursive:true});await copyFile(join(source,path),join(repo,path));}
 git(repo,'init','-b','feature/universal-assignment-workflow');git(repo,'add','.');
 const commit=()=>git(repo,'-c','user.name=Local release test','-c','user.email=release-test@example.test','commit','-m','Local release fixture');commit();
 const run=out=>execFileSync(process.execPath,['scripts/prepare-release.mjs','--out',out],{cwd:repo,env:{...process.env,GIT_EXECUTABLE:gitExe},encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const out=join(fixture,'candidate'),result=JSON.parse(run(out));
 assert.equal(result.plannedAssignments,48);assert.equal(result.liveWritesPerformed,0);
 const manifest=JSON.parse(await readFile(join(out,'RELEASE.json'),'utf8'));
 assert.equal(manifest.sourceCommit,git(repo,'rev-parse','HEAD'));assert.equal(manifest.deploymentAuthorized,false);
 for(const file of manifest.files){const data=await readFile(join(out,file.path));assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);assert.equal(data.length,file.bytes);}
 const plan=JSON.parse(await readFile(join(out,'assignment-plan.json'),'utf8'));assert.equal(plan.studentUid,null);assert.deepEqual(plan.membershipGrants,[]);assert.ok(plan.assignments.every(a=>a.data.published===false));
 if(paths.includes('math-textbook-content.js')){assert.ok(plan.assignments.some(a=>a.path==='assignments/math6-ch4-lesson31-textbook-v1'));assert.ok(!plan.assignments.some(a=>a.path==='assignments/math6-ch4-lesson31'));}
 assert.equal(createHash('sha256').update(await readFile(out+'.tar.gz')).digest('hex'),result.sha256);
 assert.throws(()=>run(out),/Command failed/);
 const index=await readFile(join(repo,'index.html'));await writeFile(join(repo,'index.html'),Buffer.concat([index,Buffer.from('\n<!-- dirty -->')]));
 try{run(join(fixture,'dirty'));assert.fail('Dirty checkout packaged');}catch(e){assert.match(String(e.stderr),/Commit or preserve local changes/);}
 await assert.rejects(access(join(fixture,'dirty')));
 await writeFile(join(repo,'index.html'),index);
 await writeFile(join(repo,'history-test-1-release.html'),'changed legacy fixture');git(repo,'add','.');commit();
 try{run(join(fixture,'legacy-changed'));assert.fail('Changed legacy assessment packaged');}catch(e){assert.match(String(e.stderr),/Preserved legacy file changed/);}
 await assert.rejects(access(join(fixture,'legacy-changed')));
});
