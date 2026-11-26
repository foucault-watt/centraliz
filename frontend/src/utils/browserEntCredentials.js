const DATABASE = "centraliz-ent";
const STORE = "credentials";

export const browserEntNotice =
  "Pour protéger votre mot de passe ENT, Centraliz le mémorise uniquement dans ce navigateur. Il l’utilise pour se connecter à vos notes et à vos mails. Sur un autre navigateur, vous devrez le saisir une fois.";

export const browserEntStorageUnavailable =
  "Ce navigateur n’a pas pu mémoriser votre mot de passe. Vous devrez le saisir à nouveau.";

const openDatabase = () => new Promise((resolve, reject) => {
  const request = window.indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});

const accessStore = async (mode, operation) => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

export const readBrowserEntCredentials = async (account) => {
  if (!account) return null;
  try {
    const record = await accessStore("readonly", (store) => store.get(account));
    if (!record || record.migrationId) return null;
    const data = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: record.iv, additionalData: new TextEncoder().encode(account) },
      record.key,
      record.ciphertext,
    );
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    return null;
  }
};

export const saveBrowserEntCredentials = async (account, credentials, migrationId = null) => {
  try {
    if (!account) return false;
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(account) }, key,
      new TextEncoder().encode(JSON.stringify(credentials)),
    );
    await accessStore("readwrite", (store) => store.put({ key, iv, ciphertext, migrationId }, account));
    return true;
  } catch {
    return false;
  }
};

export const confirmBrowserEntMigration = async (account, migrationId) => {
  try {
    await accessStore("readwrite", (store) => {
      const request = store.get(account);
      request.onsuccess = () => {
        const record = request.result;
        if (record?.migrationId === migrationId) {
          store.put({ ...record, migrationId: null }, account);
        }
      };
      return request;
    });
  } catch {
    // A later page load can retry the local confirmation with the server receipt.
  }
};
