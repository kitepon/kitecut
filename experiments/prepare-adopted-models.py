"""採用モデルを公式クライアントで取得し、配置したファイルの実体を記録する。"""
import hashlib
import json
import os
from pathlib import Path
from huggingface_hub import HfApi, hf_hub_download, snapshot_download

ROOT = Path(__file__).resolve().parents[1]
settings = json.loads((ROOT / 'distribution/dependencies.json').read_text(encoding='utf-8-sig'))
speech = json.loads((ROOT / 'experiments/speech-adoption.json').read_text(encoding='utf-8-sig'))
video = json.loads((ROOT / 'experiments/video-understanding/adoption.json').read_text(encoding='utf-8-sig'))
locations = json.loads((ROOT / '.work/dependency-locations.json').read_text(encoding='utf-8-sig'))
stamp = ROOT / '.work/distribution/models.json'
configuration = hashlib.sha256(json.dumps([settings, speech, video, locations], sort_keys=True).encode()).hexdigest()
previous = json.loads(stamp.read_text(encoding='utf-8')) if stamp.exists() else None


def file_state(path):
    stat = path.stat()
    return {'path': str(path), 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns}


if previous and previous['configuration'] == configuration and all(
        Path(item['path']).is_file() and file_state(Path(item['path'])) == item
        for item in previous['files']):
    print('採用モデルの配置は記録と一致しています。', flush=True)
    raise SystemExit(0)

# 採用モデルは公開配布なので、端末に残る認証の状態へ依存させない。
api = HfApi(token=False)
files = []
print('採用した動画理解モデルを確認します。', flush=True)
video_path = Path(snapshot_download(repo_id=video['model']['repository'], revision=video['model']['revision'],
    local_dir=ROOT / '.work/video-understanding/models/videochat3', max_workers=2, token=False))
files.extend(path for path in video_path.rglob('*') if path.is_file() and '.cache' not in path.parts)
print('採用した標準声モデルを確認します。', flush=True)
speech_path = Path(snapshot_download(repo_id=speech['standard']['model'], revision=speech['standard']['revision'],
    cache_dir=ROOT / '.work/qwen-speech/cache/hub', max_workers=2, token=False))
files.extend(path for path in speech_path.rglob('*') if path.is_file())
reference = ROOT / speech['standard']['referenceAudio']
if hashlib.sha256(reference.read_bytes()).hexdigest() != speech['standard']['referenceSha256']:
    raise ValueError('採用した参照音声と配布物が一致しません。')
files.append(reference)

comfy_models = Path(locations['comfyRoot']) / 'ComfyUI/models'
for model in settings['comfyModels']:
    metadata = api.model_info(model['repository'], revision=model['revision'], files_metadata=True)
    by_name = {item.rfilename: item for item in metadata.siblings}
    for relative in model['files']:
        remote = model.get('prefix', '') + relative
        expected = by_name[remote]
        destination = comfy_models / relative
        digest = expected.lfs.sha256
        valid = False
        if destination.is_file() and destination.stat().st_size == expected.size:
            print('既存モデルを照合: ' + destination.name, flush=True)
            with destination.open('rb') as stream:
                valid = hashlib.file_digest(stream, 'sha256').hexdigest() == digest
        if not valid:
            if destination.exists():
                raise ValueError('既存モデルが採用版と一致しません。保持して中止: ' + str(destination))
            print('公式モデルを取得: ' + remote, flush=True)
            acquired = Path(hf_hub_download(repo_id=model['repository'], revision=model['revision'], filename=remote,
                local_dir=ROOT / '.work/distribution/model-downloads' / model['repository'].split('/')[-1], token=False))
            with acquired.open('rb') as stream:
                if hashlib.file_digest(stream, 'sha256').hexdigest() != digest:
                    raise ValueError('取得したモデルのハッシュが一致しません: ' + remote)
            destination.parent.mkdir(parents=True, exist_ok=True)
            acquired.replace(destination)
        files.append(destination)
stamp.write_text(json.dumps({'configuration': configuration, 'files': [file_state(path) for path in files]}, ensure_ascii=False, indent=2), encoding='utf-8')
print('採用モデルの配置を確認しました。', flush=True)
