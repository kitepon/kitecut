// 採用記録から起動用の絶対パスを組み立てる。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
export async function writeSpeechRuntime(root) {
  const adoption = JSON.parse(await readFile(path.join(root, 'experiments/speech-adoption.json'), 'utf8'));
  const directory = path.join(root, '.work/adopted-speech');
  await mkdir(directory, { recursive: true });
  const configPath = path.join(directory, 'runtime.json');
  await writeFile(configPath, JSON.stringify({
    qwen: {
      pythonExecutable: path.join(root, '.work/qwen-speech/venv/Scripts/python.exe'),
      modelCache: path.join(root, '.work/qwen-speech/cache'),
      modelPath: path.join(root, '.work/qwen-speech/cache/hub/models--Qwen--Qwen3-TTS-12Hz-1.7B-Base/snapshots', adoption.standard.revision),
      referenceAudio: path.join(root, adoption.standard.referenceAudio),
      provenance: adoption.standard,
    },
    nemo: {
      engineExecutable: path.join(root, '.work/japanese-speech/nemo-engine/windows-cpu/run.exe'),
      endpoint: 'http://127.0.0.1:50121',
      provenance: adoption.calm,
    },
  }, null, 2));
  return configPath;
}
