// この配布物の依存とプロファイルを使い、公開編集APIへ接続する。
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'.work/frontstage/apps/desktop/package.json'));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const {StreamableHTTPClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
export async function connect(){
 const token=(await readFile(path.join(root,'.work/frontstage-profile/mcp-token'),'utf8')).trim();
 const client=new Client({name:'movie-editor',version:'1.0.0'},{capabilities:{}});
 await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:19790/mcp'),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
 const call=async(name,args={})=>{const result=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(result.isError)throw Error(JSON.stringify(result));return result;};
 const json=async(name,args={})=>{const result=await call(name,args);const text=result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');try{return JSON.parse(text);}catch{return text;}};
 return {client,call,json};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href&&process.argv[2]){
 const{client,call}=await connect();try{const result=process.argv[2]==='tools'?await client.listTools():await call(process.argv[2],JSON.parse(process.argv[3]??'{}'));if(process.argv[4])await writeFile(process.argv[4],JSON.stringify(result,null,2));else console.log(JSON.stringify(result));}finally{await client.close();}
}
