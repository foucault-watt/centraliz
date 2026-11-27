import base64
import io
import unittest
from unittest.mock import patch

import files
from courses import MOODLE, ProbeError


class Response(io.BytesIO):
    def __init__(self, data, headers, url):
        super().__init__(data)
        self.headers = headers
        self.url = url

    def geturl(self):
        return self.url


class FileChecks(unittest.TestCase):
    def test_exact_original_bytes_and_metadata_without_text_extraction(self):
        data = b'%PDF-1.7\n\x00\xffbinary-original'
        candidate = {'url': MOODLE + '/pluginfile.php/1/mod_resource/content/1/cours.pdf',
                     'cached': (data, {'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cours.pdf"'})}
        with patch('files.resource_files', return_value=(None, [candidate])):
            result = files.download_resource_file(None, 12, 7)
        self.assertEqual(base64.b64decode(result['blob']), data)
        self.assertEqual(result['name'], 'cours.pdf')
        self.assertEqual(result['size'], len(data))
        self.assertNotIn('text', result)

    def test_folder_links_are_deduplicated_and_external_links_are_ignored(self):
        parser = files.FileLinks(MOODLE + '/mod/folder/view.php?id=7')
        parser.feed('<a href="/pluginfile.php/1/mod_folder/content/0/a.docx">A</a>'
                    '<a href="/pluginfile.php/1/mod_folder/content/0/a.docx">A</a>'
                    '<a href="https://evil.example/pluginfile.php/a.pdf">Other</a>')
        self.assertEqual(len(parser.urls), 1)

    def test_cross_origin_redirect_is_rejected_before_request(self):
        with self.assertRaises(ProbeError):
            files.MoodleRedirects().redirect_request(None, None, 302, '', {}, 'https://evil.example/file.pdf')

    def test_stream_size_limit_applies_without_content_length(self):
        class Opener:
            def open(self, *args, **kwargs):
                return Response(b'12345', {}, MOODLE + '/pluginfile.php/a.pdf')
        with patch('files.MAX_FILE_BYTES', 4), self.assertRaises(ProbeError) as failure:
            files.read_response(Opener(), MOODLE + '/pluginfile.php/a.pdf')
        self.assertEqual(failure.exception.code, 'FILE_TOO_LARGE')

    def test_resource_must_belong_to_authorized_course(self):
        with patch('files.collect_course_sections', return_value=[]), self.assertRaises(ProbeError) as failure:
            files.resource_files(None, 12, 999, lambda stage: None)
        self.assertEqual(failure.exception.code, 'FILE_RESOURCE_NOT_ACCESSIBLE')

    def test_filename_cannot_escape_a_download_directory(self):
        name = files.file_name({'Content-Disposition': 'attachment; filename="../../secret.pdf"'}, MOODLE + '/pluginfile.php/a.pdf')
        self.assertEqual(name, 'secret.pdf')


if __name__ == '__main__':
    unittest.main()
