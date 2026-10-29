"use client";
export function enterWorkspace(element: HTMLElement | null) {
  if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  for (const animation of element.getAnimations()) animation.cancel();
  element.animate(
    [{ transform: "translateY(4px)" }, { transform: "translateY(0)" }],
    { duration: 220, easing: "cubic-bezier(.2,0,0,1)" },
  );
}
