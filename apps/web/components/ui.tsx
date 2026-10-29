"use client";
import { useI18n } from "../lib/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";
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
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={cn("dialog", wide && "wide")}
          aria-describedby={undefined}
        >
          <div className="dialog-header">
            <Dialog.Title>{t(title)}</Dialog.Title>
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
