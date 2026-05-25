"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { useSession } from "@/app/lib/useSession";
import type {
  PackingCategory,
  PackingItem,
  PackingParticipant,
} from "@/components/packing/packing-list";
import {
  addTripItemsToTemplate,
  createTemplateFromTrip,
  deleteTemplate,
  fetchTemplates,
  importTemplateToTrip,
  renameTemplate,
} from "@/lib/packing-templates/queries";
import type {
  PackingTemplateItemRow,
  PackingTemplateWithCount,
} from "@/lib/packing-templates/types";

export type PackingTemplatesDialogMode =
  | "manage"
  | "import"
  | "save-new"
  | "add-to-existing";

export interface PackingTemplatesPanelProps {
  active: boolean;
  mode: PackingTemplatesDialogMode;
  tripId: string;
  categories: PackingCategory[];
  items: PackingItem[];
  participants: PackingParticipant[];
  onRefresh: () => Promise<void>;
  onSuccessMessage: (message: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

const BTN_PRIMARY =
  "rounded-full bg-[#E07A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D96A4F] disabled:opacity-60";
const BTN_SECONDARY =
  "rounded-full border border-[#D4C5BA] bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-[#F5F3F0] disabled:opacity-60";

function assigneeLabel(assignedTo: string | null): string {
  const trimmed = (assignedTo ?? "").trim();
  return trimmed || "Everyone";
}

function formatTemplateItemMeta(item: PackingTemplateItemRow): string {
  const parts: string[] = [];
  const category = (item.category ?? "").trim();
  if (category) parts.push(category);
  parts.push(assigneeLabel(item.assigned_to));
  return parts.join(" · ");
}

export function modeTitle(mode: PackingTemplatesDialogMode): string {
  switch (mode) {
    case "manage":
      return "Manage templates";
    case "import":
      return "Import from template";
    case "save-new":
      return "Save as new template";
    case "add-to-existing":
      return "Add to existing template";
  }
}

export function PackingTemplatesPanel({
  active,
  mode,
  tripId,
  categories,
  items,
  participants,
  onRefresh,
  onSuccessMessage,
  onBack,
  onComplete,
}: PackingTemplatesPanelProps) {
  const { user } = useSession();
  const [templates, setTemplates] = useState<PackingTemplateWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchTemplates(supabase);
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load templates.");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    setError(null);
    setSelectedTemplateId(null);
    setTemplateName("");
    setRenamingId(null);
    setDeleteConfirmId(null);
    setExpandedTemplateId(null);
    void loadTemplates();
  }, [active, loadTemplates]);

  function finish() {
    onComplete();
  }

