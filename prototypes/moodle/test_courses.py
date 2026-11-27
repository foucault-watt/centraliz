"""Offline checks; these do not validate a real Moodle account."""
import unittest
from unittest.mock import patch

import courses
from playwright.sync_api import sync_playwright


class CollectionChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel='chromium')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page()
        self.page.set_content('''
            <script>window.M = {util: {pending_js: []}};</script>
            <div data-block="myoverview">
              <a data-filter="grouping" data-value="allincludinghidden" aria-current="true"></a>
              <a data-limit="0" aria-current="true"></a>
              <div data-region="course-content"><a class="coursename"
                href="https://moodle.centralelille.fr/course/view.php?id=12">
                <span class="sr-only">Nom du cours</span> Mathematiques
              </a></div>
              <div data-region="course-content"><a class="coursename"
                href="https://moodle.centralelille.fr/course/view.php?id=12">Mathematiques</a></div>
            </div>''')
        self.navigation = patch.object(type(self.page), 'goto').start()
        self.authentication = patch('courses.assert_authenticated').start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.page.close)

    def test_extracts_titles_links_and_deduplicates(self):
        self.assertEqual(courses.collect_courses(self.page), [{
            'name': 'Mathematiques',
            'url': 'https://moodle.centralelille.fr/course/view.php?id=12',
        }])

    def test_refuses_incomplete_pagination(self):
        self.page.locator('[data-limit]').evaluate('(el) => el.remove()')
        with self.assertRaisesRegex(courses.ProbeError, 'pagination') as failure:
            courses.collect_courses(self.page)
        self.assertEqual(failure.exception.code, 'COURSE_PAGINATION_UNSUPPORTED')

    def test_collects_all_pages_when_show_all_is_unavailable(self):
        self.page.locator('[data-limit]').evaluate('(el) => el.remove()')
        self.page.locator('[data-block]').evaluate('''block => {
            block.insertAdjacentHTML('beforeend', `<nav data-region="paging-bar" data-active-page-number="1">
              <li data-control="next"><a href="#">Next</a></li></nav>`);
            block.querySelector('[data-control="next"] a').onclick = e => {
                e.preventDefault();
                block.querySelectorAll('[data-region="course-content"]').forEach(el => {
                    el.style.display = 'none';
                    el.querySelector('a').textContent = 'Ancienne page cachee';
                });
                block.insertAdjacentHTML('beforeend', `<div data-region="course-content"><a class="coursename"
                  href="https://moodle.centralelille.fr/course/view.php?id=13">Physique</a></div>`);
                block.querySelector('[data-region="paging-bar"]').dataset.activePageNumber = '2';
                block.querySelector('[data-control="next"]').classList.add('disabled');
            };
        }''')
        self.assertEqual([row['name'] for row in courses.collect_courses(self.page)], ['Mathematiques', 'Physique'])

    def test_missing_group_filter_has_a_specific_diagnostic(self):
        self.page.locator('[data-filter="grouping"]').evaluate('(el) => el.remove()')
        with self.assertRaises(courses.ProbeError) as failure:
            courses.select_group(self.page, self.page.locator('[data-block]'), 'all')
        self.assertEqual(failure.exception.code, 'COURSE_GROUP_FILTER_MISSING')

    def test_missing_group_menu_uses_the_authenticated_moodle_frontend(self):
        self.page.locator('[data-filter="grouping"]').evaluate('(el) => el.remove()')
        self.page.evaluate('''() => {
            window.frontendCalls = [];
            window.require = (modules, ready) => ready({getEnrolledCoursesByTimeline: async args => {
                window.frontendCalls.push(args);
                if (args.offset === 0) return {courses: [{id: 13, fullname: '<b>Physique</b>',
                    viewurl: 'https://moodle.centralelille.fr/course/view.php?id=13'}], nextoffset: 1};
                return {courses: [], nextoffset: 1};
            }});
        }''')
        self.assertEqual(courses.collect_courses(self.page), [{
            'name': 'Physique', 'url': 'https://moodle.centralelille.fr/course/view.php?id=13',
        }])
        calls = self.page.evaluate('window.frontendCalls')
        self.assertEqual([call['offset'] for call in calls], [0, 1])
        self.assertTrue(all(call['classification'] == 'allincludinghidden' for call in calls))

    def test_frontend_error_does_not_expose_its_raw_message(self):
        self.page.locator('[data-filter="grouping"]').evaluate('(el) => el.remove()')
        self.page.evaluate('''() => {
            window.require = (modules, ready) => ready({getEnrolledCoursesByTimeline: async () => {
                throw new Error('private-ticket-and-password');
            }});
        }''')
        with self.assertRaises(courses.ProbeError) as failure:
            courses.collect_courses(self.page)
        self.assertEqual(failure.exception.code, 'COURSE_FRONTEND_REQUEST_FAILED')
        self.assertNotIn('private-', str(failure.exception))

    def test_frontend_pagination_must_make_progress(self):
        self.page.locator('[data-filter="grouping"]').evaluate('(el) => el.remove()')
        self.page.evaluate('''() => {
            window.require = (modules, ready) => ready({getEnrolledCoursesByTimeline: async () => ({
                courses: [{id: 13, fullname: 'Physique'}], nextoffset: 0,
            })});
        }''')
        with self.assertRaises(courses.ProbeError) as failure:
            courses.collect_courses(self.page)
        self.assertEqual(failure.exception.code, 'COURSE_PAGINATION_STALLED')

    def test_refuses_foreign_course_links(self):
        self.page.locator('a.coursename').first.evaluate('(el) => el.href = "https://example.com/course/view.php?id=12"')
        with self.assertRaisesRegex(courses.ProbeError, 'Lien de cours inattendu'):
            courses.collect_courses(self.page)

    def test_login_refuses_an_unexpected_origin_before_filling_fields(self):
        with self.assertRaisesRegex(courses.ProbeError, 'Parcours CAS inattendu'):
            courses.login_with_credentials(self.page, 'test-user', 'test-password')

    def test_login_refuses_a_form_posting_to_another_origin(self):
        self.page.set_content('''<form id="fm1" action="https://example.com/login">
            <input id="username"><input id="password" type="password"></form>''')
        with patch('courses.origin', side_effect=[courses.CAS, 'https://example.com']), \
                patch('courses.urlsplit') as split:
            split.return_value.path = '/cas/login'
            with self.assertRaisesRegex(courses.ProbeError, 'Destination du formulaire inattendue'):
                courses.login_with_credentials(self.page, 'test-user', 'test-password')
        self.assertEqual(self.page.locator('#password').input_value(), '')


if __name__ == '__main__':
    unittest.main()
