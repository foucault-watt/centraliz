const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

exports.downloadCSV = async (username, password) => {
    console.log('Launching soon...');
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
    });

    console.log('Launching browser...');

    const page = await browser.newPage();
  
    console.log('Launching new page...');


    try {
        // Set up download behavior
        const downloadPath = path.resolve(__dirname, 'downloads');
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath);
        }
        await page._client().send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        // Logging in and navigating the UI
        page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
        await page.goto('https://webaurion.centralelille.fr/', { waitUntil: 'networkidle2' });
        console.log('Page loaded');
        
        await page.type('#username', username);
        await page.type('#password', password);
        console.log('Credentials entered');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.evaluate(() => document.querySelector('#formulaireSpring').submit())
        ]);
        console.log('Logged in successfully');

        // Wait for sidebar and click through to export the CSV
        await page.waitForSelector('#form\\:sidebar', { visible: true, timeout: 10000 });
        console.log('Sidebar loaded');
        
        const resultSelector = "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null > a";
        await page.waitForSelector(resultSelector, { visible: true, timeout: 10000 });
        await page.click(resultSelector);
        console.log('Clicked on the result element');

        const iteemSelector = "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null.enfants-entierement-charges > ul > li > a";
        await page.waitForSelector(iteemSelector, { visible: true, timeout: 10000 });
        await page.click(iteemSelector);
        console.log('Clicked on the iteem element');

        const notesSelector = "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null.enfants-entierement-charges > ul > li > ul > li:nth-child(1) > a";
        await page.waitForSelector(notesSelector, { visible: true, timeout: 10000 });
        await page.click(notesSelector);
        console.log('Clicked on the notes element');

        const exportSelector = "#form\\:exportButton";
        await page.waitForSelector(exportSelector, { visible: true, timeout: 10000 });
        await page.click(exportSelector);
        console.log('Clicked on the export element');

        const csvSelector = "#form\\:j_idt158 > ul > li:nth-child(3) > a";
        await page.waitForSelector(csvSelector, { visible: true, timeout: 10000 });
        await page.click(csvSelector);
        console.log('Clicked on the csv element');

        // Wait for the file to be downloaded
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Adjust this time if needed

        // Find the downloaded file in the specified folder
        const files = fs.readdirSync(downloadPath);
        const csvFile = files.find(file => file.endsWith('.csv'));

        if (csvFile) {
            console.log('CSV downloaded:', csvFile);
            const filePath = path.resolve(downloadPath, csvFile);

            // Return the path to the downloaded CSV file
            return filePath;
        } else {
            throw new Error('CSV file was not downloaded');
        }

    } catch (error) {
        console.error('Error during process:', error);
        throw error;
    } finally {
        await browser.close();
    }
};