"""採用tokenizerで、Unicode文字の途中をJSON完了と誤判定しないことを確認する。"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

import torch
from transformers import AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
worker = Path(sys.argv.pop(1)) if len(sys.argv) > 1 else ROOT / '.work/frontstage/apps/desktop/src/main/video-search.py'
spec = importlib.util.spec_from_file_location('video_search', worker)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UnicodeJsonTest(unittest.TestCase):
    def test_unicode_strings_end_only_after_the_document(self):
        tokenizer = AutoTokenizer.from_pretrained(str(ROOT / '.work/video-understanding/models/videochat3'),
            local_files_only=True)
        schema = {'type': 'array', 'items': {'type': 'object', 'properties': {
            'observation': {'type': 'string'}, 'uncertainty': {'type': 'string'}},
            'required': ['observation', 'uncertainty'], 'additionalProperties': False}}
        prefix = module.build_json_prefix(tokenizer, schema, 1)
        document = json.dumps([{'observation': '赤、緑。한글🟢', 'uncertainty': '境界は概算'}],
            ensure_ascii=False, separators=(',', ':'))
        sent = [tokenizer.pad_token_id]
        allowed = prefix(0, torch.tensor(sent))
        for token in tokenizer.encode(document, add_special_tokens=False):
            self.assertIn(token, allowed)
            sent.append(token)
            allowed = prefix(0, torch.tensor(sent))
            decoded = tokenizer.decode(sent[1:], clean_up_tokenization_spaces=False)
            try:
                json.loads(decoded)
                complete = True
            except json.JSONDecodeError:
                complete = False
            self.assertEqual(tokenizer.eos_token_id in allowed, complete, repr(decoded))
        self.assertEqual(json.loads(tokenizer.decode(sent[1:])), json.loads(document))


if __name__ == '__main__':
    unittest.main()
