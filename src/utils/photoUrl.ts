const S3_HOST = /^https:\/\/tipwave-performer-media\.s3(?:\.[a-z0-9-]+)?\.amazonaws\.com\//i
const CLOUDFRONT = 'https://d7skwhqoj49or.cloudfront.net/'

/**
 * Profile photos are only served through CloudFront; the storage bucket itself is private.
 * Some photos were saved with the raw storage address, so translate it to the working one when showing a photo.
 */
export const photoSrc = <T extends string | null | undefined>(url: T): T =>
  (typeof url === 'string' ? url.replace(S3_HOST, CLOUDFRONT) : url) as T
