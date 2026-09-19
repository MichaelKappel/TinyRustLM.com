// Shares one cancellation/deadline owner between bounded browser downloads.
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TinyRustLMOperationLifetime = api;
}(typeof globalThis === "object" ? globalThis : this, function (root) {
  "use strict";

  // Callers validate their signal/budget and supply errors from their own public contract.
  function create(options) {
    if (!root || typeof root.AbortController !== "function" ||
        typeof root.setTimeout !== "function" || typeof root.clearTimeout !== "function") {
      throw options.optionsError;
    }
    const controller = new root.AbortController();
    let failure = null;
    let rejectStopped;
    const stopped = new Promise((_resolve, rejectPromise) => { rejectStopped = rejectPromise; });
    // A pre-aborted caller can stop before the first wait attaches its race.
    stopped.catch(() => {});
    // Retain the first reason when cancellation and the deadline race.
    function stop(error) {
      if (failure) return;
      failure = error;
      controller.abort(failure);
      rejectStopped(failure);
    }
    const onAbort = () => stop(options.abortError);
    if (options.signal) {
      options.signal.addEventListener("abort", onAbort, { once: true });
      if (options.signal.aborted) onAbort();
    }
    const timer = root.setTimeout(() => stop(options.timeoutError), options.timeoutMilliseconds);
    return Object.freeze({
      signal: controller.signal,
      // Bound even uncooperative dependencies, and reject their late completion.
      async wait(action) {
        if (failure) throw failure;
        const result = await Promise.race([Promise.resolve().then(() => {
          if (failure) throw failure;
          return action();
        }), stopped]);
        if (failure) throw failure;
        return result;
      },
      // Release resources without changing the caller's success or failure verdict.
      dispose(error) {
        root.clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener("abort", onAbort);
        if (error && !controller.signal.aborted) controller.abort(error);
      }
    });
  }

  return Object.freeze({ create });
}));
