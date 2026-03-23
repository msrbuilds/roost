import { MessageSquare } from 'lucide-react';

export default function EmptyChatState() {
  return (
    <div className="flex items-center justify-center h-full bg-surface-50 dark:bg-surface-950">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
          <MessageSquare className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-50 mb-2">
          Select a conversation
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm">
          Choose a conversation from the list or start a new message to begin chatting
        </p>
      </div>
    </div>
  );
}
