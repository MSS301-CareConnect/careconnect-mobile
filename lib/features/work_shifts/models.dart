import '../../core/json.dart';

class WorkShift {
  WorkShift.fromJson(Json j)
    : id = string(j['id']),
      centerId = string(j['centerId']),
      centerName = string(j['centerName']),
      date = string(j['workDate']),
      startTime = string(j['startTime']),
      endTime = string(j['endTime']),
      status = string(j['shiftStatus']),
      note = string(j['note']),
      deadline = instant(j['registrationDeadline']),
      capacity = integer(j['capacity']),
      approved = integer(j['approvedCount']);
  final String id, centerId, centerName, date, startTime, endTime, status, note;
  final DateTime? deadline;
  final int capacity, approved;
  // ProviderService uses Asia/Ho_Chi_Minh (UTC+07), independently of device timezone.
  DateTime get startInstant => DateTime.parse('${date}T$startTime+07:00');
  bool canRegister(DateTime now, List<ShiftRegistration> registrations) =>
      status == 'OPEN' &&
      now.isBefore(startInstant) &&
      (deadline == null || now.isBefore(deadline!)) &&
      !registrations.any((r) => r.shiftId == id && r.active);
}

class ShiftRegistration {
  ShiftRegistration.fromJson(Json j)
    : id = string(j['id']),
      shiftId = string(j['workShiftId']),
      status = string(j['registrationStatus']),
      note = string(j['caregiverNote']),
      reason = string(j['rejectionReason']),
      version = integer(j['version']);
  final String id, shiftId, status, note, reason;
  final int version;
  bool get active => status == 'PENDING' || status == 'APPROVED';
  bool get canCancel => status == 'PENDING';
  Json get cancelQuery => {'version': version};
}
