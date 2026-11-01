# CareConnect Caregiver — chuyển sang React Native

Ngày: 01/11/2026. Trạng thái: được triển khai theo yêu cầu tiếp tục thay Flutter của người dùng.
Đã qua builder check độc lập: không còn câu hỏi quan trọng cản trở lập kế hoạch.

## Yêu cầu và quyết định đã xác nhận

Thay mã ứng dụng Flutter bằng React Native cho vai trò CAREGIVER, có giao diện
dựa trên FE-careconnect và gọi API BE thật. Người dùng đã chọn **Expo development
build + TypeScript**. Chỉ thay đổi repo careconnect-mobile; BE/FE chỉ đọc.

Mục tiêu là hoàn thành chu trình làm việc trên điện thoại: đăng nhập, xem lịch
và người bệnh, nhận/bắt đầu ca, thực hiện checklist và ghi chú, kết thúc ca,
gửi báo cáo, xem lịch sử và nhận thông báo lịch mới/thay đổi.

## Nguồn đã đối chiếu

- `C:/Users/Juuga/Documents/MSS301/FE-careconnect/app/app.css` và
  `app/features/caregiver/visits/`: màu, card, bộ lọc, nội dung chi tiết ca.
- BE tại `C:/Users/Juuga/Documents/MSS301/BE`: IdentityService
  `AuthenticationController`, `TokenTransportImpl`; BookingService
  `BookingOccurrenceController`, `CareSessionController`, `CareReportController`,
  `NotificationController`, DTO và quy tắc submit trong `CareReportServiceImpl`.
- ProviderService `CaregiverController` cho hồ sơ chuyên môn và lịch làm việc.
- `ARCHITECTURE.md`, mã Flutter hiện tại và tài liệu trước đây để nhận diện
  các ràng buộc phiên, thời gian và nghiệp vụ cần giữ khi đổi nền tảng.

Gateway `127.0.0.1:8080` chưa nhận kết nối tại thời điểm khảo sát. Đây là kiểm
tra kết nối, chưa phải kiểm thử đăng nhập hoặc giao dịch end-to-end.

## Các hướng đã cân nhắc

1. **Expo development build + TypeScript — người dùng đã chọn.** Dùng React
   Native thật, module native cho secure storage/chọn file/vị trí; tạo và build
   Android cục bộ, không bắt buộc tài khoản EAS hoặc dịch vụ build đám mây.
   Native project được sinh từ cấu hình và config plugin.
2. **React Native CLI thuần + TypeScript.** Kiểm soát native trực tiếp nhưng
   phải bảo trì cấu hình Android/iOS thủ công nhiều hơn; không được chọn.

Phiên bản Expo/RN và thư viện phải tương thích theo Expo SDK ổn định khi triển
khai, khóa bằng package-lock.json; không tự chọn phiên bản RN lệch SDK.

## Giao diện và điều hướng đề xuất

Đây là các quyết định của người triển khai trong phạm vi yêu cầu tiếp tục; trước đó chưa phải lựa chọn UI mà
người dùng đã xác nhận. Tham chiếu FE để viết lại component React Native,
không nhúng web hoặc sao chép nguyên HTML/Tailwind.

- Bốn tab: **Hôm nay, Lịch làm, Lịch sử, Hồ sơ**. Chuông thông báo ở header.
  Các màn chi tiết ca, đang chăm sóc, ghi chú và báo cáo nằm trong stack riêng.
  Bốn tab tập trung vào danh sách chức năng của yêu cầu viết lại hiện tại.
- Màu chính `#075B31`, nền `#F7F8F5`, chữ `#1B2922`, card trắng, xanh nhạt
  `#EAF2E9`, icon nét, khoảng cách thoáng và bo góc nhất quán theo FE.
  Thẻ ca làm nổi thời gian, trạng thái, người bệnh, địa chỉ và hành động tiếp theo.
- Hôm nay: lời chào bằng tên tài khoản, ngày Việt Nam, tổng ca và số hoàn thành
  lấy từ totalElements của BE, danh sách ca hôm nay và lối vào lịch sắp tới.
  Không dùng 0 thay cho thống kê lỗi/chưa tải, không đưa ca/người bệnh mẫu vào app.
