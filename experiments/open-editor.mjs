// 実証用のプロジェクトを実際の編集画面で開き、MCPの読戻しまで確認する。
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { writeSpeechRuntime } from './speech-runtime.mjs';
import { ensureGenerationService } from './generation-service.mjs';
import path from 'node:path';

const root = process.cwd();
const desktop = path.join(root, '.work/frontstage/apps/desktop');
const profile = path.join(root, '.work/frontstage-profile');
const require = createRequire(path.join(desktop, 'package.json'));
const { createServer } = require('vite');
const { _electron } = require('@playwright/test');
const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
const { StreamableHTTPClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')));
await writeFile('.work/editor-ready.json', JSON.stringify({state:'starting', observed_at:new Date().toISOString()}));
const generationService = await ensureGenerationService(root);
const server = await createServer({ root: path.join(desktop, 'src/renderer'), configFile: path.join(desktop, 'vite.renderer.config.ts'), server: { port: 5190, strictPort: true } });
await server.listen();
const env = { ...process.env, RENDERER_PORT: '5190', MCP_PORT: '19790' };
env.FRONTSTAGE_TRACKING_PYTHON = path.join(root, '.work/motion-tracking/venv/Scripts/python.exe');
const searchAdoption = JSON.parse(await readFile(path.join(root, 'experiments/video-understanding/adoption.json'), 'utf8'));
const searchDirectory = path.join(root, '.work/video-search');
await mkdir(searchDirectory, { recursive: true });
const searchRuntime = path.join(searchDirectory, 'runtime.json');
const dependencyLocations = JSON.parse((await readFile(path.join(root, '.work/dependency-locations.json'), 'utf8')).replace(/^\uFEFF/, ''));
await writeFile(searchRuntime, JSON.stringify({
  pythonExecutable: path.join(root, '.work/video-understanding/venv-videochat3/Scripts/python.exe'),
  modelPath: path.join(root, '.work/video-understanding/models/videochat3'),
  modelId: searchAdoption.model.repository, revision: searchAdoption.model.revision,
  ffmpegDirectory: dependencyLocations.ffmpegDirectory,
}, null, 2));
env.FRONTSTAGE_VIDEO_SEARCH_CONFIG = searchRuntime;
delete env.ELECTRON_RUN_AS_NODE;
env.FRONTSTAGE_LOCAL_SPEECH_CONFIG = await writeSpeechRuntime(root);
const app = await _electron.launch({ executablePath: require('electron'), args: [path.join(desktop, 'src/main/index.cjs'), '--user-data-dir=' + profile], cwd: desktop, env });
app.process().on('exit', async code => { await server.close(); process.exit(process.exitCode ?? code ?? 0); });
const client = new Client({ name: 'movie-open-editor', version: '0.1.0' }, { capabilities: {} });
try {
  const page = await app.firstWindow();
  page.on('pageerror', error => console.error('編集画面のエラー:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('編集画面:', message.text()); });
  await page.waitForFunction(() => document.querySelector('#root')?.childElementCount > 0, undefined, { timeout: 30000 });
  const token = (await readFile(path.join(profile, 'mcp-token'), 'utf8')).trim();
  const headers = { Authorization: `Bearer ${token}` };
  if (!(await fetch('http://127.0.0.1:19790/healthz', { headers })).ok) throw new Error('編集アプリのMCP状態確認に失敗した');
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:19790/mcp'), { requestInit: { headers } }));
  const listed = await client.callTool({ name: 'get_projects', arguments: {} });
  if (listed.isError) throw new Error(JSON.stringify(listed));
  const projects = JSON.parse(listed.content.find(c => c.type === 'text').text);
  const resume = projects.active ?? projects.projects.find(p => p.isAccessible);
  if (resume) {
    const opened = await client.callTool({ name: 'open_project', arguments: { path: resume.path } });
    if (opened.isError) throw new Error(JSON.stringify(opened));
  }
  const state = await client.callTool({ name: 'get_timeline', arguments: {} });
  if (state.isError) throw new Error(JSON.stringify(state));
  await writeFile('.work/editor-ready.json', JSON.stringify({state:'ready',observed_at:new Date().toISOString(),pid:app.process().pid,project_path:resume?.path ?? null,generationService}));
  console.log(resume ? '編集アプリを起動し、最後に使ったプロジェクトを再開した。' : '編集アプリを起動した。');
} catch (error) {
  await writeFile('.work/editor-ready.json', JSON.stringify({state:'failed',observed_at:new Date().toISOString(),error:String(error)}));
  console.error(error);
  process.exitCode = 1;
  await app.close();
} finally {
  await client.close();
}
