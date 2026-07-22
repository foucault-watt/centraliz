const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const { parseStringPromise } = require("xml2js");

const DEFAULT_BASE_URL =
  process.env.AURION_BASE_URL || "https://webaurion.centralelille.fr";
const AURION_HTTP_DEBUG = /^true$/i.test(process.env.AURION_HTTP_DEBUG || "");

const DEFAULT_ENTRY_PATH = "/";
const DEFAULT_LOGIN_PAGE_PATH = "/faces/Login.xhtml";
const DEFAULT_MAIN_MENU_PATH = "/faces/MainMenuPage.xhtml";
const DEFAULT_CHOIX_DONNEE_PATH = "/faces/ChoixDonnee.xhtml";
const DEFAULT_NOTATION_PAGE_PATH = "/faces/LearnerNotationListPage.xhtml";
const CENTRAL_RESULTS_SUBMENU_ID = "submenu_44413";
const CENTRAL_ITEEM_SUBMENU_ID = "submenu_3049765";
const CENTRAL_NOTES_SIDEBAR_ID = "1_0_0";
const CENTRAL_CSV_EXPORT_TRIGGER = "form:j_idt168";

const HTML_ENTITY_MAP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

const createHttpError = (message, details = null) => {
  const error = new Error(message);
  error.details = details;
  return error;
};

const logHttpTrace = (stage, details = null) => {
  if (!AURION_HTTP_DEBUG) {
    return;
  }
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[AurionHttpService] ${stage}${suffix}`);
};

const normalizeBaseUrl = (baseUrl = DEFAULT_BASE_URL) =>
  String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (match) => HTML_ENTITY_MAP[match])
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });

const stripTags = (value) =>
  decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveRelativePath = (basePath, nextPath) => {
  const candidate = String(nextPath || "").trim();
  if (!candidate) {
    return basePath;
  }

  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate);
    return `${url.pathname}${url.search || ""}`;
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  const base = new URL(basePath, "https://placeholder.local");
  return new URL(candidate, base).pathname;
};

const extractFormHtml = (html) => {
  const exactMatch = /<form\b[^>]*id=["']formulaireSpring["'][^>]*>([\s\S]*?)<\/form>/i.exec(
    html,
  );
  if (exactMatch) {
    return exactMatch[0];
  }

  const fallbackMatch = /<form\b[\s\S]*?<\/form>/i.exec(html);
  return fallbackMatch?.[0] || "";
};

const extractLoginForm = (html, currentPath) => {
  const formHtml = extractFormHtml(html);
  if (!formHtml) {
    throw createHttpError("Formulaire de login Aurion introuvable");
  }

  return extractFormStateFromHtml(formHtml, currentPath);
};

const extractFormStateFromHtml = (html, currentPath, formId = "form") => {
  const formPattern = new RegExp(
    `<form\\b[^>]*id=["']${escapeRegExp(formId)}["'][^>]*>([\\s\\S]*?)<\\/form>`,
    "i",
  );
  const scopedMatch = formPattern.exec(html);
  const formHtml = scopedMatch?.[0] || html;

  if (!formHtml) {
    throw createHttpError("Formulaire Aurion introuvable", {
      formId,
    });
  }

  const actionMatch = /<form\b[^>]*action=["']([^"']*)["']/i.exec(formHtml);
  const action = resolveRelativePath(
    currentPath,
    decodeHtmlEntities(actionMatch?.[1] || currentPath),
  );

  const fields = {};
  const inputMatches = formHtml.matchAll(/<input\b([^>]*)>/gi);

  for (const inputMatch of inputMatches) {
    const attributes = inputMatch[1] || "";
    const nameMatch = new RegExp(`\\bname=["']([^"']+)["']`, "i").exec(
      attributes,
    );
    if (!nameMatch?.[1]) {
      continue;
    }

    const valueMatch = new RegExp(`\\bvalue=["']([^"']*)["']`, "i").exec(
      attributes,
    );
    fields[decodeHtmlEntities(nameMatch[1])] = decodeHtmlEntities(
      valueMatch?.[1] || "",
    );
  }

  return {
    action,
    fields,
    fieldNames: Object.keys(fields),
    formId,
  };
};

