import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:careconnect_mobile/core/api_client.dart';
import 'package:careconnect_mobile/core/validation.dart';
import 'package:careconnect_mobile/features/visits/repository.dart';
import 'package:careconnect_mobile/features/reports/models.dart';
import 'package:careconnect_mobile/features/reports/repository.dart';
import '../core/api_client_test.dart' show FakeAdapter, MemoryTokens, body;

void main() {
  test('password limits match backend UTF-8 BCrypt byte limit', () {
    expect(strongPassword('Abcdef1!'), true);
    expect(strongPassword('Abcdef1!${List.filled(33, 'ệ').join()}'), false);
    expect(strongPassword('abcdefgh'), false);
  });
  test('visit actions send only documented caregiver payloads', () async {
    final requests = <RequestOptions>[];
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          requests.add(o);
          return body(null);
        }),
      store: MemoryTokens(),
    );
    final repo = VisitRepository(api);
    await repo.acknowledge('o');
    await repo.noShow('o', 'Đã liên hệ người nhà');
    await repo.checkIn('o', {'latitude': 10.8, 'longitude': 106.7});
    expect(requests[0].path, '/api/v1/booking-occurrences/o/acknowledge');
    expect(requests[1].data, {'note': 'Đã liên hệ người nhà'});
    expect(requests[2].data, {
      'occurrenceId': 'o',
      'latitude': 10.8,
      'longitude': 106.7,
    });
  });
  test('report update preserves notes and optimistic version', () async {
    final api = ApiClient(
      dio: Dio()
        ..httpClientAdapter = FakeAdapter((o) {
          expect(o.method, 'PUT');
          expect(o.path, '/api/v1/care-reports/r');
          expect(o.data, {
            'sessionId': 's',
            'overallCondition': 'NEEDS_ATTENTION',
            'summary': 'Needs review',
            'mealNotes': 'Meal',
            'medicationNotes': 'Medicine',
            'mobilityNotes': 'Walk',
            'moodNotes': 'Calm',
            'recommendations': 'Contact family',
            'version': 5,
          });
          return body({
            'id': 'r',
            'sessionId': 's',
            'status': 'DRAFT',
            'version': 6,
            'overallCondition': 'NEEDS_ATTENTION',
            'summary': 'Needs review',
          });
        }),
      store: MemoryTokens(),
    );
    final report = await ReportRepository(api).save(
      CareReport.fromJson({
        'id': 'r',
        'sessionId': 's',
        'status': 'DRAFT',
        'overallCondition': 'NEEDS_ATTENTION',
        'summary': 'Needs review',
        'mealNotes': 'Meal',
        'medicationNotes': 'Medicine',
        'mobilityNotes': 'Walk',
        'moodNotes': 'Calm',
        'recommendations': 'Contact family',
        'version': 5,
      }),
    );
    expect(report.version, 6);
  });
}
