import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import UserSearchInput from './UserSearchInput';
import type { Profile } from '../../types/database';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSelect: (user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>) => void;
}

export default function NewMessageModal({ isOpen, onClose, onUserSelect }: NewMessageModalProps) {
  if (!isOpen) return null;

  const handleUserSelect = (user: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'membership_type'>) => {
    onUserSelect(user);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h2 className="text-lg font-semibold text-surface-900">New Message</h2>
          <button
            onClick={onClose}
            className="p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Search for a user to message
          </label>
          <UserSearchInput
            onUserSelect={handleUserSelect}
            placeholder="Search by name or username..."
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-200 bg-surface-50 rounded-b-2xl">
          <p className="text-xs text-surface-500 text-center">
            Start typing to search for users in the community
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
