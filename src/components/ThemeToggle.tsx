"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("litma:theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button type="button" onClick={toggle} className={`btn btn-ghost !p-2 ${className}`} title={dark ? "Day desk" : "Night desk"} aria-label="Toggle dark mode">
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
