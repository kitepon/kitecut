// 同梱するファイルを明示し、作品・認証情報・開発環境を含めずソース配布を作る。
import{readFile,writeFile,mkdir,mkdtemp,copyFile,readdir}from'node:fs/promises';
import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import path from'node:path';
const root=process.cwd();const version=execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim();
const outputRoot=path.join(root,'.work/distribution-output');await mkdir(outputRoot,{recursive:true});
const destination=await mkdtemp(path.join(outputRoot,`kitecut-${version}-`));
const files=['README.md','LICENSE','THIRD_PARTY_NOTICES.md','Start-Editor.ps1','experiments/frontstage.json','experiments/open-editor.mjs','experiments/prepare-editor-update.mjs','experiments/update-editor-source.py','experiments/prepare-dependencies.ps1','experiments/prepare-adopted-models.py','experiments/generation-service.mjs','experiments/speech-runtime.mjs','experiments/speech-adoption.json','experiments/mcp-client.mjs','experiments/video-understanding/adoption.json','artifacts/local-speech-bridge/narration.wav'];
async function include(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=directory+'/'+entry.name;if(entry.isDirectory())await include(file);else files.push(file);}}
for(const directory of ['experiments/fonts','experiments/patches','distribution/requirements','distribution/licenses','docs','.github','scripts'])await include(directory);
files.push('distribution/components.json','distribution/dependencies.json','experiments/build-distribution.mjs','CONTRIBUTING.md','AGENTS.md','SECURITY.md','CHANGELOG.md','.gitignore','.gitattributes');
const entries=[];
for(const file of files){const target=path.join(destination,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(file,target);const data=await readFile(target);entries.push({path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const adopted=JSON.parse(await readFile('experiments/frontstage.json','utf8'));
const actual=execFileSync('git',['-C',adopted.workspace,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(actual!==adopted.revision)throw Error('固定ソースと採用版が一致しません');
const bundle=path.join(destination,'distribution/frontstage.bundle');
execFileSync('git',['-C',adopted.workspace,'bundle','create',bundle,'HEAD']);
execFileSync('git',['bundle','verify',bundle]);
const bundleBytes=await readFile(bundle);entries.push({path:'distribution/frontstage.bundle',bytes:bundleBytes.length,sha256:createHash('sha256').update(bundleBytes).digest('hex')});
const manifest={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAt:new Date().toISOString(),upstream:adopted,files:entries};
await writeFile(path.join(destination,'distribution/package-manifest.json'),JSON.stringify(manifest,null,2));
const archive=destination+'.zip';
execFileSync('tar',['-a','-c','-f',archive,'-C',path.dirname(destination),path.basename(destination)]);
const data=await readFile(archive);await mkdir('.work/distribution',{recursive:true});await writeFile('.work/distribution/package-result.json',JSON.stringify({archive,directory:destination,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),fileCount:entries.length,sourceCommit:manifest.sourceCommit},null,2));
console.log(JSON.stringify({archive,bytes:data.length,files:entries.length}));
