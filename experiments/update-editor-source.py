"""正規入口で、既知の導入版から現在の編集用差分へ更新する。"""
from pathlib import Path
import difflib
import json
import re
import subprocess
import tarfile
import tempfile
import time


def git(cwd, *args):
    return subprocess.run(['git', '-c', 'core.pager=cat', '-C', str(cwd), *args], capture_output=True)


def checked_git(cwd, *args):
    result = git(cwd, *args)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.stdout.decode('utf-8').strip()


def sections(patch):
    return {part.split('\n', 1)[0].split(' b/', 1)[1]: part for part in re.split(r'(?=^diff --git )', patch.replace('\r\n', '\n'), flags=re.M) if part.startswith('diff --git ')}


def materialize(base, section):
    if section is None:
        return base
    if 'deleted file mode ' in section:
        return None
    source = (base or '').splitlines(keepends=True)
    output, cursor = [], 0
    lines = section.splitlines(keepends=True)
    active = False
    for line in lines:
        header = re.match(r'@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@', line)
        if header:
            position = max(0, int(header[1]) - 1)
            output.extend(source[cursor:position]); cursor = position; active = True
        elif active:
            if line.startswith(' '):
                output.append(line[1:]); cursor += 1
            elif line.startswith('-'):
                cursor += 1
            elif line.startswith('+'):
                output.append(line[1:])
            elif line.startswith('\\ No newline') and output:
                output[-1] = output[-1].rstrip('\n')
    output.extend(source[cursor:])
    return ''.join(output)


def transition(source, old, new):
    previous, desired = sections(old), sections(new)
    delta = []
    for name in sorted(previous.keys() | desired.keys()):
        result = git(source, 'show', 'HEAD:' + name)
        base = result.stdout.decode('utf-8').replace('\r\n', '\n') if result.returncode == 0 else None
        before, after = materialize(base, previous.get(name)), materialize(base, desired.get(name))
        target = source / name
        actual = target.read_text(encoding='utf-8') if target.exists() else None
        if actual != before:
            raise RuntimeError(f'導入版と異なる変更があります。保持して更新を止めます: {name}')
        if before == after:
            continue
        for line in difflib.unified_diff((before or '').splitlines(keepends=True), (after or '').splitlines(keepends=True), fromfile='a/' + name if before is not None else '/dev/null', tofile='b/' + name if after is not None else '/dev/null'):
            delta.append(line if line.endswith('\n') else line + '\n\\ No newline at end of file\n')
    return ''.join(delta)


def update(root, source, patch_ref):
    patch = root / patch_ref
    cache = root / '.work/editor-patches' / patch.name
    content = patch.read_text(encoding='utf-8')
    if git(source, 'apply', '--reverse', '--check', str(patch)).returncode == 0:
        pass
    elif git(source, 'apply', '--check', str(patch)).returncode == 0:
        applied = git(source, 'apply', str(patch))
        if applied.returncode:
            raise RuntimeError(applied.stderr.decode('utf-8', errors='replace'))
    else:
        if cache.exists():
            old = cache.read_text(encoding='utf-8')
        else:
            recorded = git(root, 'show', 'HEAD:' + patch_ref)
            if recorded.returncode:
                raise RuntimeError('導入版の記録がありません: ' + patch_ref)
            old = recorded.stdout.decode('utf-8')
            print('初回の導入版照合に、リポジトリに保存された差分を使います: ' + patch_ref)
        delta = transition(source, old, content)
        temporary = root / '.work/editor-update.patch'
        temporary.write_text(delta, encoding='utf-8', newline='\n')
        if delta:
            for args in [('apply', '--check', str(temporary)), ('apply', str(temporary))]:
                result = git(source, *args)
                if result.returncode:
                    raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    verified = git(source, 'apply', '--reverse', '--check', str(patch))
    if verified.returncode:
        raise RuntimeError('編集用差分の反映を確認できません: ' + verified.stderr.decode('utf-8', errors='replace'))
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(content, encoding='utf-8', newline='\n')
    print('編集用差分を反映しました: ' + patch_ref)


