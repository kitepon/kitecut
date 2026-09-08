// 更新前の保存と終了を起動入口が行う。別アプリのプロセスは終了しない。
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd();
const profile=path.join(root,'.work/frontstage-profile');
const tokenPath=path.join(profile,'mcp-token');
if(existsSync(tokenPath)){
 const token=(await readFile(tokenPath,'utf8')).trim();
 const requestInit={headers:{Authorization:`Bearer ${token}`}};
 let alive;
 try{alive=await fetch('http://127.0.0.1:19790/healthz',{...requestInit,signal:AbortSignal.timeout(5000)});}
 catch(error){if(error.cause?.code!=='ECONNREFUSED')throw error;}
 if(alive){
  if(!alive.ok)throw Error('既存エディターの接続を確認できません: '+alive.status);
  const require=createRequire(path.join(root,'.work/frontstage/apps/desktop/package.json'));
  const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
  const {StreamableHTTPClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
  const client=new Client({name:'movie-editor-update',version:'1.0.0'},{capabilities:{}});
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:19790/mcp'),{requestInit}));
  try{
   const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args});if(result.isError)throw Error(JSON.stringify(result));return JSON.parse(result.content.find(c=>c.type==='text').text);};
   await call('get_timeline');
   const projects=await call('get_projects');await call('save_project',projects.active?{}:{name:'再起動前の編集-'+Date.now()});
  }finally{await client.close();}
  const {chromium}=require('@playwright/test');const port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0];
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  try{const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes(':5190/'));if(!page)throw Error('終了する編集ウィンドウがありません');await page.close();}finally{await browser.close();}
  // 旧ウィンドウの終了で起動元もサーバーを閉じる。その完了を待つ。
  const net=await import('node:net');
  const listening=port=>new Promise((resolve,reject)=>{const socket=net.connect(port,'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',error=>error.code==='ECONNREFUSED'?resolve(false):reject(error));});
  const until=Date.now()+10000;
  while(await listening(5190)||await listening(19790)){if(Date.now()>until)throw Error('旧エディターの終了が完了していません');await new Promise(resolve=>setTimeout(resolve,100));}
  console.log('編集中の内容を保存し、旧エディターの終了を確認しました。');
 }
}
