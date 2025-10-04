import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./devkit/ErrorBoundary";

const isDev = new URLSearchParams(window.location.search).has("dev");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary dev={isDev}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
