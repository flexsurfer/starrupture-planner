import React, { useState, useEffect } from 'react';

interface RenameBaseModalProps {
  isOpen: boolean;
  baseId: string | null;
  currentName: string;
  onClose: () => void;
  onRename: (baseId: string, newName: string) => void;
}

export const RenameBaseModal: React.FC<RenameBaseModalProps> = ({
  isOpen,
  baseId,
  currentName,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen || !baseId) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onRename(baseId, name.trim());
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
        <h3 className="font-bold text-lg mb-4">Rename Base</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Base Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter base name"
              autoFocus
              required
            />
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || name.trim() === currentName}
            >
              Rename
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={handleCancel}></div>
    </div>
  );
};
