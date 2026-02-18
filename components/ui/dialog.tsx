"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used within Dialog");
  }
  return ctx;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogContentProps {
  children?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function DialogContent({ children }: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        const firstFocusable = innerContentRef.current?.querySelector<HTMLElement>(
          FOCUSABLE_SELECTOR
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          contentRef.current?.focus();
        }
      });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      ref={contentRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={innerContentRef}
        className="relative max-w-lg w-full rounded-[24px] border border-[#D4C5BA] bg-white p-6 pr-12 shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
      >
        <button
          type="button"
          className="absolute right-4 top-4 text-[#9B7B6B] hover:text-[#4A4A4A]"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export interface DialogHeaderProps {
  children?: ReactNode;
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="mb-4">{children}</div>;
}

export interface DialogTitleProps {
  children?: ReactNode;
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <div className="text-lg font-semibold">{children}</div>;
}

export interface DialogDescriptionProps {
  children?: ReactNode;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <div className="mt-1 text-sm text-neutral-500">{children}</div>;
}
