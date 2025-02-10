let lastLog = Date.now();
let log = console.log;

console.log = function () {
  if (!window.__CONFIG__?.debug) {
    return;
  }

  if (log && arguments.length) {
    const args = Array.from(arguments);
    if (typeof args[0] === "string") {
      args[0] += ` [${Date.now() - lastLog}ms]`;
    }
    log.apply(console, args);
    lastLog = Date.now();
  }
};
