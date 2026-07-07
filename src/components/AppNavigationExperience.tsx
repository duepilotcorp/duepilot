"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import DuePilotTransitionLoader from "@/components/DuePilotTransitionLoader";

const PREFETCHED_APP_ROUTES = [
  "/dashboard",
  "/deadlines",
  "/deadlines/new",
  "/deadlines/calendar",
  "/deadlines/history",
  "/deadlines/library",
  "/deadlines/audit",
  "/settings/account",
  "/settings/organization",
  "/admin",
] as const;

const NAVIGATION_MIN_VISIBLE_MS = 950;
const NAVIGATION_FEEDBACK_TIMEOUT_MS = 7000;
const NAVIGATION_COMPLETION_GRACE_MS = 120;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function getAnchorTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>("a[href]");
}

function getInternalHref(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  const target = anchor.getAttribute("target");
  const download = anchor.hasAttribute("download");

  if (!href || target || download || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }

  let nextUrl: URL;

  try {
    nextUrl = new URL(href, window.location.href);
  } catch {
    return null;
  }

  if (nextUrl.origin !== window.location.origin) return null;

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

export default function AppNavigationExperience() {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationStartedAtRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedHrefsRef = useRef(new Set<string>());
  const prefetchedRoutes = useMemo(() => PREFETCHED_APP_ROUTES, []);

  const prefetchHref = (href: string | null) => {
    if (!href || prefetchedHrefsRef.current.has(href)) return;

    prefetchedHrefsRef.current.add(href);

    try {
      router.prefetch(href);
    } catch {
      // Le préchargement est une optimisation : il ne doit jamais bloquer l'app.
    }
  };

  const clearNavigationTimers = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  };

  const stopNavigationFeedback = () => {
    setIsNavigating(false);
    navigationStartedAtRef.current = null;
    clearNavigationTimers();
  };

  const finishNavigationFeedback = () => {
    const startedAt = navigationStartedAtRef.current;

    if (!startedAt) {
      stopNavigationFeedback();
      return;
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(
      NAVIGATION_COMPLETION_GRACE_MS,
      NAVIGATION_MIN_VISIBLE_MS - elapsed,
    );

    hideTimeoutRef.current = setTimeout(() => {
      stopNavigationFeedback();
    }, remaining);
  };

  const startNavigationFeedback = () => {
    clearNavigationTimers();
    navigationStartedAtRef.current = Date.now();
    setIsNavigating(true);

    maxTimeoutRef.current = setTimeout(() => {
      stopNavigationFeedback();
    }, NAVIGATION_FEEDBACK_TIMEOUT_MS);
  };

  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const prefetch = () => {
      prefetchedRoutes.forEach((route, index) => {
        const timeoutId = setTimeout(() => {
          prefetchHref(route);
        }, index * 80);

        timeoutIds.push(timeoutId);
      });
    };

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(prefetch, { timeout: 1400 });
      return () => {
        window.cancelIdleCallback(idleCallbackId);
        timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      };
    }

    const fallbackId = setTimeout(prefetch, 350);
    return () => {
      clearTimeout(fallbackId);
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [prefetchedRoutes, router]);

  useEffect(() => {
    const handleIntent = (event: MouseEvent | FocusEvent | TouchEvent) => {
      const anchor = getAnchorTarget(event.target);
      if (!anchor) return;

      prefetchHref(getInternalHref(anchor));
    };

    document.addEventListener("pointerover", handleIntent, { capture: true });
    document.addEventListener("focusin", handleIntent, { capture: true });
    document.addEventListener("touchstart", handleIntent, { capture: true, passive: true });

    return () => {
      document.removeEventListener("pointerover", handleIntent, { capture: true });
      document.removeEventListener("focusin", handleIntent, { capture: true });
      document.removeEventListener("touchstart", handleIntent, { capture: true });
    };
  }, [router]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const anchor = getAnchorTarget(event.target);
      if (!anchor) return;

      const nextPath = getInternalHref(anchor);
      if (!nextPath) return;

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentPath === nextPath) return;

      startNavigationFeedback();
    };

    const handlePopState = () => {
      startNavigationFeedback();
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      stopNavigationFeedback();
    };
  }, []);

  useEffect(() => {
    if (!navigationStartedAtRef.current) return;
    finishNavigationFeedback();
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed left-0 top-0 z-[10000] h-1 w-full origin-left bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 shadow-[0_0_28px_rgba(56,189,248,0.55)] transition duration-300 ${
          isNavigating ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
      />

      <div
        role="status"
        aria-live="polite"
        aria-label="Chargement de la page"
        className={`fixed inset-0 z-[9998] grid place-items-center bg-[#020617]/88 px-6 backdrop-blur-md transition duration-300 ${
          isNavigating ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <DuePilotTransitionLoader active={isNavigating} />
      </div>
    </>
  );
}
