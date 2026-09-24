import { useTranslation } from '@/shared/i18n';
import React, { useState } from 'react';

interface CreateBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const CreateBaseModal: React.FC<CreateBaseModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
    const { t } = useTranslation();
  const [name, setName] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();
    }
  };

  const handleCancel = () => {
    setName('');
    onClose();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{t("Create New Base")}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">{t("Base Name")}</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Enter base name")}
              autoFocus
              required
            />
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
            >{t("Cancel")}</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >{t("Create Base")}</button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={handleCancel}></div>
    </div>
  );
};