- Lịch làm: Hôm nay / Sắp tới / Tất cả, lọc ngày và trạng thái, phân trang,
  kéo tải lại. Sắp tới bắt đầu từ ngày Việt Nam hiện tại và không chặn ngày kết thúc.
  Có mục lịch được phân công từ Provider ở màn này, phân biệt với BookingOccurrence.
- Chi tiết: người bệnh và snapshot được BE cấp, địa chỉ, dịch vụ, lời nhắn,
  dị ứng/bệnh nền/thuốc/lưu ý/liên hệ khẩn cấp nếu có; hành động nhận/bắt đầu ca.
  Không suy diễn dữ liệu y tế bị thiếu. Số điện thoại bị che không có nút gọi.
- Trong ca: trạng thái đang chăm sóc từ BE; tiến độ DONE/tổng, checklist,
  thêm công việc, bỏ qua có lý do, ghi chú/chỉ số tùy chọn và kết thúc ca.
- Báo cáo: tình trạng do caregiver chủ động chọn, tóm tắt và các mục ăn uống,
  thuốc, vận động, tâm trạng, khuyến nghị; lưu nháp, ảnh, gửi và đọc lại.
- Lịch sử: ca COMPLETED không giới hạn ngày mặc định, phân trang; mở chi tiết
  và báo cáo. Các trạng thái khác vẫn xem trong Lịch làm.
- Hồ sơ: thông tin cá nhân, trung tâm, chuyên môn, kỹ năng, chứng chỉ và ảnh
  do BE trả về; chuyển Việt/Anh, đổi mật khẩu và đăng xuất. Không tự sửa trường
  chuyên môn thuộc quyền manager.
- Thông báo: danh sách, chưa đọc, đánh dấu từng mục/tất cả và mở đích được hỗ trợ.

Vùng bấm ít nhất 48dp, tôn trọng safe area, bàn phím và cỡ chữ hệ thống; kiểm
tra màn hẹp và chữ lớn. Tiếng Việt mặc định, bổ sung tiếng Anh cùng lúc. React
Native dùng hook/context dịch `t(key)` tương đương yêu cầu Flutter `context.t(key)`;
domain text do API cung cấp được giữ nguyên.

## Hợp đồng API và trạng thái

Tất cả đường dẫn dưới đây nằm sau gateway `/api/v1`; không gọi thẳng service.

| Chức năng | Hợp đồng hiện có |
| --- | --- |
| Đăng nhập/khôi phục phiên/đăng xuất | POST `/auth/login`, `/auth/refresh`, `/auth/logout`; `X-Client-Type: mobile`, refresh token trong body |
| Kiểm tra tài khoản | GET `/users/me`; phải ACTIVE và có role CAREGIVER |
| Hồ sơ chuyên môn/lịch phân công | GET `/caregivers/me`, `/caregivers/me/schedules` |
| Ca được giao | GET `/booking-occurrences` với from/to/status/page/size; GET `/{id}` có snapshot chi tiết |
| Nhận ca | POST `/booking-occurrences/{id}/acknowledge` |
| Bắt đầu ca | POST `/care-sessions` với occurrenceId và tọa độ tùy chọn; đọc sessionId trả về |
| Đọc ca/checklist | GET `/care-sessions/{id}` |
| Công việc | PATCH `/care-sessions/{id}/tasks/{taskId}`; POST `/care-sessions/{id}/tasks` |
| Ghi chú | GET/POST `/care-sessions/{id}/notes` |
| Kết thúc ca | POST `/care-sessions/{id}/end` |
| Báo cáo | GET/POST `/care-reports`, GET/PUT `/{id}`, POST `/{id}/submit` |
| Ảnh báo cáo | POST `/care-reports/{id}/photos` multipart `files`; DELETE `/{id}/photos/{mediaFileId}` |
| Thông báo | GET `/notifications`, `/notifications/unread-count`; PATCH `/{id}/read`, `/read-all` |

- Client giải mã envelope `{code, result}` và PageResponse có items, page, size,
  totalPages, totalElements tại ranh giới API thành model typed.
- Giữ riêng các trạng thái BookingOccurrence SCHEDULED, ACKNOWLEDGED,
  IN_PROGRESS, COMPLETED, CANCELLED, MISSED, CUSTOMER_NO_SHOW và trạng thái session.
  Check-in đổi trạng thái qua BE, không thêm thao tác cập nhật trạng thái giả.
