"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <style>{`
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
        toastOptions={{
          classNames: {
            toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg",
            description: "!text-slate-900 font-semibold !opacity-100",
            title: "!text-slate-900 font-bold",
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

