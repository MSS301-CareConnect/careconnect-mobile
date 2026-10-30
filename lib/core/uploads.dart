import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'api_client.dart';
import 'json.dart';

class PickedUpload {
  PickedUpload(this.path, this.name, this.mime);
  final String path, name, mime;
  Future<FormData> form() async => FormData.fromMap({
    'files': [
      await MultipartFile.fromFile(
        path,
        filename: name,
        contentType: DioMediaType.parse(mime),
      ),
    ],
  });
}

Future<PickedUpload?> pickUpload({
  bool certificate = false,
  bool avatar = false,
}) async {
  final extensions = certificate
      ? ['pdf', 'jpg', 'jpeg', 'png']
      : ['jpg', 'jpeg', 'png', 'webp'];
  final result = await FilePicker.pickFiles(
    type: FileType.custom,
    allowedExtensions: extensions,
  );
  if (result.isEmpty) return null;
  final file = result.single, ext = result.single.extension?.toLowerCase();
  final size = await file.length();
  if (file.path == null ||
      size == null ||
      size > (avatar ? 5 : 10) * 1024 * 1024 ||
      !extensions.contains(ext)) {
    throw ApiFailure(avatar ? 'fileAvatar' : 'file');
  }
  final mime = switch (ext) {
    'pdf' => 'application/pdf',
    'png' => 'image/png',
    'webp' => 'image/webp',
    _ => 'image/jpeg',
  };
  return PickedUpload(file.path!, file.name, mime);
}

class MediaFile {
  MediaFile.fromJson(Json j)
    : id = string(j['mediaFileId']),
      name = string(j['originalFileName']),
      url = string(j['downloadUrl']),
      type = string(j['contentType']);
  final String id, name, url, type;
}
