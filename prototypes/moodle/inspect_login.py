"""Inspect only the public login form, without entering credentials."""
import os
from pathlib import Path
from urllib.parse import urlsplit

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(Path(__file__).parent / '.browsers')
from playwright.sync_api import sync_playwright

LOGIN = 'https://moodle.centralelille.fr/login/index.php?authCAS=CAS'


def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chromium')
        try:
            page = browser.new_page()
            page.goto(LOGIN, wait_until='domcontentloaded', timeout=60000)
            print('Origin:', urlsplit(page.url).netloc)
            print('Path:', urlsplit(page.url).path)
            print('Title:', page.title())
            print('Forms:', page.locator('form').evaluate_all('''forms => forms.map(f => ({
                id: f.id, method: f.method,
                actionOrigin: new URL(f.action).origin,
                fields: [...f.querySelectorAll('input, button')].map(i => ({
                    tag: i.tagName, type: i.type, name: i.name, id: i.id
                }))
            }))'''))
        finally:
            browser.close()


if __name__ == '__main__':
    inspect()
