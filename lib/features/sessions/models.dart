import '../../core/json.dart';

Json taskUpdate(String status, [String reason = '']) {
  if (status == 'SKIPPED' && reason.trim().isEmpty) {
    throw ArgumentError('Skip reason required');
  }
  return {
    'status': status,
    if (status == 'SKIPPED') 'skipReason': reason.trim(),
  };
}

class CareTask {
  CareTask.fromJson(Json j)
    : id = string(j['id']),
      title = string(j['title']),
      status = string(j['status']),
      skipReason = string(j['skipReason']),
      note = string(j['note']),
      scheduledTime = string(j['scheduledTime']);
  final String id, title, status, skipReason, note, scheduledTime;
}

class CareSession {
  CareSession.fromJson(Json j)
    : id = string(j['sessionId']),
      bookingId = string(j['bookingId']),
      status = string(j['status']),
      checkInAt = instant(j['checkInAt']),
      checkOutAt = instant(j['checkOutAt']),
      tasks = array(
        j['tasks'],
      ).map((v) => CareTask.fromJson(object(v))).toList();
  final String id, bookingId, status;
  final DateTime? checkInAt, checkOutAt;
  final List<CareTask> tasks;
  bool get active => status == 'IN_PROGRESS';
}

class SessionNote {
  SessionNote.fromJson(Json j)
    : content = string(j['content']),
      createdAt = instant(j['createdAt']),
      vitals = j['vitals'] == null
          ? const []
          : [
              for (final key in [
                'systolic',
                'diastolic',
                'heartRate',
                'temperature',
                'spo2',
                'bloodGlucose',
              ])
                if (object(j['vitals'])[key] is num)
                  (key, '${object(j['vitals'])[key]}'),
            ];
  final String content;
  final DateTime? createdAt;
  final List<(String, String)> vitals;
}
