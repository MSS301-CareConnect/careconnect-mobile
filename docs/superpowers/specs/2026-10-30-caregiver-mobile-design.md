# Thiết kế CareConnect Mobile cho caregiver

Ngày: 30/10/2026. Trạng thái: người dùng đã duyệt và yêu cầu triển khai.

Ghi chú khi đối chiếu mã BE: AuthenticationController hiện dùng `/auth/login`
và `/auth/refresh` kèm `X-Client-Type: mobile`; alias `/auth/mobile/*` đã deprecated.
Triển khai theo controller hiện tại; các đường dẫn trong phần đề xuất ban đầu
bên dưới mô tả hợp đồng mobile cũ. Ca APPROVED hủy qua lịch rảnh có lý do;
endpoint hủy đăng ký chỉ nhận PENDING. Gửi báo cáo yêu cầu session ENDED.

## Ý định và quyết định đã có

Xây ứng dụng mobile cho người chăm sóc thuộc trung tâm CareConnect, dựa trên
nghiệp vụ đang có trong BE và cổng caregiver của FE-careconnect. Người dùng đã
chọn **Flutter**. Mọi file tạo hoặc sửa phải nằm trong repo `careconnect-mobile`.
BE và FE chỉ là nguồn tham chiếu, không chỉnh sửa hay chạy migration tại đó.

Repo mobile hiện chỉ có README. Các quyết định kiến trúc, giao diện và phạm vi
chi tiết dưới đây là đề xuất của người triển khai, chưa phải yêu cầu đã được
người dùng xác nhận.

## Nguồn tham chiếu

- BE: `C:/Users/Juuga/Documents/MSS301/BE`.
- Web: `C:/Users/Juuga/Documents/MSS301/FE-careconnect`.
- Hợp đồng mobile auth: `IdentityService/README.md` và controller/DTO hiện tại.
- Luồng buổi chăm sóc: `BookingOccurrenceController`, `CareSessionController`,
  `CareReportController`, DTO và service trong BookingService.
- Hồ sơ, lịch rảnh, nghỉ, đăng ký ca: controller/DTO/service trong ProviderService;
  đối chiếu `app/features/caregiver` và `app/entities` của web.
- Màu thương hiệu: `app/app.css` của web.

Nếu snapshot OpenAPI của FE khác mã BE, xác minh controller, DTO và service BE
trước khi viết client; ghi lại giới hạn trong README mobile thay vì sửa BE.

## Các hướng đã cân nhắc

1. **Flutter**: UI native trên Android/iOS, một codebase Dart, SDK đã có trên máy;
   cần viết lại UI và client API so với React web. Đây là hướng người dùng chọn.
2. **React Native/Expo**: gần hệ sinh thái TypeScript của web, nhưng component
   HTML/Tailwind hiện có vẫn phải chuyển đổi và cần thiết lập runtime mobile mới.

Không bọc web trong WebView: ứng dụng cần điều hướng mobile, secure storage,
truy cập vị trí và chọn file bằng cơ chế nền tảng.

## Mục tiêu và phạm vi

Ứng dụng dùng API thật qua gateway; không hiển thị dữ liệu mẫu như dữ liệu thật.
Mục tiêu phát hành mã nguồn Android/iOS, tài liệu chạy và bản Android debug nếu
toolchain trên máy cho phép. iOS cần macOS/Xcode để build và ký; trên Windows
chỉ tạo cấu hình iOS và kiểm tra phần Dart dùng chung.

### 1. Đăng nhập và phiên làm việc

- Email/mật khẩu, ẩn/hiện mật khẩu, kiểm tra dữ liệu nhập và lỗi rõ ràng.
- Dùng `/api/v1/auth/mobile/login` và `/auth/mobile/refresh`; không dùng cookie web.
- Sau đăng nhập/khôi phục phiên, đọc `/api/v1/users/me` và xác nhận tài khoản
  còn hoạt động, có role `CAREGIVER`. Tài khoản không đúng role không vào app.
