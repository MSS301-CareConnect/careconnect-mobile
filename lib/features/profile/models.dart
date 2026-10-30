import '../../core/json.dart';

class CaregiverProfile {
  CaregiverProfile.fromJson(Json j)
    : id = string(j['id']),
      centerId = string(j['centerId']),
      centerName = string(j['centerName']),
      fullName = string(j['fullName']),
      bio = string(j['bio']),
      status = string(j['caregiverStatus']),
      verification = string(j['verificationStatus']),
      experience = j['experienceYears'] as int?,
      rating = j['ratingAverage'] as num?,
      ratingCount = integer(j['ratingCount']);
  final String id, centerId, centerName, fullName, bio, status, verification;
  final int? experience;
  final num? rating;
  final int ratingCount;
}

class Certificate {
  Certificate.fromJson(Json j)
    : id = string(j['id']),
      name = string(j['certificateName']),
      issuedBy = string(j['issuedBy']),
      status = string(j['verificationStatus']),
      reason = string(j['verificationReason']);
  final String id, name, issuedBy, status, reason;
}
