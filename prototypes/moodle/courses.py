"""Local, interactive Moodle access probe. No saved credentials or session."""
import getpass
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
import warnings

ROOT = Path(__file__).resolve().parent
# Keep the prototype's local installation when present. On deployed servers,
# let Playwright use its normal user cache; explicit configuration takes priority.
if (ROOT / '.browsers').is_dir():
    os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(ROOT / '.browsers'))
# Playwright debug logs can include values passed to fill().
os.environ.pop('DEBUG', None)
os.environ.pop('PWDEBUG', None)
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

MOODLE = 'https://moodle.centralelille.fr'
CAS = 'https://cas.centralelille.fr'
LOGIN = MOODLE + '/login/index.php?authCAS=CAS'
RESULT = ROOT / 'run-result.json'


class ProbeError(Exception):
    def __init__(self, message, code='MOODLE_UNEXPECTED_STATE'):
        super().__init__(message)
        self.code = code


def origin(url):
    parsed = urlsplit(url)
    return f'{parsed.scheme}://{parsed.netloc}'


def settle(page):
    # Moodle tracks asynchronous rendering here, including its course overview.
    page.wait_for_function('() => window.M?.util?.pending_js?.length === 0')


def assert_authenticated(page):
    if origin(page.url) != MOODLE:
        raise ProbeError('Retour vers Moodle non confirme. Connexion refusee ou etape supplementaire.')
    page.locator('a[href*="/login/logout.php"]').first.wait_for(state='attached')
    if page.locator('body.notloggedin, body.guestuser').count():
        raise ProbeError('Moodle indique une session invitee ou non connectee.')


def login_with_credentials(page, username, password, progress=lambda stage: None):
    progress('cas_open')
    page.goto(LOGIN, wait_until='domcontentloaded')
    progress('cas_form')
    form = page.locator('form#fm1')
    if origin(page.url) != CAS or urlsplit(page.url).path != '/cas/login':
        raise ProbeError('Parcours CAS inattendu. Aucun identifiant ne sera saisi.')
    form.locator('input#password[type="password"]').wait_for(state='visible')
    if origin(form.evaluate('(f) => f.action')) != CAS:
        raise ProbeError('Destination du formulaire inattendue. Arret avant saisie.')
    progress('cas_submit')
    form.locator('#username').fill(username)
    form.locator('#password').fill(password)
    form.locator('input[type="submit"]').click()
    progress('moodle_authentication')
    page.wait_for_url(lambda url: origin(url) == MOODLE, timeout=45000)
    assert_authenticated(page)


def select_group(page, block, value):
    item = block.locator(f'[data-filter="grouping"][data-value="{value}"]')
    if not item.count():
        raise ProbeError('Filtre de cours attendu absent : adaptation du collecteur necessaire.', 'COURSE_GROUP_FILTER_MISSING')
    if item.first.get_attribute('aria-current') != 'true':
        block.locator('#groupingdropdown').click()
        item.first.click()
        settle(page)


def disabled(control):
    return control.evaluate('''el => el.classList.contains('disabled') ||
        el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled') ||
        !!el.querySelector('[aria-disabled="true"], [disabled]')''')


def extract_course_rows(block):
    # Moodle can keep previously visited pages in hidden DOM containers.
    return block.locator('[data-region="course-content"]:visible').evaluate_all('''cards => cards.map(card => {
        const a = card.querySelector('a.coursename');
        if (!a) return null;
        const copy = a.cloneNode(true);
        copy.querySelectorAll('.sr-only, .visually-hidden, [aria-hidden="true"]').forEach(n => n.remove());
        return {name: copy.textContent.replace(/\\s+/g, ' ').trim(), url: a.href};
    }).filter(Boolean)''')


def advance_page(page, block, control):
    bar = block.locator('[data-region="paging-bar"]').first
    previous = bar.get_attribute('data-active-page-number')
    if not previous:
        raise ProbeError('Etat de pagination Moodle non reconnu.', 'COURSE_PAGINATION_UNSUPPORTED')
    link = control.locator('a, button')
    (link.first if link.count() else control).click()
    # Pending-JS may still be empty immediately after a click. Require an
    # actual page change before waiting for its asynchronous content to settle.
    page.wait_for_function('''previous => {
        const bar = document.querySelector('[data-block="myoverview"] [data-region="paging-bar"]');
        return bar && bar.getAttribute('data-active-page-number') !== previous;
    }''', arg=previous)
    settle(page)


