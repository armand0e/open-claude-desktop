import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function Shell(): React.JSX.Element {
  return (
    <main className="shell" aria-label="Claude Desktop shell">
      <div className="drag-region">
        <span className="wordmark">Claude</span>
      </div>
      <div className="loading" role="status" aria-live="polite">
        <span className="spinner" />
        Loading Claude…
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
