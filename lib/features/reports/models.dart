import '../../core/json.dart';

class ReportPhoto {
  ReportPhoto.fromJson(Json j)
    : id = string(j['mediaFileId']),
      url = string(j['downloadUrl']);
  final String id, url;
}

class CareReport {
  CareReport.fromJson(Json j)
    : id = string(j['id']),
      sessionId = string(j['sessionId']),
      status = string(j['status'], 'DRAFT'),
      condition = string(j['overallCondition']),
      version = j['version'] as int?,
      summary = string(j['summary']),
      mealNotes = string(j['mealNotes']),
      medicationNotes = string(j['medicationNotes']),
      mobilityNotes = string(j['mobilityNotes']),
      moodNotes = string(j['moodNotes']),
      recommendations = string(j['recommendations']),
      photos = array(
        j['photos'],
      ).map((v) => ReportPhoto.fromJson(object(v))).toList();
  factory CareReport.empty(String sessionId) =>
      CareReport.fromJson({'sessionId': sessionId});
  final String id,
      sessionId,
      status,
      condition,
      summary,
      mealNotes,
      medicationNotes,
      mobilityNotes,
      moodNotes,
      recommendations;
  final int? version;
  final List<ReportPhoto> photos;
  bool get editable => status == 'DRAFT';
  Json toRequest() => {
    'sessionId': sessionId,
    'overallCondition': condition,
    'summary': summary,
    'mealNotes': mealNotes,
    'medicationNotes': medicationNotes,
    'mobilityNotes': mobilityNotes,
    'moodNotes': moodNotes,
    'recommendations': recommendations,
    if (version != null) 'version': version,
  };
}
