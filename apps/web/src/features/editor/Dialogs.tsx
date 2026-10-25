import { useState, useEffect, useMemo, type RefObject } from "react";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { Copy, Download, ArrowUpRight, Image, FileJson, Upload, Check } from "lucide-react";
import { deserializeConfig } from "@plinka/gradient-core";
import type { GradientRenderer } from "@plinka/gradient-webgl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice } from "./Controls";
import { configAtom, notificationAtom, commitAtom } from "./state";
import {
  codeSnippet,
  agentPrompt,
  download,
  exportPng,
  downloadConfig,
  type CodeFormat,
  type CodeDistribution,
} from "./export";
import {
  integrationFormatAtom,
  integrationDistributionAtom,
  integrationCopiedAtom,
  currentNameAtom,
} from "./state";
import { ShaderPreview } from "@/components/ShaderPreview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { thumbnail } from "./thumbnails";
function HighlightedCode({ code }: { code: string }) {
  const tokens = useMemo(
    () =>
      code.split(
        /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|const|export|return|function|new|type|true|false|null)\b|\b\d+(?:\.\d+)?\b)/g,
      ),
    [code],
  );
  return (
    <code>
      {tokens.map((token, index) => (
        <span
          key={index}
          className={
            /^["']/.test(token)
              ? "syntax-string"
              : /^\d/.test(token)
                ? "syntax-number"
                : /^(import|from|const|export|return|function|new|type|true|false|null)$/.test(
                      token,
                    )
                  ? "syntax-keyword"
                  : undefined
          }
        >
          {token}
        </span>
      ))}
    </code>
  );
}
export function CodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const c = useAtomValue(configAtom),
    name = useAtomValue(currentNameAtom);
  const [format, setFormat] = useAtom(integrationFormatAtom);
  const [distribution, setDistribution] = useAtom(integrationDistributionAtom);
  const [copied, setCopied] = useAtom(integrationCopiedAtom);
  const [image, setImage] = useState("");
  const notify = useSetAtom(notificationAtom);
  const code = useMemo(() => codeSnippet(c, format, distribution), [c, format, distribution]);
  const filename =
    format === "react"
      ? "GradiaBackground.tsx"
      : format === "javascript"
        ? "gradia.js"
        : "gradia.config.json";
  useEffect(() => {
    let live = true;
    if (open)
      void thumbnail(c).then(
        (src) => {
          if (live) setImage(src);
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [c, open]);
  const copy = (value: string, kind: "code" | "prompt") => {
    void navigator.clipboard.writeText(value).then(
      () => setCopied(kind),
      () => notify("clipboardError"),
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="code-dialog integration-dialog">
        <DialogHeader>
          <DialogTitle>{t("codeTitle")}</DialogTitle>
          <DialogDescription>{t("codeSub")}</DialogDescription>
        </DialogHeader>
        <div className="integration-preset">
          <ShaderPreview src={image} colors={c.colors} />
          <div>
            <span className="current-tag">{t("current")}</span>
            <strong>{name || t("untitled")}</strong>
            <p>
              {t(c.style)} ·{" "}
              {t("effectCount", { count: c.effects.filter((effect) => effect.enabled).length })} ·{" "}
              {c.loopDuration}s · {c.colors.filter((color) => color.enabled).length}{" "}
              {t("colors").toLowerCase()}
            </p>
          </div>
        </div>
        <div className="integration-controls">
          <Tabs
            value={format}
            onValueChange={(value) => {
              setFormat(String(value) as CodeFormat);
              setCopied(null);
            }}
          >
            <TabsList aria-label={t("code")}>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          {format !== "json" && (
            <Tabs
              value={distribution}
              onValueChange={(value) => {
                setDistribution(String(value) as CodeDistribution);
                setCopied(null);
              }}
            >
              <TabsList aria-label={t("distribution")}>
                <TabsTrigger value="minified">{t("minifiedJs")}</TabsTrigger>
                <TabsTrigger value="source">{t("sourceCode")}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        <p className="dialog-hint">
          {t(
            format === "json"
              ? "jsonHelp"
              : distribution === "minified"
                ? "minifiedHelp"
                : format === "react"
                  ? "reactHelp"
                  : "jsHelp",
          )}
        </p>
        <div className="code-window integration-code-window">
          <div className="code-title">
            <FileJson size={14} />
            <span className="code-filename">{filename}</span>
            <Button variant="default" size="sm" onClick={() => copy(code, "code")}>
              {copied === "code" ? <Check /> : <Copy />}
              {t(copied === "code" ? "copied" : "copy")}
            </Button>
          </div>
          <ScrollArea className="code-scroll">
            <pre tabIndex={0}>
              <HighlightedCode code={code} />
            </pre>
          </ScrollArea>
        </div>
        <div className="integration-actions">
          <a className="kit-link" href="/gradia-kit.zip" download>
            <Download size={15} />
            {t("downloadKit")}
          </a>
          <Button
            variant="outline"
            onClick={() =>
              download(
                new Blob([code], {
                  type: format === "json" ? "application/json" : "text/plain;charset=utf-8",
                }),
                filename,
              )
            }
          >
            <Download />
            {t("downloadCode")}
          </Button>
          <Button
            variant="outline"
            onClick={() => copy(agentPrompt(c, distribution, location.origin), "prompt")}
          >
            {copied === "prompt" ? <Check /> : <Copy />}
            {t(copied === "prompt" ? "copied" : "copyAgentPrompt")}
          </Button>
        </div>
        <a className="integration-docs" href="/docs/agents.md" target="_blank" rel="noreferrer">
          {t("integrationDocs")}
          <ArrowUpRight size={13} />
        </a>
      </DialogContent>
    </Dialog>
  );
}
export function ExportDialog({
  open,
  onOpenChange,
  rendererRef,
  aspectRatio,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rendererRef: RefObject<GradientRenderer | null>;
  aspectRatio: number;
}) {
  const { t } = useTranslation();
  const store = useStore();
  const c = useAtomValue(configAtom);
  const notify = useSetAtom(notificationAtom);
  const [size, setSize] = useState("1920");
  const [busy, setBusy] = useState(false);
  const ratio = aspectRatio;
  const width = Number(size),
    height = Math.round(width / ratio);
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 16384) throw new Error("large");
      const config = deserializeConfig(await file.text());
      store.set(commitAtom, config);
      onOpenChange(false);
    } catch {
      notify("invalidFile");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="export-dialog">
        <DialogHeader>
          <DialogTitle>{t("exportTitle")}</DialogTitle>
          <DialogDescription>{t("exportSub")}</DialogDescription>
        </DialogHeader>
        <div
          className="export-art"
          style={{
            background: `linear-gradient(125deg,${c.colors
              .filter((x) => x.enabled)
              .map((x) => x.color)
              .join(",")})`,
          }}
        >
          <Image size={32} />
          <span>PNG</span>
        </div>
        <div className="select-row">
          <span>{t("resolution")}</span>
          <Choice
            label={t("resolution")}
            value={size}
            onChange={setSize}
            items={[
              { value: "1280", label: "1280 px" },
              { value: "1920", label: "1920 px" },
              { value: "3840", label: "3840 px" },
            ]}
          />
        </div>
        <div className="export-meta mono">
          {width} × {height} px
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void exportPng(c, rendererRef.current?.time ?? 0, width, height)
              .then(
                () => notify("exportDone"),
                () => notify("error"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Download />
          {t(busy ? "exportBusy" : "downloadPng")}
        </Button>
        <Button variant="outline" onClick={() => downloadConfig(c)}>
          <FileJson />
          {t("downloadJson")}
        </Button>
        <label className="import-button">
          <Upload size={15} />
          {t("importJson")}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </DialogContent>
    </Dialog>
  );
}
