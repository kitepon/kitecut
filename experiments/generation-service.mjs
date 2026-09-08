// 公式Portableを起動し、アプリが使うノードとモデルが見えることまで確認する。
import {spawn} from 'node:child_process';
import {readFile,open} from 'node:fs/promises';
import path from 'node:path';
export async function ensureGenerationService(root){
 const settings=JSON.parse(await readFile(path.join(root,'distribution/dependencies.json'),'utf8'));
 const locations=JSON.parse((await readFile(path.join(root,'.work/dependency-locations.json'),'utf8')).replace(/^\uFEFF/,''));
 const base=settings.comfy.endpoint;
 async function probe(){try{const response=await fetch(base+'/system_stats',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error(`ComfyUI状態取得: ${response.status}`);return await response.json();}catch(error){if(error.cause?.code==='ECONNREFUSED')return null;throw error;}}
 let stats=await probe(),child;
 if(!stats){
  const log=await open(path.join(root,'.work/distribution/comfy-service.log'),'a');
  child=spawn(path.join(locations.comfyRoot,'python_embeded/python.exe'),['-s','ComfyUI/main.py','--windows-standalone-build','--disable-auto-launch','--listen','127.0.0.1','--port','8188'],{cwd:locations.comfyRoot,windowsHide:true,detached:true,stdio:['ignore',log.fd,log.fd]});
  let failure;child.once('error',error=>failure=error);child.unref();await log.close();
  const deadline=Date.now()+120000;
  while(!stats){if(failure)throw failure;if(child.exitCode!==null)throw Error('ComfyUIが起動中に終了しました。ログを確認してください');if(Date.now()>deadline)throw Error('ComfyUIの起動確認が時間切れになりました');await new Promise(r=>setTimeout(r,500));stats=await probe();}
 }
 const response=await fetch(base+'/object_info',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`ComfyUIノード取得: ${response.status}`);const nodes=await response.json();
 const expected={UNETLoader:['unet_name',['mage_flow_bf16.safetensors','wan2.2_ti2v_5B_fp16.safetensors']],CLIPLoader:['clip_name',['qwen3vl_4b_bf16.safetensors','umt5_xxl_fp8_e4m3fn_scaled.safetensors']],VAELoader:['vae_name',['mage_flow_vae_bf16.safetensors','wan2.2_vae.safetensors']]};
 for(const[name,[field,files]]of Object.entries(expected)){const offered=nodes[name]?.input?.required?.[field]?.[0];if(!Array.isArray(offered)||files.some(file=>!offered.includes(file)))throw Error(`ComfyUIに採用モデルがありません: ${name}`);}
 for(const name of ['EmptyFlux2LatentImage','Wan22ImageToVideoLatent','CreateVideo','SaveVideo'])if(!nodes[name])throw Error('ComfyUIの必要ノードがありません: '+name);
 if(!nodes.CLIPLoader.input.required.type[0].includes('mage'))throw Error('ComfyUIがMageに対応していません');
 console.log('画像・動画生成サービスと採用モデルを確認しました。');
 return {endpoint:base,version:stats.system?.comfyui_version,startedHere:Boolean(child)};
}
