import { worker } from "./browser";

let workerStartPromise: ReturnType<typeof worker.start> | undefined;

export function startMockServiceWorker(): ReturnType<typeof worker.start> {
  if (worker.readyState !== 0) {
    return Promise.resolve(undefined);
  }

  if (!workerStartPromise) {
    workerStartPromise = worker
      .start({ onUnhandledFrame: "bypass" })
      .catch((error: unknown) => {
        workerStartPromise = undefined;
        throw error;
      });
  }

  return workerStartPromise;
}
