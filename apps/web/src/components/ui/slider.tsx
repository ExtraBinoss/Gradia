import type { ReactNode } from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { AnimatePresence, m } from "motion/react";
import { cn } from "cn";
const displayValue = (value: number) => value;

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  showTooltip = false,
  tooltipContent = displayValue,
  "aria-label": label,
  ...props
}: SliderPrimitive.Root.Props & {
  showTooltip?: boolean;
  tooltipContent?: (value: number) => ReactNode;
}) {
  const values = value ?? defaultValue ?? min;
  const count = Array.isArray(values) ? values.length : 1;

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex min-h-6 w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-6 data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-secondary select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            getAriaLabel={label ? () => label : undefined}
            className="block size-4 shrink-0 rounded-full border-2 border-primary bg-background shadow-sm transition-shadow select-none hover:ring-4 hover:ring-primary/10 focus-within:ring-4 focus-within:ring-primary/20 focus-within:outline-hidden data-dragging:shadow-md"
            render={(thumbProps, state) => (
              <div {...thumbProps}>
                {thumbProps.children}
                <AnimatePresence>
                  {showTooltip && state.dragging && state.activeThumbIndex === index && (
                    <m.span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-[calc(100%+9px)] left-1/2 -translate-x-1/2 rounded-lg bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-sm"
                      initial={{ opacity: 0, y: 4, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 2, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                    >
                      {tooltipContent(state.values[index])}
                    </m.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
