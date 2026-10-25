import { ScrollArea as Primitive } from "@base-ui/react/scroll-area";
import type { Ref } from "react";
import { cn } from "cn";

export function ScrollArea({
  children,
  className,
  viewportClassName,
  viewportRef,
  orientation = "vertical",
  ...props
}: Primitive.Root.Props & {
  viewportClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <Primitive.Root
      data-slot="scroll-area"
      className={cn("studio-scroll-area", className)}
      {...props}
    >
      <Primitive.Viewport
        data-slot="scroll-area-viewport"
        className={viewportClassName}
        ref={viewportRef}
      >
        <Primitive.Content data-slot="scroll-area-content">{children}</Primitive.Content>
      </Primitive.Viewport>
      <Primitive.Scrollbar data-slot="scroll-area-scrollbar" orientation={orientation}>
        <Primitive.Thumb data-slot="scroll-area-thumb" />
      </Primitive.Scrollbar>
      <Primitive.Corner />
    </Primitive.Root>
  );
}
