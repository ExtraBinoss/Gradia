import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Monitor } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice } from "./Controls";
export function GlobalSettings({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("gradient-theme") || "system";
    } catch {
      return "system";
    }
  });
  const initialized = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const media = matchMedia("(prefers-color-scheme:dark)");
    const apply = () => {
      const root = document.documentElement;
      const dark = theme === "dark" || (theme === "system" && media.matches);
      if (initialized.current && root.classList.contains("dark") !== dark) {
        root.dataset.themeTransition = "true";
        clearTimeout(timer);
        timer = setTimeout(() => delete root.dataset.themeTransition, 450);
      }
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      root.style.colorScheme = dark ? "dark" : "light";
      document
        .getElementById("active-favicon")
        ?.setAttribute("href", dark ? "/favicon-dark.svg" : "/favicon-light.svg");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#15161b" : "#f7f8fa");
      initialized.current = true;
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      clearTimeout(timer);
      delete document.documentElement.dataset.themeTransition;
    };
  }, [theme]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="global-settings-dialog">
        <DialogTitle>{t("globalSettings")}</DialogTitle>
        <DialogDescription>{t("globalSettingsDescription")}</DialogDescription>
        <div className="global-setting-row">
          <span>{t("theme")}</span>
          <Tabs
            value={theme}
            onValueChange={(value) => {
              const next = String(value);
              setTheme(next);
              try {
                localStorage.setItem("gradient-theme", next);
              } catch {
                /* Session preference. */
              }
            }}
          >
            <TabsList aria-label={t("theme")}>
              <TabsTrigger value="system">
                <Monitor size={14} />
                {t("system")}
              </TabsTrigger>
              <TabsTrigger value="light">
                <Sun size={14} />
                {t("light")}
              </TabsTrigger>
              <TabsTrigger value="dark">
                <Moon size={14} />
                {t("dark")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="global-setting-row">
          <span>{t("language")}</span>
          <Choice
            label={t("language")}
            value={i18n.language.startsWith("fr") ? "fr" : "en"}
            onChange={(language) => {
              void i18n.changeLanguage(language);
              document.documentElement.lang = language;
              try {
                localStorage.setItem("gradient-language", language);
              } catch {
                /* Session preference. */
              }
            }}
            items={[
              { label: "Français", value: "fr" },
              { label: "English", value: "en" },
            ]}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
