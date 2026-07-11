const EDGE_NOT_AVAILABLE = 'EDGE_NOT_AVAILABLE';

class EdgeNotAvailableError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'EdgeNotAvailableError';
    this.code = EDGE_NOT_AVAILABLE;
    this.details = options.details || {};
  }
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
    ...genericLaunchOptions,
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
  EDGE_NOT_AVAILABLE,
  EdgeNotAvailableError,
  launchEdgeBrowser,
};
