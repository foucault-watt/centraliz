"""Private stdin/stdout bridge used by the Centraliz backend, never by an LLM."""
import json
import sys

def main():
    # Only stdin carries credentials. No CLI arguments, files, or raw errors.
    stage = 'runtime_imports'

    def progress(next_stage):
        nonlocal stage
        stage = next_stage
        print(json.dumps({'event': 'stage_started', 'stage': stage}), file=sys.stderr, flush=True)

    try:
        progress('runtime_imports')
        from courses import collect_courses, login_with_credentials, sync_playwright
        from sections import collect_course_sections
        from files import list_resource_files, download_resource_file
        progress('input')
        credentials = json.loads(sys.stdin.read(16384))
        operation = credentials.get('operation', 'courses')
        course_id = credentials.get('courseId')
        module_id = credentials.get('moduleId')
        file_index = credentials.get('fileIndex', 0)
        if operation not in ('courses', 'sections', 'files', 'file'):
            raise ValueError('Invalid operation')
        if not credentials.get('entUsername') or not credentials.get('password'):
            raise ValueError('Missing credentials')
        with sync_playwright() as p:
            progress('browser_start')
            browser = p.chromium.launch(headless=True, channel='chromium')
            try:
                context = browser.new_context(accept_downloads=False)
                page = context.new_page()
                page.set_default_timeout(30000)
                page.set_default_navigation_timeout(60000)
                login_with_credentials(page, credentials['entUsername'], credentials['password'], progress)
                credentials = None
                if operation == 'sections':
                    result = collect_course_sections(page, course_id, progress)
                elif operation == 'files':
                    result = list_resource_files(page, course_id, module_id, progress)
                elif operation == 'file':
                    result = download_resource_file(page, course_id, module_id, file_index, progress)
                else:
                    result = collect_courses(page, progress)
            finally:
                # Preserve the failed stage if closing the browser is cleanup.
                browser.close()
        progress('completed')
        print(json.dumps({operation: result}, ensure_ascii=True))
        return 0
    except Exception as error:
        # Errors can contain secrets; the backend returns a fixed public error.
        allowed_types = {'TimeoutError', 'ProbeError', 'Error', 'ModuleNotFoundError', 'ImportError', 'ValueError', 'JSONDecodeError'}
        error_type = type(error).__name__
        print(json.dumps({'event': 'stage_failed', 'stage': stage,
                          'errorType': error_type if error_type in allowed_types else 'Error',
                          'reason': getattr(error, 'code', 'MOODLE_UNEXPECTED_STATE')}), file=sys.stderr, flush=True)
        code = 'MOODLE_COURSE_NOT_ACCESSIBLE' if getattr(error, 'code', None) == 'COURSE_NOT_ENROLLED' else 'MOODLE_COLLECTION_FAILED'
        print(json.dumps({'code': code}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
