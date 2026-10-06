import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/shared/i18n';

interface EditBuildingModalProps {
  defaultName: string;
  currentName?: string;
  currentDescription?: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

export function EditBuildingModal({ defaultName, currentName, currentDescription, onClose, onSave }: EditBuildingModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(currentName || '');
  const [description, setDescription] = useState(currentDescription || '');
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="modal" aria-labelledby={`${id}-title`} onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-box max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={`${id}-title`} className="text-lg font-semibold">{t("Edit building")}</h2>
          <button type="button" className="btn btn-sm btn-ghost btn-square" aria-label={t("Close modal")} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          onSave(name, description);
        }}>
          <label className="flex flex-col gap-2 text-sm">
            {t("Building name")}
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder={defaultName}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby={`${id}-name-help`}
              autoFocus
            />
          </label>
          <p id={`${id}-name-help`} className="mt-1 text-xs text-base-content/60">{t("Leave blank to use the building type name.")}</p>
          <label className="mt-4 flex flex-col gap-2 text-sm">
            {t("Description")}
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              placeholder={t("Add a note...")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t("Cancel")}</button>
            <button type="submit" className="btn btn-primary">{t("Save")}</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
