import { useStore } from "jotai";
import type { ReactNode } from "react";
import type { GradientConfig } from "@plinka/gradient-core";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { commitAtom, previewAtom, hoverAtom, historyAtom } from "./state";
export function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function Choice({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue>{items.find((i) => i.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem value={i.value} key={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function useEdit() {
  const store = useStore();
  return {
    preview: (patch: Partial<GradientConfig>) => {
      store.set(hoverAtom, null);
      store.set(previewAtom, {
        ...(store.get(previewAtom) ?? store.get(historyAtom).present),
        ...patch,
      });
    },
    commit: (patch: Partial<GradientConfig>) =>
      store.set(commitAtom, {
        ...(store.get(previewAtom) ?? store.get(historyAtom).present),
        ...patch,
      }),
    finish: () => {
      const p = store.get(previewAtom);
      if (p) store.set(commitAtom, p);
    },
    cancel: () => store.set(previewAtom, null),
  };
}