const extractViewState = (html) => {
  const match = /name=["']javax\.faces\.ViewState["'][^>]*value=["']([^"']+)["']/i.exec(
    html,
  );

  if (!match?.[1]) {
    throw createHttpError("ViewState introuvable dans la page Aurion");
  }

  return decodeHtmlEntities(match[1]);
};

const extractUpdatedFragment = (partialResponse, acceptedIds = []) => {
  const updates = partialResponse?.["partial-response"]?.changes?.[0]?.update;
  if (!Array.isArray(updates)) {
    return "";
  }

  const ids = new Set(acceptedIds);
  const matchingUpdate = updates.find((update) => ids.has(update?.$?.id));
  if (!matchingUpdate) {
    return "";
  }

  return matchingUpdate._ || "";
};

const buildAxiosClient = (baseUrl) => {
  const jar = new CookieJar();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeout = Number.parseInt(
    process.env.AURION_HTTP_TIMEOUT_MS || "15000",
    10,
  );

  const client = wrapper(
    axios.create({
      baseURL: normalizedBaseUrl,
      jar,
      withCredentials: true,
      maxRedirects: 0,
      timeout,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent":
          process.env.AURION_HTTP_USER_AGENT ||
          "centraliz/1.0 (+notes-http-strategy)",
      },
    }),
  );

  logHttpTrace("client_created", {
    baseUrl: normalizedBaseUrl,
    timeout,
  });

  return { client, jar };
};

const openLoginPage = async (client) => {
  logHttpTrace("login_page_load_started", {
    paths: [DEFAULT_ENTRY_PATH, DEFAULT_LOGIN_PAGE_PATH],
  });

  const primaryResponse = await client.get(DEFAULT_ENTRY_PATH);
  logHttpTrace("login_page_primary_response", {
    status: primaryResponse.status,
    location: primaryResponse.headers?.location || null,
    contentLength:
      typeof primaryResponse.data === "string" ? primaryResponse.data.length : 0,
  });

  if (primaryResponse.status === 200 && typeof primaryResponse.data === "string") {
    return {
      html: primaryResponse.data,
      path: DEFAULT_ENTRY_PATH,
    };
  }

  const redirectedPath = primaryResponse.headers?.location
    ? resolveRelativePath(DEFAULT_ENTRY_PATH, primaryResponse.headers.location)
    : DEFAULT_LOGIN_PAGE_PATH;

  const loginResponse = await client.get(redirectedPath);
  logHttpTrace("login_page_fallback_response", {
    status: loginResponse.status,
    path: redirectedPath,
    contentLength:
      typeof loginResponse.data === "string" ? loginResponse.data.length : 0,
  });

  if (loginResponse.status !== 200 || typeof loginResponse.data !== "string") {
    throw createHttpError("Page de login Aurion inaccessible", {
      status: loginResponse.status,
      location: loginResponse.headers?.location || null,
    });
  }

  return {
    html: loginResponse.data,
    path: redirectedPath,
  };
};

