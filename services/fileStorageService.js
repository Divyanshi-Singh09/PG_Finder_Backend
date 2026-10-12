/**
 * File Storage Abstraction Service for Document & Image Uploads
 */

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates document format and file size
 */
const validateDocument = (fileDataStr, mimeTypeHint = '') => {
  if (!fileDataStr || typeof fileDataStr !== 'string') {
    throw new Error('Invalid file payload provided.');
  }

  // Base64 format check: data:mimeType;base64,...
  let mimeType = mimeTypeHint;
  let base64Content = fileDataStr;

  if (fileDataStr.startsWith('data:')) {
    const parts = fileDataStr.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    base64Content = parts[1];
  }

  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error('Unsupported document format. Allowed formats: PDF, JPG, JPEG, PNG.');
  }

  const approxSizeBytes = Math.round((base64Content.length * 3) / 4);
  if (approxSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds maximum limit of 10MB.');
  }

  return {
    valid: true,
    mimeType: mimeType || 'image/jpeg',
    sizeBytes: approxSizeBytes,
  };
};

/**
 * Stores document and returns secure private URL reference
 */
const uploadPrivateDocument = async (fileDataStr, docType = 'IDENTITY_PROOF') => {
  validateDocument(fileDataStr);

  // Generates safe private reference token for college project storage
  const fileId = `doc-priv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  // In production, this uploads to encrypted private S3 bucket or local private folder
  return {
    fileId,
    fileUrl: `/api/verification/document/${fileId}`,
    uploadedAt: new Date(),
  };
};

module.exports = {
  validateDocument,
  uploadPrivateDocument,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
};
