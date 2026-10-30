import '../../core/json.dart';

class AppNotification {
  AppNotification.fromJson(Json j)
    : id = string(j['id']),
      title = string(j['title']),
      body = string(j['body']),
      refType = string(j['refType']),
      refId = string(j['refId']),
      read = j['readAt'] != null,
      createdAt = instant(j['createdAt']);
  final String id, title, body, refType, refId;
  final bool read;
  final DateTime? createdAt;
  String? get target {
    if (!RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(refId)) {
      return null;
    }
    return ['OCCURRENCE', 'BOOKING_OCCURRENCE'].contains(refType)
        ? '/visits/$refId'
        : null;
  }
}
