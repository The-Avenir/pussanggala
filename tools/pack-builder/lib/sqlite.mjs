// Loads node:sqlite (Node >= 22.5) while silencing only its ExperimentalWarning.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...args) {
  const text = typeof warning === "string" ? warning : warning?.message ?? "";
  const type = typeof args[0] === "string" ? args[0] : args[0]?.type;
  if ((type === "ExperimentalWarning" || warning?.name === "ExperimentalWarning") && /SQLite/i.test(text)) {
    return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

const { DatabaseSync } = await import("node:sqlite");

export { DatabaseSync };