- Service lấy cửa sổ check-in từ cấu hình: bắt đầu từ startAt trừ startWindow,
  kết thúc trước startAt cộng missedGrace và trước endAt (cận cuối loại trừ).
  Giá trị mặc định hiện tại là 30 phút mỗi phía; xác minh cấu hình khi triển
  khai, BE luôn quyết định cuối. Chỉ sửa công việc/ghi chú khi IN_PROGRESS.
  Chỉ DONE được tính hoàn thành, SKIPPED được ghi riêng và cần lý do.
- Ghi chú content tối đa 2000 ký tự. Không tự điền chỉ số hoặc điều kiện y tế.
- Báo cáo summary bắt buộc, tối đa 4000; các mục chi tiết tối đa 2000.
  Tình trạng phải được chọn, giữ version khi cập nhật; SUBMITTED chỉ đọc.
  BE chỉ cho submit khi session ENDED. Người dùng xác nhận gửi vì không sửa lại được.
- Tìm báo cáo theo bookingId và sessionId, duyệt đủ trang; giữ ID đã lưu khi
  upload/submit thất bại để không tạo nháp trùng. Sau lỗi mạng không rõ kết quả,
  yêu cầu đọc lại trạng thái/version trước khi người dùng quyết định ghi tiếp.
- BE gửi REPORT_SUBMITTED cho customer sở hữu booking. App không tự chọn người
  nhận ngoài phạm vi BE hoặc giả gửi email/SMS cho người thân.
- Work shifts/lịch Provider là giờ Việt Nam UTC+07; Booking startAt/endAt là
  Instant, hiển thị theo múi giờ thiết bị. Query ngày Booking dùng ngày Việt Nam.

## Thông báo

Triển khai inbox, badge và banner foreground, cập nhật khi resume và mỗi 30 giây.
Lần đọc đầu chỉ lấy mốc, không phát lại thông báo cũ. Không tải chồng; bỏ response
qua pause/logout/phiên cũ; ID đã thấy chỉ lưu giới hạn trong bộ nhớ. Banner dùng
nội dung chung, không đưa thông tin người bệnh vào thông báo nổi.

BE có SSE nhưng chưa có hợp đồng FCM/APNs đăng ký thiết bị. Phạm vi này không
hứa thông báo hệ điều hành khi app đóng. Nhu cầu push nền cần thay đổi BE và
ủy quyền riêng, vì BE hiện chỉ được tham chiếu chỉ đọc. Chỉ điều hướng loại
reference đã hỗ trợ với UUID hợp lệ, không mở URL tùy ý từ payload.

## Kiến trúc và bảo vệ phiên

- `src/core`: cấu hình gateway, HTTP/error, auth/session/token store, theme,
  localization và component dùng chung. Core không import feature.
- `src/features`: auth, home, visits, sessions, reports, profile, notifications;
  repository feature sở hữu workflow API lặp lại. App/navigation ghép các feature.
- TypeScript strict; schema/parser kiểm tra JSON tại boundary. React Navigation
  cho tab/stack và guard; state/cached reads chỉ trong bộ nhớ theo phiên.
- SecureStore giữ refresh token, access token chỉ trong RAM. Không log token,
  password/patient data; không dùng AsyncStorage cho token hoặc patient cache.
- Một lượt refresh dùng chung khi nhiều request 401; retry tối đa một lần sau
  xác thực thất bại. Không tự retry write sau timeout/đứt mạng. Refresh tạm lỗi
  giữ token để thử lại; invalid token/role thì xóa phiên.
- Serialize ghi secure storage; session epoch chặn response cũ và refresh đang
  chạy ghi đè logout. Logout xóa protected navigation, forms, cache và pollers.
  Lỗi thu hồi phiên server được thông báo nhưng vẫn xóa phiên cục bộ.
- Màn remote có loading, empty, retry, denied. Khóa mutation đang chờ; form giữ
  nội dung khi lỗi và xác nhận trước khi rời nếu bẩn. Không có write thành công giả.
- Vị trí tùy chọn chỉ foreground khi check-in/out, timeout hữu hạn; từ chối
  quyền không gửi tọa độ giả và không chặn nếu BE cho phép thiếu tọa độ.
