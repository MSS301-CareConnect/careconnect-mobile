import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    _load();
    return const Locale('vi');
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('language');
    if (ref.mounted && saved == 'en') state = const Locale('en');
  }

  Future<void> toggle() async {
    state = Locale(state.languageCode == 'vi' ? 'en' : 'vi');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('language', state.languageCode);
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

extension Copy on BuildContext {
  String t(String key) {
    final pair = _copy[key];
    if (pair == null) return key;
    return Localizations.localeOf(this).languageCode == 'vi'
        ? pair.$1
        : pair.$2;
  }

  String errorText(Object error) {
    if (error is! ApiFailure) return t('error.generic');
    if (error.kind == 'caregiverOnly') return t('error.role');
    if (error.kind == 'network') return t('error.network');
    if (error.kind == 'file') return t('fileInvalid');
    if (error.kind == 'fileAvatar') return t('avatarInvalid');
    if (error.kind == 'invalidResponse') return t('error.response');
    if (error.status == 401) return t('error.auth');
    if (error.status == 403) return t('error.forbidden');
    if (error.status == 409) return t('error.conflict');
    if (error.status == 429) return t('error.rate');
    if (error.status == 400) {
      return '${t('error.invalid')}${error.code == null ? '' : ' (${error.code})'}';
    }
    return '${t('error.generic')}${error.code == null ? '' : ' (${error.code})'}';
  }
}

const _copy = <String, (String, String)>{
  'avatarInvalid': (
    'Ảnh đại diện cần là JPEG/PNG/WebP, tối đa 5 MB.',
    'Use a JPEG/PNG/WebP profile photo up to 5 MB.',
  ),
  'reportAfterEnd': (
    'Kết thúc ca trước khi gửi báo cáo. Bạn vẫn có thể lưu nháp.',
    'End the session before submitting. You can still save a draft.',
  ),
  'app': ('CareConnect', 'CareConnect'),
  'caregiver': ('Người chăm sóc', 'Caregiver'),
  'welcome': ('Chào mừng trở lại', 'Welcome back'),
  'loginIntro': (
    'Đồng hành cùng bạn trong từng ca chăm sóc.',
    'Here for you, through every care visit.',
  ),
  'email': ('Email', 'Email'),
  'password': ('Mật khẩu', 'Password'),
  'login': ('Đăng nhập', 'Sign in'),
  'forgot': ('Quên mật khẩu?', 'Forgot password?'),
  'accountProvided': (
    'Sử dụng tài khoản do trung tâm cung cấp.',
    'Use the account provided by your care center.',
  ),
  'emailInvalid': (
    'Vui lòng nhập email hợp lệ.',
    'Enter a valid email address.',
  ),
  'required': ('Vui lòng nhập thông tin.', 'This field is required.'),
  'passwordRules': (
    'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.',
    'At least 8 characters with uppercase, lowercase, number and special character.',
  ),
  'passwordMismatch': (
    'Mật khẩu xác nhận chưa khớp.',
    'Passwords do not match.',
  ),
  'confirmPassword': ('Xác nhận mật khẩu', 'Confirm password'),
  'showPassword': ('Hiện/ẩn mật khẩu', 'Show/hide password'),
  'recovery': ('Khôi phục mật khẩu', 'Password recovery'),
  'sendCode': ('Gửi mã xác nhận', 'Send verification code'),
  'otp': ('Mã OTP 6 chữ số', '6-digit verification code'),
  'otpInvalid': ('Nhập đủ 6 chữ số.', 'Enter all 6 digits.'),
  'newPassword': ('Mật khẩu mới', 'New password'),
  'resetPassword': ('Đặt lại mật khẩu', 'Reset password'),
  'codeSent': (
    'Nếu email hợp lệ, mã xác nhận đã được gửi. Kiểm tra hộp thư của bạn.',
    'If eligible, a verification code has been sent. Check your inbox.',
  ),
  'resetDone': (
    'Đã đặt lại mật khẩu. Vui lòng đăng nhập.',
    'Password reset. Please sign in.',
  ),
  'retry': ('Thử lại', 'Try again'),
  'loading': ('Đang tải…', 'Loading…'),
  'error.generic': (
    'Không thể hoàn tất thao tác. Vui lòng thử lại.',
    'Could not complete this action. Please try again.',
  ),
  'error.network': (
    'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.',
    'Cannot reach the server. Check your connection and try again.',
  ),
  'error.response': (
    'Dữ liệu máy chủ không đúng định dạng.',
    'The server returned an unexpected response.',
  ),
  'error.role': (
    'Ứng dụng dành cho tài khoản caregiver đang hoạt động.',
    'An active caregiver account is required.',
  ),
  'error.auth': (
    'Thông tin đăng nhập không hợp lệ hoặc phiên đã hết hạn.',
    'Invalid credentials or your session has expired.',
  ),
  'error.forbidden': (
    'Bạn không có quyền thực hiện thao tác này.',
    'You do not have permission for this action.',
  ),
  'error.conflict': (
    'Dữ liệu đã thay đổi. Tải lại trước khi tiếp tục.',
    'The data has changed. Reload before continuing.',
  ),
  'error.rate': (
    'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    'Too many requests. Please try again later.',
  ),
  'error.invalid': (
    'Thông tin hoặc trạng thái hiện tại chưa hợp lệ.',
    'The information or current state is not valid.',
  ),
  'visits': ('Buổi được giao', 'Visits'),
  'availability': ('Lịch rảnh', 'Availability'),
  'shifts': ('Ca làm việc', 'Work shifts'),
  'profile': ('Hồ sơ', 'Profile'),
  'notifications': ('Thông báo', 'Notifications'),
  'hello': ('Một ngày chăm sóc tận tâm', 'A day of thoughtful care'),
  'visitsIntro': (
    'Lịch trình của bạn, sự an tâm của gia đình.',
    'Your schedule. Their peace of mind.',
  ),
  'today': ('Hôm nay', 'Today'),
  'dateRange': ('Chọn khoảng ngày', 'Choose dates'),
  'allDates': ('Mọi ngày', 'All dates'),
  'all': ('Tất cả', 'All'),
  'refresh': ('Tải lại', 'Refresh'),
  'empty': ('Chưa có dữ liệu.', 'Nothing here yet.'),
  'noVisits': (
    'Chưa có buổi chăm sóc trong khoảng này.',
    'No visits in this period.',
  ),
  'previous': ('Trước', 'Previous'),
  'next': ('Tiếp', 'Next'),
  'page': ('Trang', 'Page'),
  'visitDetail': ('Chi tiết buổi chăm sóc', 'Visit details'),
  'recipient': ('Người cần chăm sóc', 'Care recipient'),
  'address': ('Địa chỉ chăm sóc', 'Care address'),
  'services': ('Dịch vụ', 'Services'),
  'customerNote': ('Lời nhắn của gia đình', 'Family note'),
  'health': ('Thông tin chăm sóc', 'Care information'),
  'snapshotHidden': (
    'Thông tin chi tiết chưa được cung cấp cho buổi này.',
    'Detailed information is not available for this visit.',
  ),
  'phone': ('Số điện thoại', 'Phone number'),
  'call': ('Gọi người thân', 'Call family'),
  'acknowledge': ('Xác nhận nhận ca', 'Acknowledge visit'),
  'checkIn': ('Bắt đầu ca', 'Check in'),
  'checkInHint': (
    'Check-in từ 30 phút trước đến 30 phút sau giờ bắt đầu.',
    'Check in from 30 minutes before until 30 minutes after the start.',
  ),
  'noShow': ('Báo khách vắng mặt', 'Report customer no-show'),
  'noShowPending': (
    'Đã báo khách vắng mặt. Đang chờ trung tâm xử lý.',
    'No-show reported. Awaiting your center’s decision.',
  ),
  'reason': ('Lý do', 'Reason'),
  'reasonShort': (
    'Vui lòng nhập ít nhất 10 ký tự.',
    'Enter at least 10 characters.',
  ),
  'confirm': ('Xác nhận', 'Confirm'),
  'cancel': ('Hủy', 'Cancel'),
  'save': ('Lưu', 'Save'),
  'saved': ('Đã lưu thành công.', 'Saved successfully.'),
  'back': ('Quay lại', 'Back'),
  'continue': ('Tiếp tục', 'Continue'),
  'session': ('Ca chăm sóc', 'Care session'),
  'checklist': ('Công việc chăm sóc', 'Care checklist'),
  'done': ('Hoàn thành', 'Done'),
  'skip': ('Bỏ qua', 'Skip'),
  'undo': ('Hoàn tác', 'Undo'),
  'addTask': ('Thêm công việc', 'Add task'),
  'taskTitle': ('Tên công việc', 'Task title'),
  'notes': ('Ghi chú trong ca', 'Session notes'),
  'addNote': ('Thêm ghi chú', 'Add note'),
  'content': ('Nội dung', 'Content'),
  'vitals': ('Chỉ số sinh tồn (không bắt buộc)', 'Vitals (optional)'),
  'systolic': ('Huyết áp tâm thu (mmHg)', 'Systolic (mmHg)'),
  'diastolic': ('Huyết áp tâm trương (mmHg)', 'Diastolic (mmHg)'),
  'heartRate': ('Nhịp tim (bpm)', 'Heart rate (bpm)'),
  'temperature': ('Nhiệt độ (°C)', 'Temperature (°C)'),
  'spo2': ('SpO₂ (%)', 'SpO₂ (%)'),
  'bloodGlucose': ('Đường huyết', 'Blood glucose'),
  'invalidNumber': ('Giá trị không hợp lệ.', 'Enter a valid value.'),
  'checkOut': ('Kết thúc ca', 'Check out'),
  'checkOutConfirm': (
    'Xác nhận kết thúc ca chăm sóc này?',
    'End this care session?',
  ),
  'sessionClosed': (
    'Ca đã kết thúc. Thông tin ca chỉ có thể xem.',
    'This session has ended. Session information is read only.',
  ),
  'report': ('Báo cáo chăm sóc', 'Care report'),
  'condition': ('Tình trạng tổng quát', 'Overall condition'),
  'summary': ('Tóm tắt ca chăm sóc', 'Care summary'),
  'mealNotes': ('Ăn uống', 'Meals'),
  'medicationNotes': ('Dùng thuốc', 'Medication'),
  'mobilityNotes': ('Vận động', 'Mobility'),
  'moodNotes': ('Tâm trạng', 'Mood'),
  'recommendations': ('Khuyến nghị', 'Recommendations'),
  'saveDraft': ('Lưu nháp', 'Save draft'),
  'submitReport': ('Gửi báo cáo', 'Submit report'),
  'reportHint': (
    'Lưu nháp để tiếp tục bổ sung. Báo cáo đã gửi không thể chỉnh sửa.',
    'Save a draft to continue later. Submitted reports cannot be edited.',
  ),
  'submitConfirm': (
    'Gửi báo cáo cho gia đình và trung tâm? Sau khi gửi bạn không thể chỉnh sửa.',
    'Share this report with the family and center? It cannot be edited after submission.',
  ),
  'photos': ('Ảnh đính kèm', 'Photos'),
  'addPhoto': ('Thêm ảnh', 'Add photo'),
  'remove': ('Xóa', 'Remove'),
  'saveBeforePhoto': (
    'Lưu nháp trước khi thêm ảnh.',
    'Save a draft before attaching photos.',
  ),
  'fileInvalid': (
    'File không được hỗ trợ hoặc quá 10 MB.',
    'Unsupported file or larger than 10 MB.',
  ),
  'availabilityIntro': (
    'Khung giờ có thể nhận lịch từ trung tâm.',
    'Time windows available for center assignments.',
  ),
  'timeOff': ('Khoảng nghỉ', 'Time off'),
  'addTimeOff': ('Thêm khoảng nghỉ', 'Add time off'),
  'start': ('Bắt đầu', 'Start'),
  'end': ('Kết thúc', 'End'),
  'invalidInterval': (
    'Thời gian kết thúc phải sau bắt đầu.',
    'End time must be after start time.',
  ),
  'cancelSchedule': ('Hủy lịch rảnh', 'Cancel availability'),
  'deleteConfirm': ('Xác nhận thực hiện thao tác này?', 'Confirm this action?'),
  'openShifts': ('Ca đang mở', 'Open shifts'),
  'myRegistrations': ('Đăng ký của tôi', 'My registrations'),
  'registerShift': ('Đăng ký ca', 'Register for shift'),
  'cancelRegistration': ('Hủy đăng ký', 'Cancel registration'),
  'registrationNote': (
    'Ghi chú đăng ký (không bắt buộc)',
    'Registration note (optional)',
  ),
  'deadline': ('Hạn đăng ký', 'Registration deadline'),
  'capacity': ('Số người được duyệt', 'Approved places'),
  'registered': ('Đã đăng ký', 'Registered'),
  'closed': ('Đã đóng đăng ký', 'Registration closed'),
  'professional': ('Hồ sơ chuyên môn', 'Professional profile'),
  'center': ('Trung tâm', 'Care center'),
  'experience': ('Số năm kinh nghiệm', 'Years of experience'),
  'rating': ('Đánh giá trung bình', 'Average rating'),
  'skills': ('Chuyên môn', 'Skills'),
  'certificates': ('Chứng chỉ', 'Certificates'),
  'addCertificate': ('Thêm chứng chỉ', 'Add certificate'),
  'certificateName': ('Tên chứng chỉ', 'Certificate name'),
  'issuedBy': ('Đơn vị cấp', 'Issued by'),
  'chooseFile': ('Chọn ảnh/PDF', 'Choose image/PDF'),
  'upload': ('Tải lên', 'Upload'),
  'retryUpload': ('Thử tải file lại', 'Retry file upload'),
  'avatar': ('Ảnh đại diện', 'Profile photo'),
  'account': ('Thông tin tài khoản', 'Account'),
  'fullName': ('Họ và tên', 'Full name'),
  'changePassword': ('Đổi mật khẩu', 'Change password'),
  'currentPassword': ('Mật khẩu hiện tại', 'Current password'),
  'passwordChanged': (
    'Đã đổi mật khẩu. Vui lòng đăng nhập lại.',
    'Password changed. Please sign in again.',
  ),
  'logout': ('Đăng xuất', 'Sign out'),
  'logoutConfirm': ('Đăng xuất khỏi CareConnect?', 'Sign out of CareConnect?'),
  'logoutLocal': (
    'Đã đăng xuất trên thiết bị. Chưa thể thu hồi phiên trên máy chủ.',
    'Signed out on this device. The server session could not be revoked.',
  ),
  'language': ('English', 'Tiếng Việt'),
  'readAll': ('Đánh dấu tất cả đã đọc', 'Mark all as read'),
  'unread': ('Chưa đọc', 'Unread'),
  'unsaved': (
    'Bạn có thay đổi chưa lưu. Rời màn hình?',
    'You have unsaved changes. Leave this screen?',
  ),
  'optional': ('Không bắt buộc', 'Optional'),
  'unknown': ('Chưa có thông tin', 'Not available'),
  'allergy': ('Dị ứng', 'Allergies'),
  'chronicConditions': ('Bệnh nền', 'Chronic conditions'),
  'careRequirements': ('Yêu cầu chăm sóc', 'Care requirements'),
  'dietaryNotes': ('Chế độ ăn', 'Dietary notes'),
  'behaviorNotes': ('Lưu ý hành vi', 'Behavior notes'),
  'medications': ('Thuốc đang sử dụng', 'Active medications'),
  'emergency': ('Liên hệ khẩn cấp', 'Emergency contact'),
  'age': ('Tuổi', 'Age'),
  'SCHEDULED': ('Đã xếp lịch', 'Scheduled'),
  'ACKNOWLEDGED': ('Đã nhận ca', 'Acknowledged'),
  'IN_PROGRESS': ('Đang chăm sóc', 'In progress'),
  'COMPLETED': ('Đã hoàn thành', 'Completed'),
  'CANCELLED': ('Đã hủy', 'Cancelled'),
  'MISSED': ('Đã lỡ ca', 'Missed'),
  'CUSTOMER_NO_SHOW': ('Khách vắng mặt', 'Customer no-show'),
  'ACTIVE': ('Đang hoạt động', 'Active'),
  'INACTIVE': ('Ngừng hoạt động', 'Inactive'),
  'LOCKED': ('Đã khóa', 'Locked'),
  'PENDING': ('Đang chờ', 'Pending'),
  'DONE': ('Đã hoàn thành', 'Done'),
  'SKIPPED': ('Đã bỏ qua', 'Skipped'),
  'APPROVED': ('Đã duyệt', 'Approved'),
  'REJECTED': ('Từ chối', 'Rejected'),
  'OPEN': ('Đang mở', 'Open'),
  'CLOSED': ('Đã đóng', 'Closed'),
  'DRAFT': ('Bản nháp', 'Draft'),
  'SUBMITTED': ('Đã gửi', 'Submitted'),
  'STABLE': ('Ổn định', 'Stable'),
  'IMPROVED': ('Cải thiện', 'Improved'),
  'DECLINED': ('Suy giảm', 'Declined'),
  'NEEDS_ATTENTION': ('Cần chú ý', 'Needs attention'),
  'VERIFIED': ('Đã xác minh', 'Verified'),
  'CENTER_VERIFIED': ('Trung tâm đã xác minh', 'Center verified'),
  'ADMIN_VERIFIED': ('Hệ thống đã xác minh', 'Admin verified'),
  'ENDED': ('Đã kết thúc', 'Ended'),
  'FORCE_ENDED': ('Trung tâm kết thúc', 'Ended by center'),
};
