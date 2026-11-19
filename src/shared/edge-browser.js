const EDGE_NOT_AVAILABLE = 'EDGE_NOT_AVAILABLE';

// Lightweight flags applied by default in headless mode to trim Edge startup and
// browser.close() teardown overhead without changing CSS layout or text metrics.
const DEFAULT_HEADLESS_EDGE_ARGS = Object.freeze([
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--no-first-run',
  '--disable-sync',
  '--disable-default-apps',
  '--disable-component-update',
]);

class EdgeNotAvailableError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'EdgeNotAvailableError';
    this.code = EDGE_NOT_AVAILABLE;
    this.details = options.details || {};
  }
}

function mergeHeadlessArgs(genericLaunchOptions) {
  if (genericLaunchOptions.headless === false) return genericLaunchOptions;
  const userArgs = Array.isArray(genericLaunchOptions.args) ? genericLaunchOptions.args : [];
  const merged = [];
  const seen = new Set();
  for (const flag of [...DEFAULT_HEADLESS_EDGE_ARGS, ...userArgs]) {
    if (!seen.has(flag)) {
      seen.add(flag);
      merged.push(flag);
    }
  }
  return {
    ...genericLaunchOptions,
    args: merged,
  };
}

async function launchEdgeBrowser(options = {}) {
  const playwright = options.playwright || require('playwright');
  const env = options.env || process.env;
  const executablePath = String(env.HTML_INDESIGN_BROWSER_EXECUTABLE || '').trim();
  const browserSelection = executablePath
    ? { executablePath }
    : { channel: 'msedge' };
  const {
    channel: ignoredChannel,
    executablePath: ignoredExecutablePath,
    ...genericLaunchOptions
  } = options.launchOptions || {};
  const launchOptions = {
    ...mergeHeadlessArgs(genericLaunchOptions),
    ...browserSelection,
  };

  try {
    return await playwright.chromium.launch(launchOptions);
  } catch (cause) {
    const selection = executablePath
      ? `configured Edge executable "${executablePath}"`
      : 'Microsoft Edge channel "msedge"';
    throw new EdgeNotAvailableError(
      `${EDGE_NOT_AVAILABLE}: unable to launch ${selection}`,
      {
        cause,
        details: executablePath ? { executablePath } : { channel: 'msedge' },
      },
    );
  }
}

module.exports = {
  DEFAULT_HEADLESS_EDGE_ARGS,
  EDGE_NOT_AVAILABLE,
  EdgeNotAvailableError,
  launchEdgeBrowser,
};