def rows_from_all_pages(page, block, progress):
    all_items = block.locator('[data-limit="0"]')
    if all_items.count():
        if all_items.first.get_attribute('aria-current') != 'true':
            block.locator('[data-action="limit-toggle"]').click()
            all_items.first.click()
            settle(page)
        progress('courses_extract')
        return extract_course_rows(block)

    progress('courses_pagination')
    bar = block.locator('[data-region="paging-bar"]').first
    if not bar.count() or not bar.get_attribute('data-active-page-number'):
        raise ProbeError('Controles de pagination absents : impossible de garantir une liste complete.',
                         'COURSE_PAGINATION_UNSUPPORTED')
    # Reset to the first page if a filter retained the current page number.
    for _ in range(500):
        if bar.get_attribute('data-active-page-number') == '1':
            break
        previous = bar.locator('[data-control="previous"]').first
        if not previous.count() or disabled(previous):
            raise ProbeError('Retour a la premiere page impossible.', 'COURSE_PAGINATION_UNSUPPORTED')
        advance_page(page, block, previous)
    else:
        raise ProbeError('Limite de pagination depassee.', 'COURSE_PAGINATION_STALLED')

    rows = []
    seen_pages = set()
    for _ in range(500):
        number = bar.get_attribute('data-active-page-number')
        if number in seen_pages:
            raise ProbeError('La pagination ne progresse plus.', 'COURSE_PAGINATION_STALLED')
        seen_pages.add(number)
        progress('courses_extract')
        rows.extend(extract_course_rows(block))
        next_control = bar.locator('[data-control="next"]').first
        if not next_control.count():
            raise ProbeError('Fin de pagination non confirmee.', 'COURSE_PAGINATION_UNSUPPORTED')
        if disabled(next_control):
            return rows
        progress('courses_pagination')
        advance_page(page, block, next_control)
    raise ProbeError('Limite de pagination depassee.', 'COURSE_PAGINATION_STALLED')


def rows_from_moodle_frontend(page, progress):
    """Use the same session-bound read operation as Moodle's course overview.

    The AMD module supplies its own session/CSRF handling. No API token or
    user ID is provided, and no session key crosses the browser boundary.
    """
    rows = []
    offset = 0
    for _ in range(500):
        progress('courses_frontend_request')
        result = page.evaluate('''offset => new Promise(resolve => {
            const timer = setTimeout(() => resolve({error: 'COURSE_FRONTEND_TIMEOUT'}), 30000);
            const finish = result => { clearTimeout(timer); resolve(result); };
            if (typeof window.require !== 'function') {
                finish({error: 'COURSE_FRONTEND_UNAVAILABLE'}); return;
            }
            try {
                window.require(['block_myoverview/repository'], repository => {
                    Promise.resolve().then(() => repository.getEnrolledCoursesByTimeline({
                        classification: 'allincludinghidden', limit: 100, offset: offset,
                    })).then(data => {
                        if (!Array.isArray(data?.courses) || !Number.isInteger(data.nextoffset)) {
                            finish({error: 'COURSE_FRONTEND_INVALID_RESPONSE'}); return;
                        }
                        const courses = data.courses.map(course => {
                            const text = document.createElement('template');
                            text.innerHTML = course.fullname || '';
                            const url = course.viewurl || (Number.isInteger(course.id)
                                ? 'https://moodle.centralelille.fr/course/view.php?id=' + course.id : '');
                            return {name: text.content.textContent.replace(/\\s+/g, ' ').trim(), url};
                        });
                        finish({courses, nextoffset: data.nextoffset});
                    }).catch(() => finish({error: 'COURSE_FRONTEND_REQUEST_FAILED'}));
                }, () => finish({error: 'COURSE_FRONTEND_UNAVAILABLE'}));
            } catch { finish({error: 'COURSE_FRONTEND_UNAVAILABLE'}); }
        })''', offset)
        if result.get('error'):
            raise ProbeError('Lecture des cours via la page Moodle impossible.', result['error'])
        next_offset = result['nextoffset']
        if not result['courses'] and next_offset == offset:
            return rows
        if next_offset <= offset:
            raise ProbeError('La pagination des cours ne progresse plus.', 'COURSE_PAGINATION_STALLED')
        rows.extend(result['courses'])
        offset = next_offset
    raise ProbeError('Limite de pagination depassee.', 'COURSE_PAGINATION_STALLED')


def add_course_rows(courses, rows):
    for row in rows:
        parsed = urlsplit(row['url'])
        if origin(row['url']) != MOODLE or parsed.path != '/course/view.php' or not row['name']:
            raise ProbeError('Lien de cours inattendu : collecte interrompue.', 'COURSE_LINK_INVALID')
        courses[row['url']] = row