- Avatar tối đa 5 MB; chứng chỉ PDF/JPEG/PNG tối đa 10 MB; ảnh báo cáo JPEG/PNG/WebP
  tối đa 10 MB, nhiều nhất 5 ảnh. Kiểm tra ở client và giữ server validation.
  Chọn file native, không upload log hoặc metadata nhạy cảm vào telemetry.

## Chuyển đổi repo và build

- Người dùng đã yêu cầu xóa mã cũ. Trước khi xóa, lưu bản dự phòng local bị
  gitignore trong `artifacts/` cho mã/config/docs Flutter đang có, gồm thay đổi
  chưa commit; loại trừ secrets, keystore, local SDK config và build/cache.
  Không reset/clean mất thay đổi chưa lưu; không sửa `.git`.
- Sau duyệt thiết kế, thay lib/test/pubspec và cấu hình Flutter Android/iOS/CI
  bằng dự án Expo; giữ tài sản thương hiệu phù hợp và tài liệu nguồn tham chiếu.
  Đánh dấu tài liệu Flutter cũ là lịch sử, cập nhật README, ARCHITECTURE, AGENTS
  và script LDPlayer để không hướng dẫn chạy Flutter nữa.
- Giữ app ID `vn.careconnect.careconnect_mobile`; không dùng signing key release.
  Expo native generation không được làm HTTP release bật mặc định: HTTP local
  chỉ debug Android, iOS/release dùng HTTPS. Config plugin tái tạo rule này.
- Gateway cấu hình qua biến public không chứa secret, mặc định debug Android
  emulator `http://10.0.2.2:8080`; LDPlayer hỗ trợ adb reverse `127.0.0.1:8080`.
- Android build cục bộ với SDK/JDK phù hợp Expo đã khóa; không tải AVD vào repo.
  Android native directory sinh lại được; không commit build output/local SDK path.
  iOS cần macOS/Xcode, không tuyên bố đã build iOS trên Windows.
- Thay kiểm tra Dart/Flutter bằng formatter, lint, TypeScript, behavioral tests
  và Android debug build tương ứng nền tảng mới. Commit package-lock cùng source.
  Không commit/push/merge/release khi người dùng chưa yêu cầu.

## Phạm vi và tiêu chí bàn giao

Bao phủ toàn bộ chức năng caregiver người dùng liệt kê. Không thêm vai trò
Customer/Manager/Admin, thanh toán, booking mới, chat, offline sync hoặc tracking
vị trí nền. Ca mở/đăng ký ca, tự khai lịch rảnh và quản lý khoảng nghỉ là phạm vi
mở rộng của bản Flutter trước; không nằm trong danh sách tính năng viết lại hiện
tại. Hồ sơ/chứng chỉ và lịch Provider được xem, không mở thêm workflow quản trị.

- Contract tests: auth mobile/header/body/envelope, role guard, refresh đồng thời,
  token rotation/logout race, dữ liệu phiên cũ, lỗi khôi phục tạm thời.
- Behavioral tests: query ngày/phân trang/tổng BE, nhận/check-in đúng sessionId,
  DONE khác SKIPPED, khóa ca đã kết thúc, form giữ khi lỗi, dirty-form confirmation.
- Báo cáo: version conflict, lỗi mạng không tự ghi lại, giữ draft ID, duyệt đủ
  trang, giới hạn ảnh, xác nhận submit và khóa sửa sau gửi.
- Thông báo: không phát lại lần đầu, refresh/resume, không response sau logout,
  đích điều hướng hợp lệ. UI: đăng nhập/guard, empty/error/denied, màn hẹp/chữ lớn.
- Chạy formatter, lint, typecheck, tests, Expo dependency checks, Android debug
  build và xem UI native trên emulator sẵn có nếu chạy được.
- README ghi lệnh cài/chạy/build/API URL và giới hạn thực tế. Phân biệt kết quả
  fake-transport tests với giao dịch BE thật; chỉ kiểm thử write BE khi có tài
  khoản kiểm thử và môi trường phù hợp, không tự tạo account hoặc sửa BE.

## Chi tiết giao cho người triển khai

Phiên bản dependency tương thích SDK, tên file/component, icon, spacing, animation
nhẹ, tổ chức các hook và fixtures. UI không phụ thuộc FE lúc runtime. Những API
phụ như đổi mật khẩu/ảnh phải được xác minh controller/DTO trước khi triển khai;
thiếu API thì ghi rõ giới hạn, không tạo endpoint hoặc dữ liệu giả.
