/**
 * Google OAuth — loads credentials/tokens from static project files,
 * with refresh via refresh_token (same format as Python google-auth token JSON).
 */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export const STATIC_AUTH_FILES = {
  credentials: 'credentials.json',
  driveToken: 'token.json',
  driveTokenRead: 'token_read.json',
  sheetsToken: 'token_sheet.json',
};

/** @type {Record<string, object | null>} */
const staticTokenBundles = {
  drive: null,
  driveRead: null,
  sheets: null,
};

function parseExpiryMs(expiry) {
  if (!expiry) return 0;
  const t = Date.parse(expiry);
  return Number.isNaN(t) ? 0 : t;
}

function accessTokenFromBundle(bundle) {
  if (!bundle) return null;
  return bundle.token || bundle.access_token || null;
}

function isBundleExpired(bundle, skewMs = 60_000) {
  const expiry = parseExpiryMs(bundle?.expiry);
  if (!expiry) return false;
  return Date.now() >= expiry - skewMs;
}

async function fetchJsonOptional(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function refreshTokenBundle(bundle, log = console.log) {
  if (!bundle?.refresh_token) {
    throw new Error('Token expired and no refresh_token available.');
  }
  const clientId = bundle.client_id;
  const clientSecret = bundle.client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('Token bundle missing client_id/client_secret for refresh.');
  }

  log('   [OAuth] Refreshing access token...');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: bundle.refresh_token,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  bundle.token = data.access_token;
  bundle.expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  return bundle.token;
}

async function resolveAccessToken(bundle, log) {
  if (!bundle) return null;
  let token = accessTokenFromBundle(bundle);
  if (token && !isBundleExpired(bundle)) return token;
  if (!bundle.refresh_token) return token;
  return refreshTokenBundle(bundle, log);
}

export class GoogleAuth {
  constructor() {
    this.clientId = '';
    this.clientSecret = '';
    this.credentialsLoaded = false;
    this.staticAuthReady = false;
  }

  /**
   * Load credentials.json + token.json, token_read.json, token_sheet.json from project root.
   * @param {(msg: string) => void} [log]
   */
  async loadStaticAuthFiles(log = console.log) {
    const credentials = await fetchJsonOptional(STATIC_AUTH_FILES.credentials);
    if (credentials) {
      const installed = credentials.installed || credentials.web || credentials;
      this.clientId = installed.client_id || '';
      this.clientSecret = installed.client_secret || '';
      this.credentialsLoaded = Boolean(this.clientId);
      if (this.clientId) {
        log(`Loaded OAuth client from ${STATIC_AUTH_FILES.credentials}`);
      }
    } else {
      log(`⚠️  ${STATIC_AUTH_FILES.credentials} not found — place it next to index.html`);
    }

    staticTokenBundles.drive = await fetchJsonOptional(STATIC_AUTH_FILES.driveToken);
    staticTokenBundles.driveRead = await fetchJsonOptional(STATIC_AUTH_FILES.driveTokenRead);
    staticTokenBundles.sheets = await fetchJsonOptional(STATIC_AUTH_FILES.sheetsToken);

    if (staticTokenBundles.drive) {
      log(`Loaded Drive token from ${STATIC_AUTH_FILES.driveToken}`);
    }
    if (staticTokenBundles.driveRead) {
      log(`Loaded Drive fallback token from ${STATIC_AUTH_FILES.driveTokenRead}`);
    }
    if (staticTokenBundles.sheets) {
      log(`Loaded Sheets token from ${STATIC_AUTH_FILES.sheetsToken}`);
    }

    // Prefer client_id from token files if credentials.json absent
    if (!this.clientId) {
      const src = staticTokenBundles.drive || staticTokenBundles.sheets;
      if (src?.client_id) this.clientId = src.client_id;
    }

    this.staticAuthReady = Boolean(
      this.clientId && (staticTokenBundles.drive || staticTokenBundles.driveRead || staticTokenBundles.sheets),
    );
    return this.staticAuthReady;
  }

  getAuthStatus() {
    return {
      credentials: this.credentialsLoaded,
      drive: Boolean(staticTokenBundles.drive),
      driveRead: Boolean(staticTokenBundles.driveRead),
      sheets: Boolean(staticTokenBundles.sheets),
      clientId: this.clientId ? `${this.clientId.slice(0, 20)}…` : '',
    };
  }

  async getDriveAccessToken(log = console.log) {
    const primary = staticTokenBundles.drive;
    const fallback = staticTokenBundles.driveRead;

    try {
      const token = await resolveAccessToken(primary, log);
      if (token) return token;
    } catch (e) {
      log(`Drive token refresh failed (${STATIC_AUTH_FILES.driveToken}): ${e.message}`);
    }

    if (fallback) {
      log(`Trying Drive fallback ${STATIC_AUTH_FILES.driveTokenRead}...`);
      return resolveAccessToken(fallback, log);
    }

    throw new Error(
      `No valid Drive token. Add ${STATIC_AUTH_FILES.driveToken} or ${STATIC_AUTH_FILES.driveTokenRead} next to index.html.`,
    );
  }

  async getSheetsAccessToken(log = console.log) {
    const bundle = staticTokenBundles.sheets;
    if (!bundle) {
      throw new Error(`No Sheets token. Add ${STATIC_AUTH_FILES.sheetsToken} next to index.html.`);
    }
    return resolveAccessToken(bundle, log);
  }

  async connectDrive(log = console.log) {
    const token = await this.getDriveAccessToken(log);
    log('Google Drive ready (static token).');
    return token;
  }

  async connectSheets(log = console.log) {
    const token = await this.getSheetsAccessToken(log);
    log('Google Sheets ready (static token).');
    return token;
  }

  async getAuthorizedFetch(scopeKey = 'drive', log = console.log) {
    const token = scopeKey === 'sheets'
      ? await this.getSheetsAccessToken(log)
      : await this.getDriveAccessToken(log);

    return (url, init = {}) => fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

export class GoogleSheets {
  constructor(auth) {
    this.auth = auth;
    this.spreadsheetId = '1Qc9LrE54LyDzAB1sAyK6iBJDJUbT1Y3sh9-7MNSm85M';
    this._log = console.log;
  }

  setLog(fn) {
    this._log = fn;
  }

  async api(path, { method = 'GET', body = null } = {}) {
    const token = await this.auth.getSheetsAccessToken(this._log);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = new Error(`Sheets API ${response.status}`);
      err.status = response.status;
      throw err;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async read(range, spreadsheetId = null) {
    const prev = this.spreadsheetId;
    if (spreadsheetId) this.spreadsheetId = spreadsheetId;
    try {
      const data = await this.api(`/values/${encodeURIComponent(range)}`);
      return data.values || [];
    } finally {
      if (spreadsheetId) this.spreadsheetId = prev;
    }
  }

  async append(range, rows, spreadsheetId = null) {
    const prev = this.spreadsheetId;
    if (spreadsheetId) this.spreadsheetId = spreadsheetId;
    try {
      return this.api(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: { values: rows },
      });
    } finally {
      if (spreadsheetId) this.spreadsheetId = prev;
    }
  }

  async appendToTempTab(rows) {
    return this.append('temp!A:B', rows);
  }

  async appendRows(spreadsheetId, tabName, rows) {
    const prev = this.spreadsheetId;
    this.spreadsheetId = spreadsheetId;
    try {
      return await this.append(`${tabName}!A:B`, rows);
    } finally {
      this.spreadsheetId = prev;
    }
  }
}

export function createGoogleAuth() {
  return new GoogleAuth();
}
