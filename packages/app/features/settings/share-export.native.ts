import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

/**
 * Native: writes the export into the cache directory and opens the OS share
 * sheet. iOS shares the .json file itself (Files, AirDrop, Mail). Android's
 * Share API takes no file URL without a content provider (expo-sharing is
 * not installed), so it shares the JSON as text. Resolves false when the
 * sheet could not open; a dismissed sheet still counts as shown.
 */
export async function shareExport(json: string, fileName: string, title: string): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      await Share.share({ url: file.uri, title });
    } else {
      await Share.share({ message: json, title });
    }
    return true;
  } catch {
    return false;
  }
}
