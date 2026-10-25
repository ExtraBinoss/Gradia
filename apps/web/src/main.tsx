import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import { LazyMotion, domAnimation } from "motion/react";
import "./i18n";
import "./styles/global.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { editorStore } from "@/features/editor/state";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={editorStore}>
      <LazyMotion features={domAnimation}>
        <TooltipProvider delay={350}>
          <App />
        </TooltipProvider>
      </LazyMotion>
    </Provider>
  </StrictMode>,
);
