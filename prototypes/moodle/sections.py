"""Read course sections and activity links from the authenticated Moodle page."""
from urllib.parse import parse_qs, urlsplit

from courses import MOODLE, ProbeError, assert_authenticated, collect_courses, origin, settle


def extract_sections(page, course_id):
    return page.locator('#region-main').evaluate('''(main, courseId) => {
        const selector = 'li.section[id^="section-"], [data-for="section"]';
        const text = element => {
            if (!element) return '';
            const copy = element.cloneNode(true);
            copy.querySelectorAll('.sr-only, .visually-hidden, .accesshide, [aria-hidden="true"]').forEach(n => n.remove());
            return copy.textContent.replace(/\\s+/g, ' ').trim();
        };
        return [...main.querySelectorAll(selector)].map((section, index) => {
            const title = section.querySelector('.sectionname, [data-for="section_title"]');
            const headingLink = title?.querySelector('a[href]');
            const id = section.id || 'section-' + (section.dataset.number || index);
            const resources = [...section.querySelectorAll('li.activity, [data-for="cmitem"]')]
                .filter(activity => activity.closest(selector) === section)
                .filter((activity, i, all) => !all.some(other => other !== activity && other.contains(activity)))
                .map(activity => {
                    const link = activity.querySelector('.activityname a[href], .activityinstance a[href], .activity-instance a[href], a.aalink[href]');
                    const type = [...activity.classList].find(name => name.startsWith('modtype_'))?.slice(8)
                        || activity.dataset.modname || 'activity';
                    const label = activity.querySelector('.instancename, .activityname, .activityinstance, .activity-instance');
                    return {id: activity.id, name: text(label || link) || type, type, url: link?.href || null};
                });
            return {id, name: text(title) || section.dataset.sectionname || 'Section ' + index,
                url: headingLink?.href || 'https://moodle.centralelille.fr/course/view.php?id=' + courseId + '#' + id,
                summaryOnly: section.classList.contains('section-summary'), resources};
        });
    }''', course_id)


def safe_section_url(url, course_id):
    parsed = urlsplit(url)
    query = parse_qs(parsed.query)
    if origin(url) != MOODLE:
        return None
    if parsed.path == '/course/section.php' and query.get('id', [''])[0].isdigit():
        return MOODLE + '/course/section.php?id=' + query['id'][0]
    if parsed.path == '/course/view.php' and query.get('id') == [str(course_id)]:
        section = query.get('section', [''])[0]
        return f'{MOODLE}/course/view.php?id={course_id}' + (f'&section={section}' if section.isdigit() else '')
    return None


def normalize_sections(sections, course_id):
    for section in sections:
        section['url'] = safe_section_url(section['url'], course_id) or f'{MOODLE}/course/view.php?id={course_id}'
        section.pop('summaryOnly', None)
        for resource in section['resources']:
            raw = resource['url']
            parsed = urlsplit(raw or '')
            query = parse_qs(parsed.query)
            parts = parsed.path.split('/')
            valid = (origin(raw or '') == MOODLE and len(parts) == 4 and parts[1] == 'mod'
                     and parts[3] == 'view.php' and parts[2].replace('_', '').isalnum()
                     and query.get('id', [''])[0].isdigit())
            resource['url'] = f'{MOODLE}/mod/{parts[2]}/view.php?id={query["id"][0]}' if valid else None
            resource['available'] = bool(resource['url'])
            resource['moduleId'] = int(query['id'][0]) if valid else None
            if valid:
                resource['type'] = parts[2]
    return sections


def collect_course_sections(page, course_id, progress=lambda stage: None, enrolled=None):
    if not isinstance(course_id, int) or isinstance(course_id, bool) or course_id < 1:
        raise ProbeError('Identifiant de cours invalide.', 'COURSE_ID_INVALID')
    progress('course_access_check')
    enrolled = collect_courses(page, progress) if enrolled is None else enrolled
    if not any(parse_qs(urlsplit(course['url']).query).get('id') == [str(course_id)] for course in enrolled):
        raise ProbeError('Ce cours ne figure pas dans les cours du compte connecte.', 'COURSE_NOT_ENROLLED')
    progress('course_sections_open')
    page.goto(f'{MOODLE}/course/view.php?id={course_id}', wait_until='domcontentloaded')
    assert_authenticated(page)
    settle(page)
    progress('course_sections_extract')
    page.locator('#region-main').wait_for(state='visible')
    sections = extract_sections(page, course_id)
    if not sections:
        raise ProbeError('Format des sections non reconnu.', 'COURSE_SECTIONS_UNSUPPORTED')
    # A multipage format presents section summaries on the course landing page.
    # Follow only section links obtained from this authorized course, never
    # resource links (which may initiate a download or another action).
    pending = [(section['id'], section['url']) for section in sections if section['summaryOnly']]
    if len(pending) > 200:
        raise ProbeError('Limite de sections depassee.', 'COURSE_SECTIONS_UNSUPPORTED')
    for section_id, link in pending:
        url = safe_section_url(link, course_id)
        if not url or ('&section=' not in url and '/section.php?' not in url):
            raise ProbeError('Lien de section non reconnu.', 'COURSE_SECTION_LINK_INVALID')
        progress('course_section_open')
        page.goto(url, wait_until='domcontentloaded')
        assert_authenticated(page)
        settle(page)
        content = extract_sections(page, course_id)
        match = next((section for section in content if section['id'] == section_id), None)
        if match is None or match['summaryOnly']:
            raise ProbeError('Lecture de section incomplete.', 'COURSE_SECTIONS_UNSUPPORTED')
        sections = [match if section['id'] == section_id else section for section in sections]
    assert_authenticated(page)
    return normalize_sections(sections, course_id)
