"""Browser cache selection during the real collector import."""
import os
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch


class BrowserCacheChecks(unittest.TestCase):
    def test_import_respects_configuration_and_server_default(self):
        for local, configured in [(False, None), (True, None), (True, '/custom'), (False, '/custom')]:
            with self.subTest(local=local, configured=configured):
                with patch.dict(os.environ, {}, clear=True), patch.object(Path, 'is_dir', return_value=local):
                    if configured is not None:
                        os.environ['PLAYWRIGHT_BROWSERS_PATH'] = configured
                    module = runpy.run_path(str(Path(__file__).with_name('courses.py')))
                    expected = configured if configured is not None else str(module['ROOT'] / '.browsers') if local else None
                    self.assertEqual(os.environ.get('PLAYWRIGHT_BROWSERS_PATH'), expected)
