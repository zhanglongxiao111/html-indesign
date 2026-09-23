module.exports = {
  ...require('./source-package'),
  ...require('./entry-writer'),
  writeRevealPresentation: require('./reveal-presentation').writeRevealPresentation,
  ...require('./lint'),
};
