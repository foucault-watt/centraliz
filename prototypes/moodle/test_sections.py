import unittest
from unittest.mock import patch

from playwright.sync_api import sync_playwright
from courses import MOODLE, ProbeError
import sections


class SectionChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = sync_playwright().start()
        cls.browser = cls.p.chromium.launch(channel='chromium')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()

    def setUp(self):
        self.page = self.browser.new_page()
        self.addCleanup(self.page.close)
        patch('sections.collect_courses', return_value=[{'url': MOODLE + '/course/view.php?id=12'}]).start()
        patch('sections.assert_authenticated').start()
        patch('sections.settle').start()
        self.navigation = patch.object(type(self.page), 'goto').start()
        self.addCleanup(patch.stopall)

    def test_extracts_resources_and_unavailable_activities_by_section(self):
        self.page.set_content('''<main id="region-main"><li id="section-0" data-for="section">
            <h3 class="sectionname">General</h3><ul><li class="activity modtype_resource" id="module-7">
            <div class="activityname"><a href="https://moodle.centralelille.fr/mod/resource/view.php?id=7&amp;sesskey=private">
            Support PDF<span class="accesshide">File</span></a></div></li>
            <li class="activity modtype_assign" id="module-8"><div class="activityname">Travail restreint</div></li>
            </ul></li><li id="section-1" data-for="section"><h3 class="sectionname">Chapitre 1</h3></li></main>''')
        result = sections.collect_course_sections(self.page, 12)
        self.assertEqual(len(result), 2)
        resource = result[0]['resources'][0]
        self.assertEqual(resource['name'], 'Support PDF')
        self.assertEqual(resource['moduleId'], 7)
        self.assertEqual(resource['url'], MOODLE + '/mod/resource/view.php?id=7')
        self.assertFalse(result[0]['resources'][1]['available'])
        self.assertNotIn('private', str(result))

    def test_cannot_read_an_unenrolled_course(self):
        with self.assertRaises(ProbeError) as failure:
            sections.collect_course_sections(self.page, 999)
        self.assertEqual(failure.exception.code, 'COURSE_NOT_ENROLLED')
        self.navigation.assert_not_called()

    def test_follows_multipage_section_links(self):
        def navigate(url, **kwargs):
            if '&section=1' in url:
                self.page.set_content('<main id="region-main"><li id="section-1" data-for="section"><h3 class="sectionname">Chapitre</h3></li></main>')
            else:
                self.page.set_content('<main id="region-main"><li id="section-1" data-for="section" class="section-summary"><h3 class="sectionname"><a href="https://moodle.centralelille.fr/course/view.php?id=12&amp;section=1">Chapitre</a></h3></li></main>')
        self.navigation.side_effect = navigate
        result = sections.collect_course_sections(self.page, 12)
        self.assertEqual(result[0]['name'], 'Chapitre')
        self.assertEqual(self.navigation.call_count, 2)


if __name__ == '__main__':
    unittest.main()
