import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';

export type PickedDocument = { uri: string; name: string; mimeType?: string; size?: number };
type DocumentSelection =
  { canceled: true; assets: null } | { canceled: false; assets: PickedDocument[] };

export async function pickDocuments(options: {
  type: string[];
  multiple: boolean;
}): Promise<DocumentSelection> {
  try {
    const files = await pick({
      type: options.type,
      allowMultiSelection: options.multiple,
      mode: 'open',
      requestLongTermAccess: false,
      allowVirtualFiles: false,
    });
    const assets = files.map((file): PickedDocument => {
      if (file.error || !file.uri || !file.name || !file.hasRequestedType || file.isVirtual)
        throw new Error('Invalid selected document metadata');
      return {
        uri: file.uri,
        name: file.name,
        ...(file.type === null ? {} : { mimeType: file.type }),
        ...(file.size === null ? {} : { size: file.size }),
      };
    });
    return { canceled: false, assets };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
      return { canceled: true, assets: null };
    throw error;
  }
}
