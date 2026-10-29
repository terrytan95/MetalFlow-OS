"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../lib/i18n";
import { Button, Modal, Empty } from "./ui";
import type { API } from "./forms";
import type { RecordData } from "./data";
export function FileSettings({
  api,
  organizationId,
}: {
  api: API;
  organizationId: string;
}) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<RecordData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["files", organizationId, page],
    queryFn: () => api(`files?page=${page}`),
  });
  return (
    <section className="section-title">
      <h3>{t("Stored files")}</h3>
      <p className="muted">
        {t(
          "Remove abandoned uploads. Files linked to saved takeoffs or AI jobs are protected.",
        )}
      </p>
      {query.data?.items?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Size")}</th>
                <th>{t("Created")}</th>
                <th>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((f: RecordData) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{(f.size / 1024).toFixed(1)} KB</td>
                  <td>{new Date(f.createdAt).toLocaleDateString(locale)}</td>
                  <td>
                    <Button
                      onClick={() => {
                        setSelected(f);
                        setError("");
                      }}
                    >
                      {t("Delete unused file")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={t("No stored files")} />
      )}
      <div className="pagination">
        <span>
          {t("Page")} {page}
        </span>
        <div className="actions">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            {t("Previous page")}
          </Button>
          <Button
            disabled={page * 25 >= (query.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            {t("Next page")}
          </Button>
        </div>
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={t("Delete unused file")}
      >
        <p>{selected?.name}</p>
        <p className="notice">
          {t(
            "This permanently removes an unlinked upload from this workspace.",
          )}
        </p>
        {error && <p className="error">{t(error)}</p>}
        <div className="actions">
          <Button onClick={() => setSelected(null)}>{t("Cancel")}</Button>
          <Button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`files/${selected?.id}`, "DELETE");
                setSelected(null);
                await query.refetch();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Delete")}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
