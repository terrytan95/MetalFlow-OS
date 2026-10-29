"use client";
import { useI18n } from "../lib/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...v: Parameters<typeof clsx>) {
  return twMerge(clsx(v));
}
export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("btn", className)} {...props} />;
}
export function confirmDialogDiscard(t: (text: string) => string) {
  const dialog = document.querySelector('[role="dialog"][data-dirty="true"]');
  return !dialog || window.confirm(t("Discard unsaved changes?"));
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  translateTitle = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  translateTitle?: boolean;
}) {
  const { t } = useI18n();
  const [dirty, setDirty] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) setDirty(false);
    const unload = (event: BeforeUnloadEvent) => {
      if (!open || !content.current?.querySelector("form") || !dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [open, dirty]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v && confirmDialogDiscard(t)) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          ref={content}
          data-dirty={dirty}
          onChangeCapture={(event) => {
            if ((event.target as HTMLElement).closest("form")) setDirty(true);
          }}
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("[data-draft-change]"))
              setDirty(true);
          }}
          className={cn("dialog", wide && "wide")}
          aria-describedby={undefined}
        >
          <div className="dialog-header">
            <Dialog.Title>{translateTitle ? t(title) : title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button aria-label={t("Close")}>
                <X size={17} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Badge({ value }: { value: string }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "badge",
        /REJECTED|CANCELLED|FAILED/.test(value) && "danger",
        /PENDING|DRAFT|NEW|QUEUED/.test(value) && "neutral",
      )}
    >
      {t(value) === value ? value.toLowerCase().replaceAll("_", " ") : t(value)}
    </span>
  );
}
export function Empty({
  title = "No records yet",
  description = "Create your first record to get started.",
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="empty">
      <div className="empty-mark">{t("M")}</div>
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
    </div>
  );
}
