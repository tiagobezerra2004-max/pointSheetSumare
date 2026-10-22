"use client";

import { createContext, useContext } from "react";

export type MockServiceWorkerStatus = "inactive" | "starting" | "ready" | "error";

const MockServiceWorkerStatusContext =
  createContext<MockServiceWorkerStatus>("inactive");

export function useMockServiceWorkerStatus(): MockServiceWorkerStatus {
  return useContext(MockServiceWorkerStatusContext);
}

export { MockServiceWorkerStatusContext };
