"""Single-account worker. Serial JSON lines; browser state stays only in memory."""
import json
import sys
import time

from courses import sync_playwright, login_with_credentials, collect_courses, MOODLE, origin
from sections import collect_course_sections
from files import list_resource_files, download_resource_file

TTL = 60


class Session:
    def __init__(self, playwright, progress):
        self.playwright = playwright
        self.progress = progress
        self.browser = None
        self.page = None
        self.clear()

    def clear(self):
        self.courses = None
        self.sections = {}
        self.resources = {}
        self.expires = 0

    def close(self):
        if self.browser:
            self.browser.close()
        self.browser = self.page = None
        self.clear()

    def execute(self, request):
        reused = self.browser is not None
        try:
            return self._execute(request)
        except Exception:
            # Retry once only when a reused session actually redirected to
            # authentication. Never replay arbitrary collection errors.
            expired = False
            if reused and self.page:
                try:
                    expired = origin(self.page.url) != MOODLE or bool(self.page.locator('body.notloggedin, body.guestuser').count())
                except Exception:
                    pass
            if not expired:
                raise
            self.close()
            self.progress('session_reconnecting')
            return self._execute(request)

    def _execute(self, request):
        if self.browser is None:
            self.progress('browser_start')
            self.browser = self.playwright.chromium.launch(headless=True, channel='chromium')
            self.page = self.browser.new_context(accept_downloads=False).new_page()
            self.page.set_default_timeout(30000)
            self.page.set_default_navigation_timeout(60000)
            login_with_credentials(self.page, request['entUsername'], request['password'], self.progress)
        else:
            self.progress('session_reused')
        if time.monotonic() >= self.expires:
            self.clear()
            # One lightweight authenticated check before using the session.
            self.page.goto(MOODLE + '/my/courses.php', wait_until='domcontentloaded')
            if origin(self.page.url) != MOODLE or not self.page.locator('a[href*="/login/logout.php"]').count():
                self.progress('session_reconnecting')
                login_with_credentials(self.page, request['entUsername'], request['password'], self.progress)
            self.expires = time.monotonic() + TTL
        if self.courses is None:
            self.courses = collect_courses(self.page, self.progress)
        else:
            self.progress('courses_cache_hit')
        operation = request['operation']
        if operation == 'courses':
            return self.courses
        course_id = request['courseId']
        if course_id not in self.sections:
            self.sections[course_id] = collect_course_sections(self.page, course_id, self.progress, enrolled=self.courses)
        else:
            self.progress('sections_cache_hit')
        if operation == 'sections':
            return self.sections[course_id]
        options = dict(sections=self.sections[course_id], resource_cache=self.resources)
        if operation == 'files':
            result = list_resource_files(self.page, course_id, request['moduleId'], self.progress, **options)
        elif operation == 'file':
            result = download_resource_file(self.page, course_id, request['moduleId'], request.get('fileIndex', 0), self.progress, **options)
        else:
            raise ValueError('Invalid operation')
        # Bound retained document bytes, independently of the number of files.
        if sum(len(c['cached'][0]) for values in self.resources.values() for c in values if 'cached' in c) > 40 * 1024 * 1024:
            self.resources.clear()
        return result


def main():
    stage = 'runtime_imports'

    def progress(value):
        nonlocal stage
        stage = value
        print(json.dumps({'event': 'stage_started', 'stage': value}), file=sys.stderr, flush=True)

    with sync_playwright() as p:
        session = Session(p, progress)
        try:
            for line in sys.stdin:
                request = None
                try:
                    request = json.loads(line)
                    result = session.execute(request)
                    print(json.dumps({request['operation']: result}, ensure_ascii=True), flush=True)
                except Exception as error:
                    reason = getattr(error, 'code', 'MOODLE_UNEXPECTED_STATE')
                    print(json.dumps({'event': 'stage_failed', 'stage': stage,
                                      'errorType': type(error).__name__, 'reason': reason}), file=sys.stderr, flush=True)
                    session.close()  # Never reuse uncertain session state or cached rights.
                    code = 'MOODLE_COURSE_NOT_ACCESSIBLE' if reason == 'COURSE_NOT_ENROLLED' else 'MOODLE_COLLECTION_FAILED'
                    print(json.dumps({'code': code}), flush=True)
                finally:
                    request = None
                    line = None
        finally:
            session.close()


if __name__ == '__main__':
    main()
