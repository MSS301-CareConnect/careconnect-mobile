import '../../core/api_client.dart';
import '../../core/json.dart';
import 'models.dart';

class ReportRepository {
  ReportRepository(this.api);
  final ApiClient api;
  Future<CareReport?> find(String bookingId, String sessionId) async {
    final reports = await api.allPages(
      '/care-reports',
      CareReport.fromJson,
      query: {'bookingId': bookingId},
    );
    for (final report in reports) {
      if (report.sessionId == sessionId) return report;
    }
    return null;
  }

  Future<CareReport> save(CareReport report) async => CareReport.fromJson(
    object(
      await api.request(
        report.id.isEmpty ? 'POST' : 'PUT',
        report.id.isEmpty ? '/care-reports' : '/care-reports/${report.id}',
        data: report.toRequest(),
      ),
    ),
  );
  Future<CareReport> submit(String id) async =>
      CareReport.fromJson(object(await api.post('/care-reports/$id/submit')));
}
