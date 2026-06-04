import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { applyGpuTierToDocument } from "./lib/gpu/quality";
import { installGlobalErrorHandlers } from "./lib/observability/globalErrors";

applyGpuTierToDocument();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
