"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <style>{`
        [data-sonner-toaster] {
          z-index: 60 !important;
        }
        [data-slot="dropdown-menu-content"],
        [data-slot="dropdown-menu-sub-content"],
        [data-slot="select-content"] {
          z-index: 2147483647 !important;
        }
        [data-sonner-toast] {
          padding-right: 2.25rem !important;
        }
        [data-sonner-toast] [data-close-button] {
          opacity: 1 !important;
          visibility: visible !important;
          left: auto !important;
          right: 8px !important;
          top: 12px !important;
          transform: none !important;
          width: 22px !important;
          height: 22px !important;
          border-radius: 9999px !important;
          background: #f1f5f9 !important;
          color: #475569 !important;
          border: 1px solid #cbd5e1 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          background: #fee2e2 !important;
          color: #dc2626 !important;
          border-color: #fca5a5 !important;
        }
        [data-sonner-toast] [data-description] {
          color: #0f172a !important;
          opacity: 1 !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          line-height: 1.25rem !important;
        }
        [data-sonner-toast] [data-title] {
          color: #0f172a !important;
          font-weight: 700 !important;
          font-size: 0.9375rem !important;
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        closeButton={true}
        visibleToasts={2}
        toastOptions={{
          classNames: {
            toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg relative",
            description: "!text-slate-900 font-semibold !opacity-100",
            title: "!text-slate-900 font-bold",
            closeButton: "!opacity-100 !visible",
          }
        }}
        style={
          {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties
        }
        {...props}
      />
    </>
  );
};

export { Toaster };

