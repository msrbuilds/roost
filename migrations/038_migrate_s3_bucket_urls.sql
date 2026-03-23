-- Migration: Update S3 URLs from old bucket to new bucket
-- Old: https://build-with-msr.s3.ap-southeast-1.amazonaws.com
-- New: https://cdn-lestvibeit.s3.us-east-2.amazonaws.com

BEGIN;

-- 1. profiles.avatar_url
UPDATE profiles
SET avatar_url = REPLACE(avatar_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE avatar_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 2. groups.avatar_url
UPDATE groups
SET avatar_url = REPLACE(avatar_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE avatar_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 3. groups.cover_url
UPDATE groups
SET cover_url = REPLACE(cover_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE cover_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 4. assets.file_url
UPDATE assets
SET file_url = REPLACE(file_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE file_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 5. showcase_images.image_url
UPDATE showcase_images
SET image_url = REPLACE(image_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE image_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 6. showcases.thumbnail_url
UPDATE showcases
SET thumbnail_url = REPLACE(thumbnail_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE thumbnail_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

-- 7. activation_products.icon_url
UPDATE activation_products
SET icon_url = REPLACE(icon_url, 'https://build-with-msr.s3.ap-southeast-1.amazonaws.com', 'https://cdn-lestvibeit.s3.us-east-2.amazonaws.com')
WHERE icon_url LIKE '%build-with-msr.s3.ap-southeast-1.amazonaws.com%';

COMMIT;