def change_revision(root, source, candidate):
    current = checked_git(source, 'rev-parse', 'HEAD')
    desired = candidate['revision']
    if current == desired:
        return
    # 別の基底間をtransitionで計算しない。旧版を解除し、新版へ直接適用する。
    cache = root / '.work/editor-patches'
    revision_record = cache / 'revision.json'
    if revision_record.exists() and json.loads(revision_record.read_text(encoding='utf-8'))['revision'] != current:
        raise RuntimeError('導入版の記録と採用元が一致しません。前回更新の退避記録を確認してください。')
    previous = {}
    for patch_ref in candidate['patches']:
        recorded = cache / Path(patch_ref).name
        if not recorded.exists():
            raise RuntimeError('採用元の更新に必要な導入版の記録がありません: ' + patch_ref)
        previous[patch_ref] = recorded.read_text(encoding='utf-8')
    managed = set().union(*(sections(content) for content in previous.values()))
    changed = set(checked_git(source, 'diff', 'HEAD', '--name-only').splitlines())
    if changed - managed:
        raise RuntimeError('導入版と異なる変更があります。保持して更新を止めます: ' + ', '.join(sorted(changed - managed)))
    # 旧配布の無効な空ファイル削除も、実体から基底への差分なら再現しない。
    reverse = ''.join(transition(source, content, '') for content in reversed(list(previous.values())))
    new_names = set().union(*(sections((root / ref).read_text(encoding='utf-8')) for ref in candidate['patches']))
    for name in new_names - managed:
        if (source / name).exists() and git(source, 'cat-file', '-e', 'HEAD:' + name).returncode:
            raise RuntimeError('導入版と異なる変更があります。新しい編集ファイルと衝突します: ' + name)
    if git(source, 'cat-file', '-e', desired + '^{commit}').returncode:
        bundle = root / 'distribution/frontstage.bundle'
        checked_git(source, 'fetch', str(bundle) if bundle.exists() else candidate['repository'], desired)
    current_names = set(checked_git(source, 'ls-tree', '-r', '--name-only', current).splitlines())
    desired_names = set(checked_git(source, 'ls-tree', '-r', '--name-only', desired).splitlines())
    for name in desired_names - current_names - managed:
        target = source / name
        if target.exists() or any(parent.is_file() for parent in target.parents if parent != source and source in parent.parents):
            raise RuntimeError('導入版と異なる変更があります。新しい採用元と衝突します: ' + name)
    scratch = root / '.work/source-update-checks'
    scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=scratch) as directory:
        trial = Path(directory) / 'source'
        checked_git(root, 'clone', '--shared', '--no-checkout', str(source), str(trial))
        checked_git(trial, 'checkout', '--detach', desired)
        for ref in candidate['patches']:
            checked_git(trial, 'apply', str(root / ref))
        for ref in reversed(candidate['patches']):
            checked_git(trial, 'apply', '--reverse', '--check', str(root / ref))
    backup_dir = root / '.work/editor-backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f'{time.time_ns()}-{current[:12]}.tar'
    reverse_file = backup.with_suffix('.patch')
    reverse_file.write_text(reverse, encoding='utf-8', newline='\n')
    backup.with_suffix('.json').write_text(json.dumps({'previousRevision': current, 'nextRevision': desired, 'patches': list(previous)}, ensure_ascii=False), encoding='utf-8')
    with tarfile.open(backup, 'w') as archive:
        for name in sorted(managed):
            if (source / name).is_file():
                archive.add(source / name, arcname='source/' + name)
        for ref in previous:
            archive.add(cache / Path(ref).name, arcname='editor-patches/' + Path(ref).name)
    print('採用元の更新前の編集コードを退避しました: ' + str(backup), flush=True)
    removed = False
    applied = []
    try:
        if reverse:
            checked_git(source, 'apply', '--check', str(reverse_file))
            checked_git(source, 'apply', str(reverse_file))
            removed = True
        checked_git(source, 'checkout', '--detach', desired)
        for ref in candidate['patches']:
            checked_git(source, 'apply', str(root / ref))
            applied.append(ref)
        for ref in candidate['patches']:
            checked_git(source, 'apply', '--reverse', '--check', str(root / ref))
    except Exception as failure:
        try:
            for ref in reversed(applied):
                checked_git(source, 'apply', '--reverse', str(root / ref))
            checked_git(source, 'checkout', '--detach', current)
            if removed:
                checked_git(source, 'apply', '--reverse', str(reverse_file))
            for content in previous.values():
                transition(source, content, content)
        except Exception as recovery:
            raise RuntimeError(f'更新と旧版の復元に失敗しました。退避先: {backup}\n更新: {failure}\n復元: {recovery}') from failure
        print('更新に失敗したため旧版を復元し、編集コードの一致を確認しました。', flush=True)
        raise
    for ref in candidate['patches']:
        (cache / Path(ref).name).write_text((root / ref).read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
    (cache / 'revision.json').write_text(json.dumps({'revision': desired}), encoding='utf-8')
    print('採用元と編集用差分を更新しました: ' + desired)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    candidate = json.loads((root / 'experiments/frontstage.json').read_text(encoding='utf-8'))
    source = root / candidate['workspace']
    change_revision(root, source, candidate)
    for patch_ref in candidate['patches']:
        update(root, source, patch_ref)
    (root / '.work/editor-patches/revision.json').write_text(json.dumps({'revision': candidate['revision']}), encoding='utf-8')