  async function handleSaveNew() {
    if (!user?.id) {
      setError("You must be signed in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { itemCount } = await createTemplateFromTrip(
        supabase,
        user.id,
        tripId,
        templateName,
        items,
        categories,
        participants
      );
      onSuccessMessage(
        `Saved template with ${itemCount} ${itemCount === 1 ? "item" : "items"}.`
      );
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!selectedTemplateId) {
      setError("Select a template.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await importTemplateToTrip(
        supabase,
        selectedTemplateId,
        tripId,
        items,
        categories,
        participants
      );
      await onRefresh();
      onSuccessMessage(
        `Imported ${result.added} ${result.added === 1 ? "item" : "items"}` +
          (result.skipped > 0
            ? ` (${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped).`
            : ".")
      );
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddToExisting() {
    if (!selectedTemplateId) {
      setError("Select a template.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await addTripItemsToTemplate(
        supabase,
        selectedTemplateId,
        items,
        categories,
        participants
      );
      await loadTemplates();
      onSuccessMessage(
        `Added ${result.added} ${result.added === 1 ? "item" : "items"} to template` +
          (result.skipped > 0
            ? ` (${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped).`
            : ".")
      );
      finish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add items.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(templateId: string) {
    setBusy(true);
    setError(null);
    try {
      await renameTemplate(supabase, templateId, renameValue);
      setRenamingId(null);
      await loadTemplates();
      onSuccessMessage("Template renamed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(templateId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteTemplate(supabase, templateId);
      setDeleteConfirmId(null);
      setExpandedTemplateId((id) => (id === templateId ? null : id));
      await loadTemplates();
      onSuccessMessage("Template deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  function renderTemplatePicker(actionLabel: string, onAction: () => void) {
    return (
      <>
        {loading ? (
          <p className="text-sm text-[#6B7280]">Loading templates…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-[#6B7280]">
            No templates yet. Save this trip as a template first.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {templates.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ebe5df] bg-[#FAFAF8] px-3 py-2.5 hover:bg-[#F5F3F0]">
                  <input
                    type="radio"
                    name="packing-template-pick"
                    className="size-4 accent-[#E07A5F]"
                    checked={selectedTemplateId === t.id}
                    onChange={() => setSelectedTemplateId(t.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#2d2d2d]">
                      {t.name}
                    </span>
                    <span className="text-xs text-[#8a8a8a]">
                      {t.item_count}{" "}
                      {t.item_count === 1 ? "item" : "items"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={onBack} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={onAction}
            disabled={busy || templates.length === 0}
          >
            {busy ? "Working…" : actionLabel}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "save-new" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">
              Copy this trip&apos;s packing list ({items.length}{" "}
              {items.length === 1 ? "item" : "items"}) into a new personal
              template. Packed status is not saved.
            </p>
            <label className="block text-sm font-medium text-[#4A4A4A]">
              Template name
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4C5BA] px-3 py-2 text-sm"
                placeholder="e.g. Beach vacation"
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={onBack} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                onClick={() => void handleSaveNew()}
                disabled={busy || !templateName.trim()}
              >
                {busy ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        )}

        {mode === "import" && (
          <div className="space-y-3">
            <p className="text-sm text-[#6B7280]">
              Add items from a template to this trip. Duplicates (same name,
              category, and assignee) are skipped. Imported items are unpacked.
            </p>
            {renderTemplatePicker("Import items", () => void handleImport())}
          </div>
        )}

        {mode === "add-to-existing" && (
          <div className="space-y-3">
            <p className="text-sm text-[#6B7280]">
              Add items from this trip to a template. Existing template items
              are kept. Duplicates are skipped.
            </p>
            {renderTemplatePicker("Add items", () => void handleAddToExisting())}
          </div>
        )}

        {mode === "manage" && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-[#6B7280]">Loading templates…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No templates yet.</p>
            ) : (
              <ul className="max-h-[min(28rem,70vh)] space-y-2 overflow-y-auto">
                {templates.map((t) => {
                  const isExpanded = expandedTemplateId === t.id;
                  const canExpand =
                    renamingId !== t.id && deleteConfirmId !== t.id && t.item_count > 0;
                  return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-[#ebe5df] bg-[#FAFAF8] px-3 py-2.5"
                  >
                    {renamingId === t.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-[#D4C5BA] px-2 py-1 text-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="text-xs font-medium text-[#E07A5F]"
                          disabled={busy || !renameValue.trim()}
                          onClick={() => void handleRename(t.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[#6B7280]"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : deleteConfirmId === t.id ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-[#6B7280]">Delete template?</span>
                        <button
                          type="button"
                          className="font-medium text-red-600"
                          disabled={busy}
                          onClick={() => void handleDelete(t.id)}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className="text-[#4A4A4A]"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#2d2d2d]">
                            {t.name}
                          </p>
                          <p className="text-xs text-[#8a8a8a]">
                            {t.item_count}{" "}
                            {t.item_count === 1 ? "item" : "items"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {canExpand ? (
                            <button
                              type="button"
                              className="flex items-center gap-0.5 text-xs font-medium text-[#6B7280] hover:text-[#4A4A4A]"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedTemplateId(isExpanded ? null : t.id)
                              }
                            >
                              {isExpanded ? "Hide items" : "View items"}
                              <ChevronDown
                                className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                aria-hidden
                              />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-xs font-medium text-[#E07A5F]"
                            onClick={() => {
                              setRenamingId(t.id);
                              setRenameValue(t.name);
                              setExpandedTemplateId(null);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600"
                            onClick={() => {
                              setDeleteConfirmId(t.id);
                              setExpandedTemplateId(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {isExpanded && t.items.length > 0 ? (
                        <ul className="mt-2.5 max-h-48 space-y-1.5 overflow-y-auto border-t border-[#ebe5df] pt-2.5">
                          {t.items.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-lg bg-white px-2.5 py-2 text-sm"
                            >
                              <p className="font-medium text-[#2d2d2d]">
                                {item.name}
                                {item.quantity > 1 ? (
                                  <span className="ml-1 font-normal text-[#8a8a8a]">
                                    ×{item.quantity}
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-xs text-[#8a8a8a]">
                                {formatTemplateItemMeta(item)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" className={BTN_SECONDARY} onClick={onBack}>
                Done
              </button>
            </div>
          </div>
        )}
    </>
  );
}