- Refresh token lưu trong OS secure storage; access token chỉ trong bộ nhớ.
  Không lưu mật khẩu, token hoặc thông tin người bệnh trong log.
- Các request 401 dùng chung một lượt refresh; retry tối đa một lần. Refresh
  không hợp lệ thì xóa phiên và về đăng nhập. Lỗi mạng/5xx có nút thử lại,
  không tự coi là đăng xuất.
- Logout gọi endpoint BE, xóa dữ liệu phiên/cache cục bộ; nếu BE không kết nối
  được vẫn cho đăng xuất cục bộ và thông báo trạng thái phù hợp.
- Có luồng quên/đặt lại mật khẩu theo API hiện có, không tự đăng ký caregiver:
  tài khoản caregiver được trung tâm cấp.

### 2. Buổi được giao

- Tab mặc định: lịch buổi chăm sóc, chọn ngày/khoảng ngày, lọc trạng thái,
  phân trang và kéo để tải lại. Tổng số và thống kê chỉ lấy từ dữ liệu được
  trả về; không suy diễn tổng toàn hệ thống từ một trang.
- Thẻ buổi hiển thị người cần chăm sóc, thời gian, địa chỉ, mã booking và trạng thái.
- Chi tiết hiển thị dịch vụ, lời nhắn khách hàng, snapshot người bệnh, dị ứng,
  thuốc và liên hệ khẩn cấp khi BE cho phép. Thiếu snapshot hiển thị thông báo
  phù hợp, không gọi API khác để vượt giới hạn dữ liệu của BE.
- Nút gọi điện chỉ hoạt động với số điện thoại đầy đủ, không phải số bị che.
- Nhận ca (`acknowledge`), check-in từ 30 phút trước đến 30 phút sau giờ bắt đầu,
  báo khách vắng sau giờ bắt đầu với lý do. BE quyết định kết quả cuối cùng.
- Trạng thái: SCHEDULED, ACKNOWLEDGED, IN_PROGRESS, COMPLETED, CANCELLED,
  MISSED, CUSTOMER_NO_SHOW; không gộp trạng thái làm mất ý nghĩa nghiệp vụ.
- Khi màn đang mở, cập nhật cửa sổ check-in theo thời gian và khi app resume.

### 3. Trong ca và báo cáo

- Sau check-in, dùng `sessionId` BE trả về để đọc checklist và ghi chú.
- Đánh dấu hoàn thành, bỏ qua có lý do, hoàn tác, thêm công việc tùy chỉnh;
  giới hạn khả năng sửa theo trạng thái session và hợp đồng BE.
- Ghi chú tình trạng/chỉ số sinh tồn theo DTO của BE, xem lịch sử có phân trang.
- Check-in/out có thể lấy tọa độ sau khi người dùng cấp quyền; nếu từ chối,
  tắt GPS hoặc không lấy được trong thời gian giới hạn, vẫn cho tiếp tục vì
  BE hiện cho phép tọa độ trống. Không gửi tọa độ giả, không theo dõi nền.
- Check-out có xác nhận; thông báo lỗi nghiệp vụ nếu còn điều kiện chưa đáp ứng.
- Báo cáo gắn với đúng session: chọn tình trạng STABLE, IMPROVED, DECLINED,
  NEEDS_ATTENTION bằng thao tác chủ động, không chọn sẵn tình trạng y tế.
- Báo cáo có tóm tắt và các trường ăn uống, thuốc, vận động, tâm trạng, khuyến
  nghị; lưu nháp, sửa nháp, gửi, đọc lại báo cáo đã gửi. Gửi `version` khi sửa.
- Đính kèm/xóa ảnh báo cáo bằng endpoint BE, theo giới hạn file thực tế của BE.
  Nếu một upload lỗi, giữ báo cáo nháp và cho thử lại; không tạo nháp trùng.
