// driveService.ts - Production Ready

export const listFolderContents = async (folderId: string, accessToken: string) => {
  // 1. Search for PDFs in the specific folder
  // "q" is the search query language for Google Drive
  const query = `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=100`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API Error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
};

export const downloadDriveFile = async (fileId: string, accessToken: string) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Download Error: ${response.status}`);
  }

  // Convert the file to Base64 so the AI can read it
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
