
/**
 * DriveService handles interaction with the Google Drive API.
 * Note: Requires valid OAuth2 token from the frontend.
 */

export const listFolderContents = async (folderId: string, accessToken: string) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name)&key=${process.env.API_KEY}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to list Drive folder contents');
  }
  
  const data = await response.json();
  return data.files as { id: string; name: string }[];
};

export const downloadDriveFile = async (fileId: string, accessToken: string): Promise<string> => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download file ${fileId}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