const login = async (client, username, password) => {
  logHttpTrace("login_started", {
    username,
    passwordLength: String(password || "").length,
  });

  const loginPage = await openLoginPage(client);
  const loginForm = extractLoginForm(loginPage.html, loginPage.path);

  logHttpTrace("login_form_extracted", {
    action: loginForm.action,
    fieldNames: loginForm.fieldNames,
  });

  const payloadFields = {
    ...loginForm.fields,
    username,
    password,
  };

  if (!("username" in payloadFields)) {
    payloadFields.username = username;
  }

  if (!("password" in payloadFields)) {
    payloadFields.password = password;
  }

  const payload = new URLSearchParams(payloadFields);

  const response = await client.post(loginForm.action, payload.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${normalizeBaseUrl(DEFAULT_BASE_URL)}${loginPage.path}`,
    },
  });

  logHttpTrace("login_response", {
    status: response.status,
    location: response.headers?.location || null,
    setCookieCount: Array.isArray(response.headers?.["set-cookie"])
      ? response.headers["set-cookie"].length
      : 0,
  });

  if (response.status !== 302 && response.status !== 303) {
    const responseHtml =
      typeof response.data === "string" ? response.data : "";
    const stillOnLoginPage =
      /formulaireSpring/i.test(responseHtml) || /Login\.xhtml/i.test(responseHtml);

    throw createHttpError("Authentification Aurion invalide", {
      status: response.status,
      stillOnLoginPage,
      location: response.headers?.location || null,
    });
  }

  return {
    redirectLocation: response.headers?.location || null,
  };
};

const loadNotationPage = async (client) => {
  logHttpTrace("notation_page_load_started", {
    path: DEFAULT_NOTATION_PAGE_PATH,
  });
  const response = await client.get(DEFAULT_NOTATION_PAGE_PATH);
  logHttpTrace("notation_page_load_response", {
    status: response.status,
    location: response.headers?.location || null,
    contentLength:
      typeof response.data === "string" ? response.data.length : null,
    contentType: response.headers?.["content-type"] || null,
  });
  if (response.status !== 200 || typeof response.data !== "string") {
    throw createHttpError("Page des notes Aurion inaccessible", {
      status: response.status,
      location: response.headers?.location || null,
    });
  }

  return response.data;
};

const loadMainMenuPage = async (client) => {
  logHttpTrace("main_menu_load_started", {
    path: DEFAULT_MAIN_MENU_PATH,
  });

  const response = await client.get(DEFAULT_MAIN_MENU_PATH);
  logHttpTrace("main_menu_load_response", {
    status: response.status,
    location: response.headers?.location || null,
    contentLength:
      typeof response.data === "string" ? response.data.length : null,
  });

  if (response.status !== 200 || typeof response.data !== "string") {
    throw createHttpError("Page menu Aurion inaccessible", {
      status: response.status,
      location: response.headers?.location || null,
    });
  }

  return response.data;
};

const extractViewStateFromPartialResponse = (partialResponse) => {
  const updates = partialResponse?.["partial-response"]?.changes?.[0]?.update;
  if (!Array.isArray(updates)) {
    return null;
  }

  const viewStateUpdate = updates.find((update) =>
    String(update?.$?.id || "").includes("javax.faces.ViewState"),
  );

  return viewStateUpdate?._ || null;
};

const openSidebarSubmenu = async (client, formState, submenuId) => {
  logHttpTrace("submenu_open_started", {
    submenuId,
    action: formState.action,
  });

  const payload = new URLSearchParams({
    ...formState.fields,
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": "form:j_idt52",
    "javax.faces.partial.execute": "form:j_idt52",
    "javax.faces.partial.render": "form:sidebar",
    "form:j_idt52": "form:j_idt52",
    "webscolaapp.Sidebar.ID_SUBMENU": submenuId,
    form: "form",
  });

  const response = await client.post(formState.action, payload.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Faces-Request": "partial/ajax",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  logHttpTrace("submenu_open_response", {
    submenuId,
    status: response.status,
    contentLength:
      typeof response.data === "string" ? response.data.length : null,
  });

  if (response.status !== 200 || typeof response.data !== "string") {
    throw createHttpError("Ouverture de sous-menu Aurion invalide", {
      status: response.status,
      submenuId,
    });
  }

  const parsedXml = await parseStringPromise(response.data, {
    explicitArray: true,
    trim: false,
  });
  const nextViewState = extractViewStateFromPartialResponse(parsedXml);

  if (nextViewState) {
    formState.fields["javax.faces.ViewState"] = nextViewState;
  }

  return formState;
};

const openNotesPageFromMainMenu = async (client, formState) => {
  logHttpTrace("notes_page_open_started", {
    sidebarMenuId: CENTRAL_NOTES_SIDEBAR_ID,
    action: formState.action,
  });

  const payload = new URLSearchParams({
    ...formState.fields,
    "form:sidebar": "form:sidebar",
    "form:sidebar_menuid": CENTRAL_NOTES_SIDEBAR_ID,
  });

  const response = await client.post(formState.action, payload.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  logHttpTrace("notes_page_open_response", {
    status: response.status,
    location: response.headers?.location || null,
  });

  if (response.status !== 302 && response.status !== 303) {
    throw createHttpError("Redirection vers la page des notes introuvable", {
      status: response.status,
      location: response.headers?.location || null,
    });
  }

  const targetPath = resolveRelativePath(
    formState.action,
    response.headers?.location || DEFAULT_CHOIX_DONNEE_PATH,
  );
  const targetResponse = await client.get(targetPath);

  logHttpTrace("notes_page_target_response", {
    status: targetResponse.status,
    path: targetPath,
    contentLength:
      typeof targetResponse.data === "string" ? targetResponse.data.length : 0,
  });

  if (targetResponse.status !== 200 || typeof targetResponse.data !== "string") {
    throw createHttpError("Chargement de la page ChoixDonnee invalide", {
      status: targetResponse.status,
      path: targetPath,
    });
  }

  return {
    html: targetResponse.data,
    path: targetPath,
  };
};

const exportNotesCsv = async (client, formState) => {
  logHttpTrace("csv_export_started", {
    action: formState.action,
    trigger: CENTRAL_CSV_EXPORT_TRIGGER,
  });

  const payload = new URLSearchParams({
    ...formState.fields,
    [CENTRAL_CSV_EXPORT_TRIGGER]: CENTRAL_CSV_EXPORT_TRIGGER,
  });

  const response = await client.post(formState.action, payload.toString(), {
    responseType: "arraybuffer",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const headers = response.headers || {};
  logHttpTrace("csv_export_response", {
    status: response.status,
    contentType: headers["content-type"] || null,
    contentDisposition: headers["content-disposition"] || null,
    bytes: response.data?.byteLength || response.data?.length || 0,
  });

  if (response.status !== 200 || !response.data) {
    throw createHttpError("Téléchargement CSV Aurion invalide", {
      status: response.status,
      contentType: headers["content-type"] || null,
    });
  }

  return Buffer.from(response.data).toString("utf-8");
};

const fetchNotationTable = async (client, viewState) => {
  logHttpTrace("partial_table_request_started", {
    path: DEFAULT_NOTATION_PAGE_PATH,
    viewStateLength: String(viewState || "").length,
  });
  const formData = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": "form:dataTableFavori",
    "javax.faces.partial.execute": "form:dataTableFavori",
    "javax.faces.partial.render": "form:dataTableFavori",
    "form:dataTableFavori": "form:dataTableFavori",
    "form:dataTableFavori_sorting": "true",
    "form:dataTableFavori_skipChildren": "true",
    "form:dataTableFavori_encodeFeature": "true",
    "form:dataTableFavori_sortKey": "form:dataTableFavori:j_idt113",
    "form:dataTableFavori_sortDir": "-1",
    form: "form",
    "javax.faces.ViewState": viewState,
  });

  const response = await client.post(
    DEFAULT_NOTATION_PAGE_PATH,
    formData.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Faces-Request": "partial/ajax",
      },
    },
  );

  logHttpTrace("partial_table_request_response", {
    status: response.status,
    contentLength:
      typeof response.data === "string" ? response.data.length : null,
    contentType: response.headers?.["content-type"] || null,
  });

  if (response.status !== 200 || typeof response.data !== "string") {
    throw createHttpError("Requete partielle des notes Aurion invalide", {
      status: response.status,
    });
  }

  const parsedXml = await parseStringPromise(response.data, {
    explicitArray: true,
    trim: false,
  });

  const updateIds =
    parsedXml?.["partial-response"]?.changes?.[0]?.update?.map(
      (update) => update?.$?.id || null,
    ) || [];
  logHttpTrace("partial_table_xml_parsed", {
    updateIds,
  });

  const htmlFragment = extractUpdatedFragment(parsedXml, [
    "form:dataTableFavori",
    "form:j_idt193",
  ]);

  if (!htmlFragment) {
    throw createHttpError("Tableau des notes introuvable dans la reponse JSF");
  }

  logHttpTrace("partial_table_fragment_extracted", {
    fragmentLength: htmlFragment.length,
  });

  return htmlFragment;
};

const parseNotationRows = (tableHtml) => {
  logHttpTrace("table_row_parse_started", {
    fragmentLength: String(tableHtml || "").length,
  });
  const rows = [];
  const rowMatches = tableHtml.matchAll(
    /<tr\b[^>]*role=["']row["'][^>]*>([\s\S]*?)<\/tr>/gi,
  );

  for (const rowMatch of rowMatches) {
    const cells = [];
    const cellMatches = rowMatch[1].matchAll(
      /<td\b[^>]*role=["']gridcell["'][^>]*>([\s\S]*?)<\/td>/gi,
    );

    for (const cellMatch of cellMatches) {
      cells.push(stripTags(cellMatch[1]));
    }

    if (!cells.length) {
      continue;
    }

    rows.push({
      date: cells[0] || "",
      code: cells[1] || "",
      name: cells[2] || "",
      note: cells[3] || "",
      absenceReason: cells[4] || "",
      comments: cells[5] || "",
      teachers: cells[6]
        ? cells[6]
            .split(/\s*,\s*/g)
            .map((teacher) => teacher.trim())
            .filter(Boolean)
        : [],
    });
  }

  logHttpTrace("table_row_parse_completed", {
    rowCount: rows.length,
    sample: rows.slice(0, 2).map((row) => ({
      date: row.date,
      code: row.code,
      name: row.name,
      note: row.note,
    })),
  });

  return rows;
};

const fetchNotations = async (username, password, options = {}) => {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
  logHttpTrace("fetch_notations_started", {
    baseUrl,
    username,
  });
  const { client } = buildAxiosClient(baseUrl);

  try {
    await login(client, username, password);

    const notationPageHtml = await loadNotationPage(client);
    logHttpTrace("notation_page_received", {
      htmlLength: notationPageHtml.length,
      containsViewState: /javax\.faces\.ViewState/i.test(notationPageHtml),
      containsTableKeyword: /dataTableFavori/i.test(notationPageHtml),
    });

    const viewState = extractViewState(notationPageHtml);
    logHttpTrace("viewstate_extracted", {
      viewStateLength: viewState.length,
      viewStatePreview: `${viewState}`.slice(0, 24),
    });

    const tableHtml = await fetchNotationTable(client, viewState);
    const rows = parseNotationRows(tableHtml);

    if (!rows.length) {
      throw createHttpError("Aucune note extraite depuis la table Aurion", {
        baseUrl,
      });
    }

    const durationMs = Date.now() - startedAt;
    logHttpTrace("fetch_notations_completed", {
      baseUrl,
      rowCount: rows.length,
      durationMs,
    });

    return {
      baseUrl,
      rows,
      diagnostics: {
        rowCount: rows.length,
        strategy: "aurion_http_notations",
        durationMs,
      },
    };
  } catch (error) {
    logHttpTrace("fetch_notations_failed", {
      baseUrl,
      username,
      durationMs: Date.now() - startedAt,
      error: error.message,
      ...(error.details || {}),
    });
    throw error;
  }
};

const downloadNotesCsv = async (username, password, options = {}) => {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
  logHttpTrace("download_csv_started", {
    baseUrl,
    username,
  });
  const { client } = buildAxiosClient(baseUrl);

  try {
    await login(client, username, password);

    const mainMenuHtml = await loadMainMenuPage(client);
    let mainMenuFormState = extractFormStateFromHtml(
      mainMenuHtml,
      DEFAULT_MAIN_MENU_PATH,
      "form",
    );

    logHttpTrace("main_menu_form_extracted", {
      action: mainMenuFormState.action,
      fieldNames: mainMenuFormState.fieldNames,
    });

    mainMenuFormState = await openSidebarSubmenu(
      client,
      mainMenuFormState,
      CENTRAL_RESULTS_SUBMENU_ID,
    );
    mainMenuFormState = await openSidebarSubmenu(
      client,
      mainMenuFormState,
      CENTRAL_ITEEM_SUBMENU_ID,
    );

    const notesPage = await openNotesPageFromMainMenu(client, mainMenuFormState);
    const notesFormState = extractFormStateFromHtml(
      notesPage.html,
      notesPage.path,
      "form",
    );

    logHttpTrace("notes_form_extracted", {
      action: notesFormState.action,
      fieldNames: notesFormState.fieldNames.slice(0, 20),
      fieldCount: notesFormState.fieldNames.length,
    });

    const rawCsv = await exportNotesCsv(client, notesFormState);
    const durationMs = Date.now() - startedAt;

    logHttpTrace("download_csv_completed", {
      durationMs,
      bytes: Buffer.byteLength(rawCsv, "utf-8"),
    });

    return {
      rawCsv,
      diagnostics: {
        strategy: "aurion_http_csv_export",
        durationMs,
        bytes: Buffer.byteLength(rawCsv, "utf-8"),
      },
    };
  } catch (error) {
    logHttpTrace("download_csv_failed", {
      baseUrl,
      username,
      durationMs: Date.now() - startedAt,
      error: error.message,
      ...(error.details || {}),
    });
    throw error;
  }
};

module.exports = {
  downloadNotesCsv,
  fetchNotations,
};