- Báo cáo đã gửi chỉ đọc. Gửi báo cáo có xác nhận vì không thể sửa sau đó.

### 4. Lịch rảnh và ca làm việc

- Tab Lịch rảnh hiển thị `/caregivers/me/schedules`, phân biệt với buổi được giao.
  Thay đổi trạng thái lịch theo endpoint và các chuyển đổi BE cho caregiver.
- Xem, thêm và xóa khoảng nghỉ của bản thân; kiểm tra kết thúc sau bắt đầu,
  hiển thị lỗi trùng lịch từ BE.
- Tab Ca làm việc: danh sách ca mở thuộc trung tâm của caregiver; xem ngày,
  thời gian, hạn đăng ký và thông tin ca mà BE cung cấp.
- Đăng ký ca kèm ghi chú, xem đăng ký của mình và trạng thái xét duyệt;
  hủy đăng ký bằng `version` hiện tại. Chỉ cho đăng ký khi chưa hết hạn,
  chưa bắt đầu và không có đăng ký còn hiệu lực đã tải; BE vẫn chống trùng.
- Các danh sách có phân trang. Không giả định trang đầu chứa toàn bộ đăng ký.

### 5. Hồ sơ, tài khoản và thông báo

- Tab Hồ sơ: thông tin chuyên môn, trung tâm, kinh nghiệm, kỹ năng, đánh giá,
  trạng thái hoạt động/xác minh và chứng chỉ.
- Xem/tải ảnh đại diện, thêm chứng chỉ và file chứng chỉ theo quyền API hiện có.
  Không cho caregiver tự sửa các dữ liệu chuyên môn do manager quản lý.
- Màn thông tin tài khoản cho phép cập nhật các trường `/users/me` hỗ trợ và
  đổi mật khẩu; giữ `version` và xử lý conflict nếu hợp đồng yêu cầu.
- Thông báo mở từ biểu tượng chuông: danh sách có phân trang, đánh dấu đã đọc
  từng mục/tất cả, số chưa đọc. Chỉ điều hướng các loại đích đã biết trong app;
  không mở tùy ý URL từ payload.
- Giai đoạn này cập nhật thông báo khi mở màn, resume và tải lại; chưa cam kết
  push nền hoặc SSE liên tục. BE hiện có SSE nhưng chưa có hợp đồng FCM/APNs.

## Giao diện đề xuất

Material 3, tối ưu thao tác một tay, giữ màu thương hiệu xanh `#075B31`, nền
`#F7F8F5`, card trắng và chữ `#1B2922`. Bốn tab dưới: Buổi được giao, Lịch rảnh,
Ca làm việc, Hồ sơ. Chi tiết ca, ghi chú và báo cáo dùng màn riêng, tránh form
dài chen vào danh sách. Chuông thông báo nằm trên thanh ứng dụng.

Hỗ trợ tiếng Việt và tiếng Anh như web bằng Flutter localization; tiếng Việt
là mặc định. Định dạng ngày/giờ theo locale, đổi Instant UTC từ BE sang giờ
thiết bị để hiển thị, gửi lại UTC khi API yêu cầu Instant. Ngày/giờ ca làm việc
trả về dạng local giữ nguyên ý nghĩa như web; không tự chuyển thành UTC.

Mọi màn API có trạng thái tải, rỗng, lỗi/thử lại và thiếu quyền. Nút đang gửi
request không nhận thao tác trùng. Form giữ nội dung khi gửi thất bại, cảnh báo
khi rời màn có thay đổi chưa lưu. Không yêu cầu mạng thì mới xem được lỗi mạng.
Nội dung co giãn theo kích thước chữ và màn điện thoại nhỏ; vùng bấm tối thiểu 48dp.

## Kiến trúc đề xuất

- Flutter stable/Dart đang cài, Material 3.
- `lib/core`: cấu hình gateway, HTTP client, lỗi API, quản lý phiên/token,
  theme, localization và widget trạng thái chung.
