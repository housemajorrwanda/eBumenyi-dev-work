import api from "./api";

// Types matching your backend response
export interface FileUploadResponse {
  statusCode: number;
  message: string;
  data: {
    url: string;
    publicId: string;
    originalName: string;
    size: number;
    format: string;
  } | null;
}

export interface MultipleFileUploadResponse {
  statusCode: number;
  message: string;
  data: Array<{
    url: string;
    publicId: string;
    originalName: string;
    size: number;
    format: string;
    fieldName: string;
  }>;
}

// Upload single file
export const uploadSingleFile = async (file: File): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload/single', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload video file
export const uploadVideoFile = async (file: File): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('video', file);

  const response = await api.post('/upload/video', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload multiple files
export const uploadMultipleFiles = async (files: File[]): Promise<MultipleFileUploadResponse> => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await api.post('/upload/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload files with any field names
export const uploadAnyFiles = async (files: { file: File; fieldName: string }[]): Promise<MultipleFileUploadResponse> => {
  const formData = new FormData();
  files.forEach(({ file, fieldName }) => {
    formData.append(fieldName, file);
  });

  const response = await api.post('/upload/any', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload image file specifically
export const uploadImage = async (file: File): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload document file specifically
export const uploadDocument = async (file: File): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('document', file);

  const response = await api.post('/upload/document', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Upload audio file specifically (voice notes)
export const uploadAudio = async (file: File | Blob, fileName = 'voice-note.webm'): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append('audio', file, fileName);

  const response = await api.post('/upload/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Get a signed (time-limited) URL for a Cloudinary asset — needed for raw/authenticated files
export const getSignedUrl = async (url: string): Promise<string> => {
  const response = await api.get('/upload/sign', { params: { url } });
  return response.data.signedUrl as string;
};

// Return a proxy URL that streams the Cloudinary asset through the API server.
// Use this for PDFs/raw files that return 401 when accessed directly.
export const getProxyUrl = (url: string): string => {
  const base = api.defaults.baseURL ?? '';
  return `${base}/upload/proxy?url=${encodeURIComponent(url)}`;
};

// Helper function to determine upload type based on file
export const uploadFileByType = async (file: File): Promise<FileUploadResponse> => {
  if (!file.type) {
    throw new Error('File type is undefined');
  }
  
  if (file.type.startsWith('image/')) {
    return uploadImage(file);
  } else if (file.type.startsWith('video/')) {
    return uploadVideoFile(file);
  } else if (file.type.startsWith('audio/')) {
    return uploadAudio(file, file.name);
  } else if (
    file.type === 'application/pdf' ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/vnd.ms-powerpoint' ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.type === 'text/plain'
  ) {
    return uploadDocument(file);
  } else {
    return uploadSingleFile(file);
  }
};
