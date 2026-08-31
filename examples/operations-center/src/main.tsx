import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { Studio } from "./Studio.js";
import "./styles.css";
import "./studio.css";

createRoot(document.getElementById("root")!).render(
  new URLSearchParams(window.location.search).get("demo") === "operations" ? (
    <App />
  ) : (
    <Studio />
  ),
);
