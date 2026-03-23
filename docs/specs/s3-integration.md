# AWS S3 Integration Specification

## Overview

This document describes the AWS S3 integration for file uploads in the Commune platform, including configuration, upload utilities, and best practices.

---

## Configuration

### Environment Variables

```env
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-bucket-name
# IMPORTANT: never expose AWS credentials to the browser. The client uses
# backend-issued pre-signed URLs for upload, and only needs non-secret config.
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

### Client Setup

**File:** `/src/services/s3.ts`

```typescript
// The browser NEVER uses AWS credentials.
// Upload flow:
// 1. Client requests a pre-signed URL from the backend: POST /api/upload/presign
// 2. Client PUTs the file directly to S3 using the pre-signed URL
// 3. Backend credentials stay server-side only
```

---

## File Types & Limits

### Allowed Types

| Type | MIME Types | Max Size |
|------|-----------|----------|
| Images | JPEG, PNG, GIF, WebP | 10 MB |
| Videos | MP4, WebM, MOV | 100 MB |
| Documents | PDF, DOC, DOCX | 100 MB |

### Constants

```typescript
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', ...];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
```

---

## Upload Functions

### Basic File Upload

```typescript
import { uploadFile } from '@/services/s3';

const file = inputElement.files[0];
const result = await uploadFile(file, 'uploads');

console.log(result);
// {
//   key: 'uploads/1234567890-abc123-filename.jpg',
//   url: 'https://bucket.s3.region.amazonaws.com/uploads/...',
//   fileName: 'filename.jpg',
//   fileSize: 12345,
//   mimeType: 'image/jpeg',
// }
```

### Image Upload (with validation)

```typescript
import { uploadImage } from '@/services/s3';

try {
  const result = await uploadImage(file);
  // Image stored in 'images/' folder
} catch (err) {
  // Invalid type or size exceeded
}
```

### Avatar Upload

```typescript
import { uploadAvatar } from '@/services/s3';

const result = await uploadAvatar(file, userId);
// Stored in 'avatars/{userId}/' folder
// Max size: 5MB
```

### Video Upload

```typescript
import { uploadVideo } from '@/services/s3';

const result = await uploadVideo(file);
// Stored in 'videos/' folder
```

### Document Upload

```typescript
import { uploadDocument } from '@/services/s3';

const result = await uploadDocument(file);
// Stored in 'documents/' folder
```

---

## Delete Files

```typescript
import { deleteFile } from '@/services/s3';

await deleteFile('uploads/1234567890-abc123-filename.jpg');
```

---

## URL Helpers

### Get Public URL

```typescript
import { getPublicUrl } from '@/services/s3';

const url = getPublicUrl('images/photo.jpg');
// https://bucket.s3.region.amazonaws.com/images/photo.jpg
```

### Get Signed URL (for private files)

```typescript
import { getSignedDownloadUrl } from '@/services/s3';

// URL valid for 1 hour
const url = await getSignedDownloadUrl('documents/private.pdf', 3600);
```

---

## Asset Type Detection

```typescript
import { getAssetType } from '@/services/s3';

getAssetType('image/jpeg');    // 'image'
getAssetType('video/mp4');     // 'video'
getAssetType('application/pdf'); // 'document'
getAssetType('text/plain');    // 'other'
```

---

## Upload Result Type

```typescript
interface UploadResult {
  key: string;        // S3 object key
  url: string;        // Public URL
  fileName: string;   // Original filename
  fileSize: number;   // Size in bytes
  mimeType: string;   // MIME type
}
```

---

## Integration with Database

After uploading, save the asset reference to the database:

```typescript
import { uploadImage, getAssetType } from '@/services/s3';
import { db } from '@/services/supabase';

async function uploadPostImage(file: File, postId: string, userId: string) {
  // Upload to S3
  const result = await uploadImage(file);
  
  // Save to database
  const { data, error } = await db.assets().insert({
    filename: result.fileName,
    file_url: result.url,
    file_size: result.fileSize,
    mime_type: result.mimeType,
    asset_type: getAssetType(result.mimeType),
    uploaded_by: userId,
    post_id: postId,
  });
  
  return data;
}
```

---

## React Integration

### File Input Component

```tsx
function ImageUploader({ onUpload }: { onUpload: (url: string) => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadImage(file);
      onUpload(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={isUploading}
      />
      {isUploading && <span>Uploading...</span>}
      {error && <span className="text-error">{error}</span>}
    </div>
  );
}
```

### Drag and Drop

```tsx
function DropZone({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const result = await uploadImage(file);
      onUpload(result.url);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={isDragging ? 'border-primary-500' : 'border-surface-200'}
    >
      Drop file here
    </div>
  );
}
```

---

## S3 Bucket Configuration

### CORS Policy

Apply this CORS configuration to your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://yourdomain.com"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Bucket Policy (Public Read)

For public assets bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### IAM Policy

Minimum permissions for the IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

---

## Error Handling

```typescript
try {
  const result = await uploadImage(file);
} catch (err) {
  if (err.message.includes('Invalid image type')) {
    // Show type error
  } else if (err.message.includes('size exceeds')) {
    // Show size error
  } else {
    // Generic upload error
  }
}
```

---

## Best Practices

1. **Validate on client** - Check file type/size before upload
2. **Show progress** - Use upload progress for large files
3. **Unique filenames** - Generated automatically to prevent collisions
4. **Cache headers** - Set `CacheControl` for better performance
5. **Clean up** - Delete unused files from S3
6. **Use CDN** - Consider CloudFront for faster delivery
7. **Compress images** - Resize/compress before upload for better performance
