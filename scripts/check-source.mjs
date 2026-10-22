// 公開ファイルからソースを復元し、同梱物と開発入口を確認する。モデルは取得しない。
import { readFile, readdir, mkdir, mkdtemp, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const hash = async name => createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');

const adopted = await json('experiments/frontstage.json');
const speech = await json('experiments/speech-adoption.json');
const fonts = await json('experiments/fonts/catalog.json');
if (await hash(speech.standard.referenceAudio) !== speech.standard.referenceSha256) {
  throw Error('標準声の参照音声が採用記録と一致しません');
}
let fontCount = 0;
for (const font of fonts.fonts) {
  await access(path.join(root, 'experiments/fonts', font.license));
  for (const name of font.files) {
    if (await hash('experiments/fonts/' + name) !== font.sha256[name]) {
      throw Error('書体が採用記録と一致しません: ' + name);
    }
    fontCount++;
  }
}

await mkdir(path.join(root, '.work'), { recursive: true });
const restored = await mkdtemp(path.join(root, '.work/source-check-'));
run('git', ['bundle', 'verify', 'distribution/frontstage.bundle']);
run('git', ['clone', '--quiet', '--no-checkout', path.join(root, 'distribution/frontstage.bundle'), restored]);
run('git', ['fsck', '--connectivity-only', '--no-dangling'], restored);
run('git', ['-c', 'core.autocrlf=false', 'checkout', '--quiet', '--detach', adopted.revision], restored);
for (const patch of adopted.patches) {
  run('git', ['apply', '--check', '--', path.join(root, patch)], restored);
  run('git', ['apply', '--', path.join(root, patch)], restored);
}
const restoredPackage = JSON.parse(await readFile(path.join(restored, 'apps/desktop/package.json'), 'utf8'));
if (restoredPackage.productName !== 'KiteCut') throw Error('KiteCutの差分が復元されていません');

async function files(directory) {
  const result = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(name));
    else result.push(name);
  }
  return result;
}
const sources = [...await files('experiments'), ...await files('scripts')];
const javascript = sources.filter(name => name.endsWith('.mjs'));
for (const name of javascript) run(process.execPath, ['--check', path.join(root, name)]);
for (const name of [...sources, ...await files('distribution')].filter(name => name.endsWith('.json'))) await json(name);

const documents = ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'SECURITY.md', 'CHANGELOG.md', ...await files('docs')];
let links = 0;
for (const name of documents.filter(name => name.endsWith('.md'))) {
  const text = await readFile(path.join(root, name), 'utf8');
  const targets = [...text.matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map(match => match[1]);
  targets.push(...[...text.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map(match => match[1]));
  for (const target of targets) {
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    const relative = decodeURIComponent(target.split('#')[0]);
    await access(path.resolve(root, path.dirname(name), relative));
    links++;
  }
}
console.log(`ソース復元、参照音声、書体${fontCount}件、JavaScript ${javascript.length}件、ローカルリンク${links}件を確認しました。`);
console.log('復元先: ' + restored);
