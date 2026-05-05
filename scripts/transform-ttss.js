function transformTtss(source, options = {}) {
  const rpxRatio = Number.isFinite(options.rpxRatio) ? options.rpxRatio : 0.5;

  return String(source)
    .replace(/(^|\n)page\s*\{/g, "$1body {")
    .replace(/(-?\d*\.?\d+)rpx/g, (_, value) => `${Number(value) * rpxRatio}px`);
}

module.exports = {
  transformTtss
};
