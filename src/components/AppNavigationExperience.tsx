"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const PREFETCHED_APP_ROUTES = [
  "/dashboard",
  "/deadlines",
  "/deadlines/new",
  "/deadlines/calendar",
  "/deadlines/history",
  "/deadlines/library",
  "/settings/account",
  "/settings/organization",
] as const;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function getAnchorTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>("a[href]");
}

export default function AppNavigationExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRoutes = useMemo(() => PREFETCHED_APP_ROUTES, []);

  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const prefetch = () => {
      prefetchedRoutes.forEach((route, index) => {
        const timeoutId = setTimeout(() => {
          try {
            router.prefetch(route);
          } catch {
            // Le préchargement est une optimisation : il ne doit jamais bloquer l'app.
          }
        }, index * 140);

        timeoutIds.push(timeoutId);
      });
    };

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(prefetch, { timeout: 2200 });
      return () => {
        window.cancelIdleCallback(idleCallbackId);
        timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      };
    }

    const fallbackId = setTimeout(prefetch, 900);
    return () => {
      clearTimeout(fallbackId);
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [prefetchedRoutes, router]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const anchor = getAnchorTarget(event.target);
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      const download = anchor.hasAttribute("download");

      if (!href || target || download || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let nextUrl: URL;

      try {
        nextUrl = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

      if (currentPath === nextPath) return;

      setIsNavigating(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 6500);
    };

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsNavigating(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`fixed left-0 top-0 z-[9999] h-1 w-full origin-left bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 shadow-[0_0_28px_rgba(56,189,248,0.55)] transition duration-300 ${
        isNavigating ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
      }`}
    />
  );
}