def collect_courses(page, progress=lambda stage: None):
    progress('courses_open')
    page.goto(MOODLE + '/my/courses.php', wait_until='domcontentloaded')
    assert_authenticated(page)
    progress('courses_overview')
    block = page.locator('[data-block="myoverview"]')
    block.wait_for(state='visible')
    settle(page)
    # Clear a previous course search to avoid silently returning a subset.
    search = block.locator('input[data-region="input"]')
    if search.count() and search.first.input_value():
        search.first.fill('')
        search.first.press('Enter')
        settle(page)
    inclusive = block.locator('[data-filter="grouping"][data-value="allincludinghidden"]')
    groups = ['allincludinghidden'] if inclusive.count() else ['all']
    courses = {}
    if not inclusive.count() and not block.locator('[data-filter="grouping"][data-value="all"]').count():
        # Some Moodle configurations do not expose an exhaustive grouping in
        # the menu. Read all enrolled courses via the existing web frontend.
        add_course_rows(courses, rows_from_moodle_frontend(page, progress))
        groups = []
    if groups == ['all'] and block.locator('[data-filter="grouping"][data-value="hidden"]').count():
        groups.append('hidden')
    for group in groups:
        progress('courses_filters')
        select_group(page, block, group)
        rows = rows_from_all_pages(page, block, progress)
        add_course_rows(courses, rows)
    assert_authenticated(page)
    if not courses:
        raise ProbeError('Aucun cours extrait : verifier visuellement la page avant de conclure.', 'NO_COURSES_EXTRACTED')
    return sorted(courses.values(), key=lambda row: row['name'].casefold())


def run():
    if not sys.stdin.isatty():
        raise ProbeError('Ouvrir run.ps1 dans un terminal local interactif pour saisir les identifiants.')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, channel='chromium')
        try:
            context = browser.new_context(accept_downloads=False)
            page = context.new_page()
            page.set_default_timeout(30000)
            page.set_default_navigation_timeout(60000)
            print('Ouverture du parcours Centrale Lille...')
            page.goto(LOGIN, wait_until='domcontentloaded')
            if origin(page.url) != CAS or urlsplit(page.url).path != '/cas/login':
                raise ProbeError('Parcours CAS inattendu. Aucun identifiant ne sera saisi.')
            form = page.locator('form#fm1')
            form.locator('input#username').wait_for(state='visible')
            form.locator('input#password[type="password"]').wait_for(state='visible')
            action = form.evaluate('(f) => f.action')
            if origin(action) != CAS:
                raise ProbeError('Destination du formulaire inattendue. Arret avant saisie.')
            print('Formulaire CAS confirme. Les identifiants restent dans ce processus local.')
            username = input('Identifiant Centrale Lille : ').strip()
            with warnings.catch_warnings():
                # Fail closed if getpass cannot disable echo; never fall back to plain input.
                warnings.simplefilter('error', getpass.GetPassWarning)
                password = getpass.getpass('Mot de passe (masque) : ', echo_char='*')
            if not username or not password:
                raise ProbeError('Saisie vide. Connexion annulee.')
            # Recheck the destination after the interactive prompt.
            if origin(page.url) != CAS or origin(form.evaluate('(f) => f.action')) != CAS:
                raise ProbeError('Le formulaire a change pendant la saisie. Arret.')
            try:
                form.locator('#username').fill(username)
                form.locator('#password').fill(password)
                form.locator('input[type="submit"]').click()
            finally:
                password = None
                username = None
            # One login attempt only, to avoid repeated failures/account lockout.
            try:
                page.wait_for_url(lambda url: origin(url) == MOODLE, timeout=45000)
            except PlaywrightTimeout:
                raise ProbeError('Connexion non confirmee. Verifier la fenetre du navigateur : refus ou etape supplementaire.') from None
            assert_authenticated(page)
            print('Connexion Moodle confirmee. Lecture de Mes cours...')
            courses = collect_courses(page)
            print(f'\n{len(courses)} cours trouves :\n')
            for course in courses:
                print(f"- {course['name']}\n  {course['url']}")
            print('\nComparez cette liste avec Mes cours dans le navigateur.')
            RESULT.write_text(json.dumps({'status': 'listed', 'count': len(courses)}), encoding='utf-8')
            input('Appuyez sur Entree apres verification pour fermer le navigateur...')
        finally:
            browser.close()


def main():
    RESULT.write_text('{"status":"running"}', encoding='utf-8')
    try:
        run()
        return 0
    except (KeyboardInterrupt, EOFError):
        message = 'Test annule.'
    except ProbeError as error:
        message = str(error)
    except Exception as error:
        # Raw Playwright exceptions may contain typed values or CAS tickets.
        message = f'Test interrompu ({type(error).__name__}). Aucun detail sensible journalise.'
    print(message)
    RESULT.write_text(json.dumps({'status': 'failed', 'message': message}), encoding='utf-8')
    return 1


if __name__ == '__main__':
    sys.exit(main())
