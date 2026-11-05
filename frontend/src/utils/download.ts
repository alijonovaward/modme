import { apiClient } from "../api/client";

export async function downloadXlsx(
  url: string,
  params: Record<string, unknown> | undefined,
  filename: string,
): Promise<void> {
  const response = await apiClient.get(url, { params, responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}
