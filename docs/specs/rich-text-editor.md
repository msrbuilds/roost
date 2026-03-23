# Rich Text Editor Specification

## Overview

The Rich Text Editor uses `react-quill-new` (a fork of React Quill 2.0) to provide a WYSIWYG editing experience. It ensures safe HTML output and consistent styling.

## Configuration

### Modules (Toolbar)
We configure a focused set of tools to maintain post quality:
- **Formatting**: Bold, Italic, Underline, Strike.
- **Structure**: Headers (H1, H2), Lists (Ordered, Bullet).
- **Links**: Hyperlink insertion.
- **Clean**: Remove formatting button.

```typescript
const modules = {
    toolbar: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'clean'],
    ],
    // ...
};
```

### Styling
Custom CSS overrides (`.ql-container`, `.ql-toolbar`) are applied to match the application's Tailwind design system (rounded corners, specific border colors).

## Implementation Details

### `RichTextEditor.tsx`
- **Props**: `value` (HTML string), `onChange` (callback), `placeholder`.
- **Synchronization**:
  - The component manages its own internal Quill instance.
  - **Critical**: It listens for changes to the `value` prop to handle "late initialization" (e.g., when editing a post and the content loads asynchronously).
  - Logic: If the editor is empty but `value` is provided, it manually pastes the HTML. This avoids race conditions where the editor mounts before data arrives.

### `CreatePostModal.tsx` Integration
- **Key Prop**: We pass a `key={editingPost?.id || 'new'}` to the `RichTextEditor`.
- **Why?**: This forces the editor component to completely unmount and remount when switching between different posts or between "Edit" and "Create" modes. This is the most robust way to clear internal Quill state.

## Security
- **XSS Protection**: Quill handles basic sanitization.
- **Output**: The output is HTML string, which is rendered using `dangerouslySetInnerHTML` in `PostCard`.
- **Future Improvement**: Implement a server-side or strict client-side sanitizer (e.g., `dompurify`) before rendering user content if we allow more complex tags.
