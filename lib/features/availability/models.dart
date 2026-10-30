import '../../core/json.dart';

class AvailabilitySchedule {
  AvailabilitySchedule.fromJson(Json j)
    : id = string(j['id']),
      date = string(j['workDate']),
      startTime = string(j['startTime']),
      endTime = string(j['endTime']),
      status = string(j['scheduleStatus']),
      note = string(j['note']),
      reason = string(j['cancellationReason']),
      version = integer(j['version']);
  final String id, date, startTime, endTime, status, note, reason;
  final int version;
}

class TimeOff {
  TimeOff.fromJson(Json j)
    : id = string(j['id']),
      start = instant(j['startAt'])!,
      end = instant(j['endAt'])!,
      reason = string(j['reason']);
  final String id, reason;
  final DateTime start, end;
}
