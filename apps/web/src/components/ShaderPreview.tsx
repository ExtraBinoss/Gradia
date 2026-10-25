import { memo, useEffect, useState } from "react";
import type { GradientColor } from "@plinka/gradient-core";

/** Keep the previous decoded capture visible while the next image is being prepared. */
export const ShaderPreview = memo(function ShaderPreview({
  src,
  colors,
  className = "",
}: {
  src?: string;
  colors: readonly GradientColor[];
  className?: string;
}) {
  const [current, setCurrent] = useState<string>();
  const [previous, setPrevious] = useState<string>();
  useEffect(() => {
    if (!src || src === current) return;
    let live = true;
    const image = new Image();
    image.src = src;
    void image.decode().then(
      () => {
        if (live) {
          setPrevious(current);
          setCurrent(src);
        }
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [src, current]);
  useEffect(() => {
    const timer = setTimeout(() => setPrevious(undefined), 450);
    return () => clearTimeout(timer);
  }, [current]);
  const palette = colors.filter((color) => color.enabled).map((color) => color.color);
  const stops = palette.length > 1 ? palette : [palette[0] ?? "#d4cae9", palette[0] ?? "#d4cae9"];
  return (
    <span
      className={`shader-preview ${className}`}
      style={{ background: `linear-gradient(135deg, ${stops.join(",")})` }}
    >
      {previous && <img className="shader-preview-previous" src={previous} alt="" />}
      {current && <img key={current} className="shader-preview-current" src={current} alt="" />}
    </span>
  );
});
