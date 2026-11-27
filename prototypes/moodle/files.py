"""Transfer original Moodle files. No document parsing or text extraction."""
import base64
from email.message import Message
import hashlib
from html.parser import HTMLParser
from http.cookiejar import Cookie, CookieJar
import mimetypes
import re
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler, Request

from courses import MOODLE, ProbeError, origin
from sections import collect_course_sections

MAX_FILE_BYTES = 20 * 1024 * 1024


def safe_download_url(url):
    parsed = urlsplit(url)
    return origin(url) == MOODLE and (parsed.path.startswith('/pluginfile.php/')
        or parsed.path in ('/mod/resource/view.php', '/mod/folder/view.php'))


class MoodleRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not safe_download_url(newurl):
            raise ProbeError('Redirection de fichier non autorisee.', 'FILE_REDIRECT_REJECTED')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def make_opener(context):
    jar = CookieJar()
    for item in context.cookies(MOODLE):
        jar.set_cookie(Cookie(0, item['name'], item['value'], None, False,
            item['domain'], item['domain'].startswith('.'), item['domain'].startswith('.'),
            item['path'], True, item.get('secure', True), None, True, None, None, {}, False))
    return build_opener(HTTPCookieProcessor(jar), MoodleRedirects())


def read_response(opener, url):
    if not safe_download_url(url):
        raise ProbeError('Lien de fichier non autorise.', 'FILE_REDIRECT_REJECTED')
    with opener.open(Request(url, headers={'User-Agent': 'Centraliz Moodle connector'}), timeout=45) as response:
        length = response.headers.get('Content-Length', '')
        if length.isdigit() and int(length) > MAX_FILE_BYTES:
            raise ProbeError('Fichier superieur a 20 Mio.', 'FILE_TOO_LARGE')
        data = response.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise ProbeError('Fichier superieur a 20 Mio.', 'FILE_TOO_LARGE')
        if not safe_download_url(response.geturl()):
            raise ProbeError('Destination du fichier inattendue.', 'FILE_REDIRECT_REJECTED')
        return data, response.headers, response.geturl()


def file_name(headers, url):
    message = Message()
    message['Content-Disposition'] = headers.get('Content-Disposition', '')
    name = message.get_filename() or unquote(urlsplit(url).path.rsplit('/', 1)[-1]) or 'document'
    return re.sub(r'[\x00-\x1f<>:"|?*]', '_', name.replace('\\', '/').rsplit('/', 1)[-1])[:180] or 'document'


class FileLinks(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base = base
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        target = fields.get({'a': 'href', 'iframe': 'src', 'embed': 'src', 'object': 'data'}.get(tag, ''))
        if target:
            url = urljoin(self.base, target)
            if origin(url) == MOODLE and urlsplit(url).path.startswith('/pluginfile.php/'):
                self.urls.add(url)


def resource_files(page, course_id, module_id, progress, sections=None, resource_cache=None):
    sections = collect_course_sections(page, course_id, progress) if sections is None else sections
    resource = next((r for section in sections for r in section['resources']
                     if r['url'] and r.get('moduleId') == module_id), None)
    if resource is None or resource['type'] not in ('resource', 'folder'):
        raise ProbeError('Cette ressource fichier ne figure pas dans le cours.', 'FILE_RESOURCE_NOT_ACCESSIBLE')
    key = (course_id, module_id)
    if resource_cache is not None and key in resource_cache:
        progress('resource_cache_hit')
        return make_opener(page.context), resource_cache[key]
    progress('file_resource_open')
    opener = make_opener(page.context)
    data, headers, final_url = read_response(opener, resource['url'])
    mime = headers.get('Content-Type', '').split(';')[0].strip().lower()
    attachment = 'attachment' in headers.get('Content-Disposition', '').lower()
    html_file = urlsplit(final_url).path.lower().endswith(('.html', '.htm'))
    if mime != 'text/html' or attachment or html_file:
        candidates = [{'url': final_url, 'name': file_name(headers, final_url), 'cached': (data, headers)}]
        if resource_cache is not None:
            resource_cache[key] = candidates
        return opener, candidates
    links = FileLinks(final_url)
    links.feed(data.decode('utf-8', errors='replace'))
    candidates = [{'url': url, 'name': file_name({}, url)} for url in sorted(links.urls)]
    if not candidates:
        raise ProbeError('Aucun fichier telechargeable trouve dans cette ressource.', 'FILE_NOT_FOUND')
    if resource_cache is not None:
        resource_cache[key] = candidates
    return opener, candidates


def list_resource_files(page, course_id, module_id, progress=lambda stage: None, **options):
    _, candidates = resource_files(page, course_id, module_id, progress, **options)
    return [{'fileIndex': index, 'name': candidate['name'],
             'mimeType': mimetypes.guess_type(candidate['name'])[0] or 'application/octet-stream'}
            for index, candidate in enumerate(candidates)]


def download_resource_file(page, course_id, module_id, file_index=0, progress=lambda stage: None, **options):
    opener, candidates = resource_files(page, course_id, module_id, progress, **options)
    if not isinstance(file_index, int) or isinstance(file_index, bool) or not 0 <= file_index < len(candidates):
        raise ProbeError('Indice de fichier invalide.', 'FILE_NOT_FOUND')
    progress('file_download')
    candidate = candidates[file_index]
    data, headers = candidate['cached'] if 'cached' in candidate else read_response(opener, candidate['url'])[:2]
    candidate['cached'] = (data, headers)
    mime = headers.get('Content-Type', '').split(';')[0].strip().lower()
    name = file_name(headers, candidate['url'])
    return {'name': name, 'mimeType': mime or mimetypes.guess_type(name)[0] or 'application/octet-stream',
            'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'blob': base64.b64encode(data).decode('ascii')}
