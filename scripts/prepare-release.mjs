// Offline only: reads this checkout and builds a reviewable release package.
// No Firebase/GitHub API, credentials, network calls, or deployment commands.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,copyFile,lstat,access} from 'node:fs/promises';
import {resolve,dirname,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out')throw new Error('Usage: node scripts/prepare-release.mjs --out /absolute/new/output-folder');
const out=resolve(args[1]),archive=out+'.tar.gz';
if(out===root||root.startsWith(out+'/'))throw new Error('Output must not contain the checkout.');
const git=(...argv)=>execFileSync(process.env.GIT_EXECUTABLE||'git',argv,{cwd:root,encoding:'utf8'}).trim();
const sourceCommit=git('rev-parse','HEAD');
if(git('status','--porcelain'))throw new Error('Commit or preserve local changes before preparing an exact release.');
for(const path of [out,archive]){
 try{await access(path);throw new Error('Refusing to overwrite '+path);}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
const preserved={
 'history-test-1-release.html':'209196ab2c6519f49272b90fa37c2fcb2afff76b',
 'canada-test-2-submit.html':'6f53247f461d52db24a37542f2d4cbdcdf917b7a',
 'harlan-canada-test-2.html':'8015ee83a83f24b0ad4b0dff134f6703af34dbb7',
 'firestore.rules':'8d5876e761332054dafcbf157c3bfee2f7b9f334'
};
for(const [path,hash] of Object.entries(preserved)){
 if(git('hash-object',path)!==hash)throw new Error('Preserved legacy file changed: '+path);
}
const tracked=git('ls-files','-z').split('\0').filter(Boolean);
const extensions=new Set(['.html','.js','.css','.png','.jpg','.jpeg','.svg','.webp','.ico']);
const paths=tracked.filter(path=>!path.includes('/')&&extensions.has(extname(path))).sort();
for(const path of paths)if((await lstat(join(root,path))).isSymbolicLink())throw new Error('Frontend symlinks require explicit review: '+path);
const assignments=[];
// Textbook versions are distinct from retired sample assignment IDs.
const textbookSource=await readFile(join(root,'math-textbook-content.js'),'utf8').catch(()=>null);
if(textbookSource){
 const match=textbookSource.match(/export const textbookLessons=(\{.*\});/s);
 if(!match)throw new Error('Cannot read verified textbook metadata without evaluating code.');
 for(const lesson of Object.values(JSON.parse(match[1]))){
  if(lesson.verified!==true)continue;
  assignments.push({path:'assignments/'+lesson.assignmentId,data:{title:(/^\d+$/.test(lesson.lesson)?'Lesson '+lesson.lesson+' — ':'')+lesson.title+' (textbook)',subject:'Math',chapter:String(lesson.chapter),lesson:lesson.lesson,type:'classwork',published:false}});
 }
}
await mkdir(out);await mkdir(join(out,'site'));
const records=[];
for(const path of paths){
 const data=await readFile(join(root,path));await copyFile(join(root,path),join(out,'site',path));
 records.push({path:'site/'+path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
for(const [source,target] of [['firestore.universal.draft.rules','firestore.rules.candidate'],['firestore.rules','firestore.rules.repository-baseline'],['docs/rollout-plan.md','rollout-plan.md']]){
 const data=await readFile(join(root,source));await writeFile(join(out,target),data);
 records.push({path:target,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
const assignmentPlan={targetProject:'harlan-learning-hub',writesPerformed:0,studentUid:null,membershipGrants:[],assignments,notes:['All proposed assignments start unpublished.','Student identity, enrollment, teacher grants, memberships and publication require separate explicit approval.','No real account IDs or protected questions/answer keys are invented or included.']};
const planBytes=JSON.stringify(assignmentPlan,null,2)+'\n';await writeFile(join(out,'assignment-plan.json'),planBytes);
records.push({path:'assignment-plan.json',bytes:Buffer.byteLength(planBytes),sha256:createHash('sha256').update(planBytes).digest('hex')});
const manifest={sourceCommit,sourceBranch:git('branch','--show-current'),targetProject:'harlan-learning-hub',deploymentAuthorized:false,liveWritesPerformed:0,preservedLegacyFiles:preserved,files:records};
await writeFile(join(out,'RELEASE.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(out,'README.txt'),'Review candidate only. Nothing has been deployed or written to Firebase.\n\nThe site directory contains frontend files from source commit '+sourceCommit+'.\nRELEASE.json records exact file hashes. The repository rules baseline is not an export of deployed rules.\nassignment-plan.json contains unpublished lesson metadata and no student/account grants.\nReview rollout-plan.md and obtain explicit approval before any live provisioning, deployment or merge.\n');
// Reserve a new filename before invoking the system archiver.
await writeFile(archive,'',{flag:'wx'});
execFileSync('tar',['-czf',archive,'-C',out,'.']);
const archiveHash=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive+'.sha256',archiveHash+'  '+archive.split('/').pop()+'\n',{flag:'wx'});
console.log(JSON.stringify({sourceCommit,siteFiles:paths.length,plannedAssignments:assignments.length,archive,sha256:archiveHash,liveWritesPerformed:0}));
