import '../../core/json.dart';

class Visit {
  Visit.fromJson(Json j)
    : id = string(j['id']),
      bookingId = string(j['bookingId']),
      bookingCode = string(j['bookingCode']),
      recipientName = string(j['recipientName']),
      status = string(j['status']),
      startAt = instant(j['startAt'])!,
      endAt = instant(j['endAt'])!,
      address = string(j['serviceAddress']),
      customerNote = string(j['customerNote']),
      customerPhone = string(j['customerPhone']),
      sessionId = j['sessionId'] as String?,
      noShowReported = j['noShowReportedAt'] != null,
      services = array(
        j['services'],
      ).map((v) => string(object(v)['serviceName'])).toList(),
      recipient = j['recipientSnapshot'] == null
          ? null
          : RecipientSnapshot.fromJson(object(j['recipientSnapshot'])),
      specialNotes = j['specialNotes'] == null
          ? const []
          : careInfo(object(j['specialNotes']));
  final String id,
      bookingId,
      bookingCode,
      recipientName,
      status,
      address,
      customerNote,
      customerPhone;
  final DateTime startAt, endAt;
  final String? sessionId;
  final bool noShowReported;
  final List<String> services;
  final RecipientSnapshot? recipient;
  final List<(String, String)> specialNotes;
  bool get waiting =>
      (status == 'SCHEDULED' || status == 'ACKNOWLEDGED') &&
      sessionId == null &&
      !noShowReported;
  bool canCheckIn(DateTime now) =>
      waiting &&
      !now.isBefore(startAt.subtract(const Duration(minutes: 30))) &&
      !now.isAfter(startAt.add(const Duration(minutes: 30)));
  String? get callablePhone => callableNumber(customerPhone);
}

String? callableNumber(String phone) =>
    RegExp(r'^\+?[0-9][0-9\s()-]{7,18}$').hasMatch(phone)
    ? phone.replaceAll(RegExp(r'[\s()-]'), '')
    : null;
List<(String, String)> careInfo(Json j) => [
  for (final (key, label) in [
    ('allergies', 'allergy'),
    ('chronicConditions', 'chronicConditions'),
    ('careRequirements', 'careRequirements'),
    ('dietaryNotes', 'dietaryNotes'),
    ('behaviorNotes', 'behaviorNotes'),
  ])
    if (string(j[key]).isNotEmpty) (label, string(j[key])),
];

class RecipientSnapshot {
  RecipientSnapshot.fromJson(Json j)
    : name = string(j['fullName']),
      age = j['age'] is num ? integer(j['age']) : null,
      info = careInfo(j),
      medications = array(j['activeMedications']).map((e) {
        final m = object(e);
        return [
          string(m['medicationName']),
          string(m['dosage']),
          string(m['frequency']),
          array(m['timeOfDay']).map((e) => string(e)).join(', '),
          string(m['usageNotes']),
        ].where((v) => v.isNotEmpty).join(' · ');
      }).toList(),
      emergencyName = j['primaryEmergencyContact'] == null
          ? ''
          : string(object(j['primaryEmergencyContact'])['fullName']),
      emergencyPhone = j['primaryEmergencyContact'] == null
          ? ''
          : string(object(j['primaryEmergencyContact'])['phoneNumber']);
  final String name, emergencyName, emergencyPhone;
  final int? age;
  final List<(String, String)> info;
  final List<String> medications;
}