- `lib/features/auth`, `visits`, `sessions`, `reports`, `availability`,
  `work_shifts`, `profile`, `notifications`: model/API/controller và màn hình
  của từng nghiệp vụ; chia file khi có trách nhiệm riêng.
- Dio cho HTTP/multipart, Riverpod cho state và cache theo phiên, go_router
  cho điều hướng và guard, flutter_secure_storage cho refresh token,
  geolocator cho vị trí, file/image picker và url_launcher khi cần.
- Model typed bám DTO BE; không dùng map/dynamic xuyên suốt UI. Giải mã envelope
  `APIResponse` và trang theo cấu trúc thực tế của từng service.
- API base URL qua `--dart-define=API_BASE_URL=...`; Android emulator mặc định
  dùng gateway máy host qua `10.0.2.2:8080`, máy thật dùng IP LAN/HTTPS được cấu hình.
  Không nhúng secrets hoặc địa chỉ production suy đoán.
- Chỉ gọi gateway `/api/v1/**`. Xử lý timeout và lỗi kết nối bằng thông báo dễ hiểu.
  Không retry mutation tự động khi không rõ BE đã xử lý hay chưa; riêng retry
  sau 401 chỉ thực hiện khi xác thực thất bại trước nghiệp vụ.
- Dữ liệu người bệnh nằm trong bộ nhớ theo phiên; không làm offline database
  hoặc hàng đợi đồng bộ. Refresh token và tùy chọn ngôn ngữ là dữ liệu lưu bền.
- HTTP development nếu cần chỉ cho phép ở cấu hình Android debug; release dùng
  HTTPS. Cấu hình quyền vị trí/chọn ảnh với lời giải thích phù hợp trên Android/iOS.

## Không thuộc phạm vi

Ứng dụng cho Customer/Manager/Admin; sửa BE hoặc web; tạo tài khoản caregiver
bằng app; booking/thanh toán; chat; theo dõi GPS nền; push notification; tự thay
đổi chính sách check-in, xét duyệt ca hay khóa báo cáo; phát hành lên cửa hàng.
Không yêu cầu người dùng cung cấp tài khoản thật để viết và kiểm tra phần mềm.

## Kiểm chứng và bàn giao

- Test giải mã DTO/envelope, phiên và refresh đồng thời, sai role, lỗi mạng,
  phân trang; test cửa sổ check-in và đổi thời gian UTC/local.
- Test hành vi quan trọng: nhận ca/check-in, task bỏ qua có lý do, check-out,
  lưu/gửi báo cáo và khóa sửa sau gửi, đăng ký/hủy ca kèm version.
- Widget test đăng nhập, guard và các trạng thái tải/rỗng/lỗi; không viết test
  chỉ lặp lại implementation hoặc màu sắc.
- Chạy formatter, `flutter analyze`, `flutter test`, Android debug build nếu
  SDK sẵn sàng; kiểm tra UI bằng emulator khi khả dụng.
- Test tích hợp với fake HTTP có dữ liệu gần DTO; chỉ gọi BE đang chạy khi
  có tài khoản kiểm thử phù hợp, không tự tạo/sửa dữ liệu tại BE tham chiếu.
- README hướng dẫn Flutter setup, API_BASE_URL cho emulator/máy thật, cách chạy
  và kiểm tra, giới hạn iOS/BE chưa xác minh. Bàn giao nêu rõ kiểm tra nào đã
  chạy thực tế và phần nào còn cần thiết bị hoặc tài khoản kiểm thử.

## Những phần để người triển khai quyết định

Phiên bản package tương thích Flutter đang cài, tên file/widget, cấu trúc nhỏ
trong từng feature, icon, khoảng cách, animation nhẹ, chiến lược cache/invalidate
theo mutation và chi tiết trình bày lỗi. Khi thiếu API cho một hành động, ghi rõ
giới hạn thay vì tạo nút thành công giả hoặc tự mở rộng BE.
