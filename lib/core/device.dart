import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api_client.dart';
import 'json.dart';

Future<Json> optionalCoordinates() async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return {};
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission != LocationPermission.always &&
        permission != LocationPermission.whileInUse) {
      return {};
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 8),
      ),
    );
    return {'latitude': pos.latitude, 'longitude': pos.longitude};
  } catch (_) {
    return {};
  }
}

Future<void> openPhone(String phone) async {
  if (!await launchUrl(Uri(scheme: 'tel', path: phone))) {
    throw const ApiFailure('external');
  }
}

Future<void> openDownload(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null ||
      uri.scheme != 'https' ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty) {
    throw const ApiFailure('invalidResponse');
  }
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    throw const ApiFailure('external');
  }
}
