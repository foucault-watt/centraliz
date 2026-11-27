import unittest
from unittest.mock import MagicMock, patch
from session_worker import Session
from courses import MOODLE
from courses import ProbeError


class SessionChecks(unittest.TestCase):
    def test_browser_login_and_metadata_are_reused_until_ttl(self):
        playwright = MagicMock()
        page = playwright.chromium.launch.return_value.new_context.return_value.new_page.return_value
        page.url = MOODLE + '/my/courses.php'
        page.locator.return_value.count.return_value = 1
        stages = []
        session = Session(playwright, stages.append)
        request = {'entUsername': 'alice', 'password': 'private', 'operation': 'sections', 'courseId': 12}
        with patch('session_worker.login_with_credentials') as login, \
                patch('session_worker.collect_courses', return_value=[]) as courses, \
                patch('session_worker.collect_course_sections', return_value=[]) as sections:
            session.execute(request)
            session.execute(request)
            self.assertEqual(login.call_count, 1)
            self.assertEqual(courses.call_count, 1)
            self.assertEqual(sections.call_count, 1)
            self.assertIn('session_reused', stages)
            session.expires = 0
            session.execute(request)
            self.assertEqual(courses.call_count, 2)
            self.assertEqual(sections.call_count, 2)
            self.assertEqual(login.call_count, 1)
            session.expires = 0
            page.url = 'https://cas.centralelille.fr/cas/login'
            session.execute(request)
            self.assertEqual(login.call_count, 2)
        session.close()
        self.assertIsNone(session.browser)
        self.assertIsNone(session.courses)

    def test_expired_session_during_navigation_is_reconnected_once(self):
        playwright = MagicMock()
        page = playwright.chromium.launch.return_value.new_context.return_value.new_page.return_value
        page.url = MOODLE + '/my/courses.php'
        page.locator.return_value.count.return_value = 1
        session = Session(playwright, lambda stage: None)
        request = {'entUsername': 'alice', 'password': 'private', 'operation': 'courses'}
        def authenticate(*args):
            page.url = MOODLE + '/my/courses.php'
        attempts = []
        def collect(*args, **kwargs):
            attempts.append(1)
            if len(attempts) == 1:
                page.url = 'https://cas.centralelille.fr/cas/login'
                raise ProbeError('Session expired')
            return []
        with patch('session_worker.login_with_credentials', side_effect=authenticate) as login, \
                patch('session_worker.collect_courses', return_value=[]), \
                patch('session_worker.collect_course_sections', side_effect=collect):
            session.execute(request)
            session.execute({**request, 'operation': 'sections', 'courseId': 12})
            self.assertEqual(login.call_count, 2)
            self.assertEqual(len(attempts), 2)
        session.close()


if __name__ == '__main__':
    unittest.main()
