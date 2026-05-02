const puppeteer = require("puppeteer");
const fs = require("fs");
const os = require("os");
const path = require("path");

const AURION_HOST = "webaurion.centralelille.fr";
const PUPPETEER_NETWORK_DEBUG = /^true$/i.test(
  process.env.PUPPETEER_NETWORK_DEBUG || "",
);

const maskSensitiveValue = (value) => {
  const raw = String(value || "");
  if (raw.length <= 8) {
    return `${raw.slice(0, 2)}***`;
  }

  return `${raw.slice(0, 4)}***${raw.slice(-2)}`;
};

const sanitizePostData = (postData) => {
  if (!postData) {
    return null;
  }

  return String(postData)
    .replace(/(password=)([^&]+)/gi, (_, prefix) => `${prefix}***`)
    .replace(/(username=)([^&]+)/gi, (_, prefix, value) => {
      try {
        return `${prefix}${maskSensitiveValue(decodeURIComponent(value))}`;
      } catch (error) {
        return `${prefix}***`;
      }
    });
};

const summarizeHeaders = (headers = {}) => {
  const keysToKeep = [
    "content-type",
    "content-disposition",
    "location",
    "faces-request",
    "x-requested-with",
  ];

  return Object.fromEntries(
    Object.entries(headers).filter(([key]) =>
      keysToKeep.includes(String(key).toLowerCase()),
    ),
  );
};

const shouldLogRequest = (url, headers = {}) => {
  return (
    String(url || "").includes(AURION_HOST) ||
    Boolean(headers["content-disposition"]) ||
    Boolean(headers["Content-Disposition"])
  );
};

const attachNetworkDebug = async (page) => {
  if (!PUPPETEER_NETWORK_DEBUG) {
    return page.target().createCDPSession();
  }

  const cdp = await page.target().createCDPSession();
  await cdp.send("Network.enable");

  page.on("request", (request) => {
    const url = request.url();
    if (!shouldLogRequest(url)) {
      return;
    }

    console.log("[Puppeteer][request]", {
      method: request.method(),
      resourceType: request.resourceType(),
      url,
      postData: sanitizePostData(request.postData()),
      headers: summarizeHeaders(request.headers()),
    });
  });

  page.on("response", async (response) => {
    const url = response.url();
    const headers = response.headers();
    if (!shouldLogRequest(url, headers)) {
      return;
    }

    console.log("[Puppeteer][response]", {
      status: response.status(),
      url,
      headers: summarizeHeaders(headers),
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!shouldLogRequest(url)) {
      return;
    }

    console.warn("[Puppeteer][requestfailed]", {
      method: request.method(),
      url,
      failure: request.failure()?.errorText || "unknown",
    });
  });

  cdp.on("Page.downloadWillBegin", (event) => {
    console.log("[Puppeteer][downloadWillBegin]", {
      url: event.url,
      suggestedFilename: event.suggestedFilename,
    });
  });

  cdp.on("Page.downloadProgress", (event) => {
    console.log("[Puppeteer][downloadProgress]", {
      state: event.state,
      receivedBytes: event.receivedBytes,
      totalBytes: event.totalBytes,
    });
  });

  return cdp;
};

exports.downloadCSV = async (username, password, options = {}) => {
  console.log("Launching soon...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
  });

  console.log("Launching browser...");

  const page = await browser.newPage();
  const requestId = options.requestId || Date.now().toString(36);
  const downloadPath = fs.mkdtempSync(
    path.join(os.tmpdir(), "centraliz-notes-"),
  );

  console.log("Launching new page...");

  try {
    // Set up download behavior
    const cdp = await attachNetworkDebug(page);
    await cdp.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    // Logging in and navigating the UI
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    await page.goto("https://webaurion.centralelille.fr/", {
      waitUntil: "networkidle2",
    });
    console.log("Page loaded");

    await page.type("#username", username);
    await page.type("#password", password);
    console.log("Credentials entered");

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.evaluate(() => document.querySelector("#formulaireSpring").submit()),
    ]);
    console.log("Logged in successfully");

    // Wait for sidebar and click through to export the CSV
    try {
      await page.waitForSelector("#form\\:sidebar", {
        visible: true,
        timeout: 10000,
      });
    } catch (error) {
      const authError = new Error(
        "Impossible de se connecter a WebAurion avec ces identifiants",
      );
      authError.code = "ENT_AUTH_FAILED";
      authError.details = {
        step: "wait_sidebar_after_login",
        originalMessage: error.message,
      };
      throw authError;
    }
    console.log("Sidebar loaded");

    const resultSelector =
      "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null > a";
    await page.waitForSelector(resultSelector, {
      visible: true,
      timeout: 10000,
    });
    await page.click(resultSelector);
    console.log("Clicked on the result element");

    const iteemSelector =
      "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null.enfants-entierement-charges > ul > li > a";
    await page.waitForSelector(iteemSelector, {
      visible: true,
      timeout: 10000,
    });
    await page.click(iteemSelector);
    console.log("Clicked on the iteem element");

    const notesSelector =
      "#form\\:sidebar > div > div.ui-slidemenu-content > ul > li.ui-widget.ui-menuitem.ui-corner-all.ui-menu-parent.submenu_44413.null.enfants-entierement-charges > ul > li > ul > li:nth-child(1) > a";
    await page.waitForSelector(notesSelector, {
      visible: true,
      timeout: 10000,
    });
    await page.click(notesSelector);
    console.log("Clicked on the notes element");

    const exportSelector = "#form\\:exportButton";
    await page.waitForSelector(exportSelector, {
      visible: true,
      timeout: 10000,
    });
    await page.click(exportSelector);
    console.log("Clicked on the export element");

    const csvSelector = "#form\\:j_idt158 > ul > li:nth-child(3) > a";
    await page.waitForSelector(csvSelector, { visible: true, timeout: 10000 });
    await page.click(csvSelector);
    console.log("Clicked on the csv element");
    if (PUPPETEER_NETWORK_DEBUG) {
      console.log("[Puppeteer] Current page after CSV click:", page.url());
    }

    // Wait for the file to be downloaded
    const waitForFileDownload = async (downloadPath) => {
      return new Promise((resolve, reject) => {
        const checkInterval = 500;
        const timeout = 30000; // Timeout after 30 seconds
        let timeElapsed = 0;

        const intervalId = setInterval(() => {
          const files = fs
            .readdirSync(downloadPath)
            .filter((file) => file.endsWith(".csv"));
          const foundFile = files[0];

          if (foundFile) {
            clearInterval(intervalId);
            resolve(path.resolve(downloadPath, foundFile));
          }

          timeElapsed += checkInterval;
          if (timeElapsed >= timeout) {
            clearInterval(intervalId);
            reject(new Error("File download timed out"));
          }
        }, checkInterval);
      });
    };

    const csvFile = await waitForFileDownload(downloadPath);

    if (csvFile) {
      console.log("CSV downloaded:", csvFile);
      const oldPath = csvFile;
      const safeUsername = String(username || "unknown")
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "_");
      const newFileName = `${safeUsername}_notes_${requestId}.csv`;
      const newPath = path.resolve(downloadPath, newFileName);

      // Remove existing file if it exists
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }

      // Rename the file
      fs.renameSync(oldPath, newPath);
      console.log("CSV renamed to:", newFileName);

      return newPath;
    } else {
      throw new Error("CSV file was not downloaded");
    }
  } catch (error) {
    console.error("Error during process:", error);
    throw error;
  } finally {
    await browser.close();
  }
};
