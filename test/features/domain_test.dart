import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/features/visits/models.dart';
import 'package:careconnect_mobile/features/sessions/models.dart';
import 'package:careconnect_mobile/features/reports/models.dart';
import 'package:careconnect_mobile/features/reports/repository.dart';
import 'package:careconnect_mobile/features/work_shifts/models.dart';
import 'package:careconnect_mobile/features/notifications/models.dart';
import '../core/api_client_test.dart' show FakeAdapter, MemoryTokens, body;

void main() {
  Visit visit([String status = 'SCHEDULED']) => Visit.fromJson({
    'id': 'o',
    'bookingId': 'b',
    'status': status,
    'startAt': '2026-10-30T03:00:00Z',
    'endAt': '2026-10-30T05:00:00Z',
    'customerPhone': '090****123',
  });
  test('check-in is allowed only inside inclusive 30 minute window', () {
    final v = visit();
    expect(v.canCheckIn(DateTime.parse('2026-10-30T02:29:59Z')), false);
    expect(v.canCheckIn(DateTime.parse('2026-10-30T02:30:00Z')), true);
    expect(v.canCheckIn(DateTime.parse('2026-10-30T03:30:00Z')), true);
    expect(v.canCheckIn(DateTime.parse('2026-10-30T03:30:01Z')), false);
    expect(
      visit('COMPLETED').canCheckIn(DateTime.parse('2026-10-30T03:00:00Z')),
      false,
    );
    expect(v.startAt.toUtc(), DateTime.utc(2026, 10, 30, 3));
    expect(v.callablePhone, isNull);
  });
  test(
    'skipping a task requires a reason but resetting clears skip fields',
    () {
      expect(() => taskUpdate('SKIPPED', ''), throwsArgumentError);
      expect(taskUpdate('SKIPPED', 'Không phù hợp'), {
        'status': 'SKIPPED',
        'skipReason': 'Không phù hợp',
      });
      expect(taskUpdate('PENDING'), {'status': 'PENDING'});
    },
  );
  test(
    'report fields preserve version, condition has no default and submitted is locked',
    () {
      final draft = CareReport.fromJson({
        'id': 'r',
        'sessionId': 's',
        'status': 'DRAFT',
        'version': 3,
        'overallCondition': 'DECLINED',
        'summary': 'Observed',
        'mealNotes': 'Meal',
      });
      expect(draft.editable, true);
      expect(draft.toRequest()['version'], 3);
      expect(draft.toRequest()['overallCondition'], 'DECLINED');
      expect(CareReport.empty('s').condition, isEmpty);
      expect(CareReport.fromJson({'status': 'SUBMITTED'}).editable, false);
    },
  );
  test('report lookup traverses pages to find the correct session', () async {
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          final page = o.queryParameters['page'];
          expect(o.queryParameters['bookingId'], 'b');
          return body({
            'items': [
              {
                'id': page == 0 ? 'other' : 'target',
                'sessionId': page == 0 ? 's0' : 's1',
                'status': 'DRAFT',
              },
            ],
            'page': page,
            'totalPages': 2,
            'totalElements': 2,
          });
        }),
      store: MemoryTokens(),
    );
    final report = await ReportRepository(api).find('b', 's1');
    expect(report?.id, 'target');
  });
  test(
    'shift registration respects deadline, shift status and all active registrations',
    () {
      final shift = WorkShift.fromJson({
        'id': 'w',
        'workDate': '2099-10-30',
        'startTime': '10:00:00',
        'endTime': '12:00:00',
        'shiftStatus': 'OPEN',
        'registrationDeadline': '2026-10-30T03:00:00Z',
      });
      expect(shift.canRegister(DateTime.utc(2026, 10, 30, 2), []), true);
      expect(shift.canRegister(DateTime.utc(2026, 10, 30, 3), []), false);
      final registration = ShiftRegistration.fromJson({
        'id': 'r',
        'workShiftId': 'w',
        'registrationStatus': 'APPROVED',
        'version': 7,
      });
      expect(
        shift.canRegister(DateTime.utc(2026, 10, 30, 2), [registration]),
        false,
      );
      expect(registration.cancelQuery, {'version': 7});
      expect(registration.canCancel, false);
      expect(
        ShiftRegistration.fromJson({'registrationStatus': 'PENDING'}).canCancel,
        true,
      );
    },
  );
  test('notification never opens arbitrary ref URL or customer routes', () {
    expect(
      AppNotification.fromJson({
        'refType': 'OCCURRENCE',
        'refId': '123e4567-e89b-12d3-a456-426614174000',
      }).target,
      '/visits/123e4567-e89b-12d3-a456-426614174000',
    );
    expect(
      AppNotification.fromJson({
        'refType': 'URL',
        'refId': 'https://evil.test',
      }).target,
      isNull,
    );
    expect(
      AppNotification.fromJson({
        'refType': 'OCCURRENCE',
        'refId': '../../login',
      }).target,
      isNull,
    );
  });
}
