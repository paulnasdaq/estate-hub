import { useEffect, useState } from "react";

// Mapbox's own light/dark base styles, matched to the app theme.
const MAP_STYLE_LIGHT = "mapbox://styles/mapbox/streets-v12";
const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

// Theme is driven by the `.dark` class on <html> (see index.css and sonner.tsx),
// so read it from the DOM and re-render if it toggles at runtime. Shared by the
// read-only PropertyMap and the interactive LocationPicker.
export function useMapStyle() {
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
