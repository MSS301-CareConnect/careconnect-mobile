import '../../core/api_client.dart';
import '../../core/json.dart';
import '../../core/widgets.dart' show localDay;
import 'models.dart';

class VisitRepository {
  VisitRepository(this.api);
  final ApiClient api;
  Future<PageData<Visit>> list({
    int page = 0,
    DateTime? from,
    DateTime? to,
    String? status,
  }) async => PageData.fromJson(
    await api.get(
      '/booking-occurrences',
      query: {
        'page': page,
        'size': 20,
        if (from != null) 'from': localDay(from),
        if (to != null) 'to': localDay(to),
        'status': ?status,
      },
    ),
    Visit.fromJson,
  );
  Future<Visit> get(String id) async =>
      Visit.fromJson(object(await api.get('/booking-occurrences/$id')));
  Future<void> acknowledge(String id) async {
    await api.post('/booking-occurrences/$id/acknowledge');
  }

  Future<void> noShow(String id, String note) async {
    await api.post(
      '/booking-occurrences/$id/no-show-reports',
      data: {'note': note},
    );
  }

  Future<void> checkIn(String id, Json coordinates) async {
    await api.post(
      '/care-sessions',
      data: {'occurrenceId': id, ...coordinates},
    );
  }
}
