"use client";

/**
 * Link preview system — floating card for link inspection.
 *
 * Two entry points, same UI:
 * - EditorLinkPreview: editable ContentEditor (cursor on link)
 * - ReadonlyLinkWrapper: ReadonlyContent (click on link)
 *
 * Both use @floating-ui/react-dom (useFloating + autoUpdate) portaled
 * to document.body. This escapes ALL overflow:hidden ancestors while
 * autoUpdate keeps the card anchored across any ancestor scroll.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/react-dom";
import { getOverflowAncestors } from "@floating-ui/dom";
import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import type { Editor } from "@tiptap/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openLink(href: string) {
  if (href.startsWith("/")) {
    window.dispatchEvent(
      new CustomEvent("multica:navigate", { detail: { path: href } }),
    );
  } else {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  try {
    const u = new URL(url);
    const origin = u.origin;
    const rest = url.slice(origin.length);
    if (rest.length <= 10) return url;
    return `${origin}${rest.slice(0, max - origin.length - 1)}…`;
  } catch {
    return `${url.slice(0, max - 1)}…`;
  }
}

// ---------------------------------------------------------------------------
// LinkPreviewCard — pure UI
// ---------------------------------------------------------------------------

function LinkPreviewCard({
  href,
  onMouseDown,
}: {
  href: string;
  onMouseDown?: (e: React.MouseEvent) => void;
}) {
  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(href);
        toast.success("Link copied");
      } catch {
        toast.error("Failed to copy");
      }
    },
    [href],
  );

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openLink(href);
    },
    [href],
  );

  return (
    <div className="link-preview-card" onMouseDown={onMouseDown}>
      <span
        className="min-w-0 flex-1 truncate text-xs text-muted-foreground px-1"
        title={href}
      >
        {truncateUrl(href)}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-muted-foreground"
        onClick={handleCopy}
        title="Copy link"
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        className="text-muted-foreground"
        onClick={handleOpen}
        title="Open link"
      >
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared hooks
// ---------------------------------------------------------------------------

function useCloseOnOutsideClick(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const handle = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".link-preview-card")) return;
      close();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handle), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handle);
    };
  }, [active, close]);
}

function useCloseOnEscape(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [active, close]);
}

// ---------------------------------------------------------------------------
// EditorLinkPreview — for editable ContentEditor
// ---------------------------------------------------------------------------

function EditorLinkPreview({ editor }: { editor: Editor }) {
  const [visible, setVisible] = useState(false);
  const [href, setHref] = useState("");

  const close = useCallback(() => setVisible(false), []);

  const virtualRef = useRef({
    getBoundingClientRect: () => new DOMRect(),
    contextElement: editor.view?.dom,
  });

  const { refs, floatingStyles, isPositioned, update } = useFloating({
    strategy: "fixed",
    placement: "bottom",
    open: visible,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    elements: { reference: virtualRef.current },
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (typeof editor.on !== "function" || typeof editor.off !== "function") {
      return;
    }

    const check = () => {
      const view = editor.view;
      if (!editor.isEditable) {
        setVisible(false);
        return;
      }
      if (!view?.dom || typeof view.coordsAtPos !== "function") {
        setVisible(false);
        return;
      }
      if (!editor.state.selection.empty || !editor.isActive("link")) {
        setVisible(false);
        return;
      }
      const linkHref = (editor.getAttributes("link").href as string) || "";
      if (!linkHref) {
        setVisible(false);
        return;
      }

      const coords = view.coordsAtPos(editor.state.selection.from);
      virtualRef.current = {
        getBoundingClientRect: () =>
          new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top),
        contextElement: view.dom,
      };

      setHref(linkHref);
      setVisible(true);
      update();
    };

    editor.on("selectionUpdate", check);
    return () => { editor.off("selectionUpdate", check); };
  }, [editor, update]);

  // Close on any ancestor scroll or window resize
  useEffect(() => {
    const editorDom = editor.view?.dom;
    if (!visible || !editorDom) return;
    const close = () => {
      setVisible(false);
    };
    const ancestors = getOverflowAncestors(editorDom);
    ancestors.forEach((el) => el.addEventListener("scroll", close, { passive: true }));
    window.addEventListener("resize", close);
    return () => {
      ancestors.forEach((el) => el.removeEventListener("scroll", close));
      window.removeEventListener("resize", close);
    };
  }, [visible, editor]);

  useCloseOnOutsideClick(visible, close);
  useCloseOnEscape(visible, close);

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        zIndex: 50,
        display: visible && isPositioned ? undefined : "none",
      }}
    >
      <LinkPreviewCard href={href} onMouseDown={(e) => e.preventDefault()} />
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// ReadonlyLinkWrapper — for ReadonlyContent (react-markdown)
// ---------------------------------------------------------------------------

function ReadonlyLinkWrapper({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    elements: { reference: anchorRef.current },
    open,
  });

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    },
    [],
  );

  // Close on any ancestor scroll
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const hide = () => setOpen(false);
    const ancestors = getOverflowAncestors(anchorRef.current);
    ancestors.forEach((el) => el.addEventListener("scroll", hide, { passive: true }));
    return () => {
      ancestors.forEach((el) => el.removeEventListener("scroll", hide));
    };
  }, [open]);

  useCloseOnOutsideClick(open, close);
  useCloseOnEscape(open, close);

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        onClick={toggle}
        role="button"
        aria-expanded={open}
      >
        {children}
      </a>
      {open &&
        createPortal(
          <div ref={refs.setFloating} style={{ ...floatingStyles, zIndex: 50 }}>
            <LinkPreviewCard href={href} />
          </div>,
          document.body,
        )}
    </>
  );
}

export { EditorLinkPreview, ReadonlyLinkWrapper, openLink };
