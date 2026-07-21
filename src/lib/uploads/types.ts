export type UploadListItem = {
  id: string;
  themeId: string;
  fileName: string;
  status: string;
  accepted: number;
  rejected: number;
  duplicates: number;
  schemaVersion: number;
  createdAt: string;
  finishedAt: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
  errorCount: number;
};
