> HISTORICAL — Flutter implementation retired on 01/11/2026. Active design: 2026-11-01-react-native-caregiver-design.md.

# Caregiver: đối chiếu nghiệp vụ và UI theo prototype

Ngày: 30/10/2026. Trạng thái: đã triển khai; kiểm chứng và giới hạn trong README và progress ledger.

## Yêu cầu và lựa chọn đã xác nhận

Người dùng yêu cầu rà soát các nghiệp vụ caregiver, bổ sung phần mobile còn
thiếu, và sửa UI theo prototype Caregiver đã làm trước đó. Người dùng đã chọn
**5 tab: Hôm nay, Lịch làm, Ca mở, Lịch sử, Hồ sơ**.

Chỉ thay đổi careconnect-mobile. BE và FE là nguồn tham chiếu chỉ đọc. Giữ
Flutter, hợp đồng gateway, quyền CAREGIVER và các quy tắc trong AGENTS.md.

## Nguồn đã đối chiếu

- Prototype: chat “Tạo prototype mobile CareConnect”, ngày 27/10/2026;
  ảnh `careconnect-caregiver-prototype.png` tại thư mục visualization của chat
  `01a17af9-31fb-7dd1-b910-0ee82a3ea1c4`. Các file nguồn prototype hiện không
  còn trong thư mục FE, nên dùng ảnh và luồng mô tả trong chat làm tham chiếu.
- BE BookingService: BookingOccurrenceController/ServiceImpl,
  CareSessionController/ServiceImpl, CareReportController/ServiceImpl,
  NotificationController/ServiceImpl và DTO tương ứng.
- Mobile: visits, sessions, reports, profile, availability, work_shifts,
  notifications, router, shell và kiểm thử hiện tại.

## Đối chiếu từng nghiệp vụ

| Nghiệp vụ người dùng yêu cầu | Mobile hiện tại | Thay đổi dự kiến |
| --- | --- | --- |
| Đăng nhập | Có, ACTIVE + CAREGIVER | Đồng bộ nhận diện UI; giữ xác thực thật |
| Xem hồ sơ cá nhân | Có hồ sơ chuyên môn và tài khoản | Làm rõ phần thông tin và lối vào tài khoản |
| Xem lịch làm được phân công | Có danh sách buổi và lịch Provider riêng | Tab Lịch làm lấy buổi được giao làm mặc định; giữ lối vào lịch rảnh/nghỉ |
| Xem ca sắp tới | Có thể lọc ngày nhưng mặc định chỉ hôm nay | Thêm chế độ Sắp tới trong Lịch làm, không giới hạn ở ngày hiện tại |
| Xem chi tiết lịch chăm sóc | Có | Sắp lại theo thời gian, trạng thái và hành động chính |
| Xem thông tin người bệnh | Có snapshot theo quyền BE | Giữ giới hạn; hiển thị rõ khi BE không cung cấp |
| Xem địa chỉ | Có | Tách thành khối dễ đọc trên thẻ/chi tiết |
| Xem dịch vụ cần thực hiện | Có danh sách tên ở chi tiết | Giữ nguyên văn tên dịch vụ, trình bày rõ từng mục |
| Xem ghi chú đặc biệt | Có dị ứng, bệnh nền, ăn uống, hành vi, yêu cầu | Nhấn mạnh trong chi tiết; không tự thêm mặc định y tế |
| Xác nhận nhận ca | Có acknowledge | Giữ endpoint và lỗi BE; cập nhật màn sau thành công |
| Bắt đầu ca | Có check-in và cửa sổ ±30 phút | Sau thành công dẫn vào ca đang chăm sóc bằng session thật |
| Cập nhật đang chăm sóc | BE đổi trạng thái qua check-in | Hiển thị trạng thái IN_PROGRESS; không thêm thao tác giả |
| Đánh dấu công việc | Có DONE/SKIPPED/PENDING và thêm việc | Làm rõ tiến độ DONE / tổng, giữ lý do bỏ qua và khóa khi ca đóng |
| Ghi chú tình trạng | Có ghi chú và chỉ số tùy chọn | Giữ form, trình bày trong ca rõ ràng hơn |
| Gửi báo cáo cho người thân | Có lưu nháp, gửi; BE thông báo customer | Hiển thị rõ gửi sau khi kết thúc ca, đã gửi chỉ đọc |
| Kết thúc ca | Có check-out có xác nhận | Sau kết thúc có lối vào báo cáo, không tự gửi thay người dùng |
| Xem lịch sử ca hoàn thành | Có qua bộ lọc COMPLETED + bỏ giới hạn ngày | Thêm tab Lịch sử mặc định COMPLETED toàn bộ ngày, có phân trang |
| Nhận thông báo lịch mới/thay đổi | Danh sách + badge, poll foreground 60 giây | Cập nhật foreground tối đa mỗi 30 giây; banner khi có thông báo mới sau lần tải đầu |

Các mục “có” là kết luận đối chiếu mã nguồn, không phải chứng nhận giao dịch
end-to-end với BE thật. Việc gửi báo cáo chỉ được xác nhận khi API thành công.

## Các hướng đã cân nhắc

1. **Theo prototype 5 tab**: thêm trang tổng quan và lịch sử riêng; Lịch làm
   chứa lịch được giao cùng lối vào lịch rảnh/nghỉ. Dễ theo danh sách nghiệp vụ,
   cần thay đổi router, điều hướng và tests. Người dùng đã chọn hướng này.
2. **Giữ 4 tab**: thay màu và card, thêm lối tắt lịch sử. Ít thay đổi điều hướng
   nhưng không thể hiện đúng cấu trúc prototype; người dùng không chọn.

## UI và điều hướng

Đề xuất triển khai của người thực hiện:

- Giữ xanh thương hiệu #075B31, nền sáng #F7F8F5, xanh nhạt, card trắng bo góc,
  icon đường nét, tiêu đề có thứ bậc như ảnh prototype. Không thêm font/package
  mạng nếu không cần thiết. Dùng ảnh thương hiệu sẵn có của FE khi phù hợp,
  chép asset vào mobile và khai báo trong pubspec; không phụ thuộc runtime FE.
- Hôm nay là màn sau đăng nhập: chào theo tên tài khoản thật, ngày hiện tại,
  khối thương hiệu, số buổi hôm nay/đã hoàn thành từ totalElements của API,
  danh sách hôm nay có phân trang và lối vào lịch sắp tới. Khi lỗi không hiển
  thị số 0 thay cho dữ liệu chưa tải được.
- Lịch làm: lựa chọn Hôm nay / Sắp tới / Tất cả; bộ lọc khoảng ngày và trạng
  thái vẫn truy cập được. Sắp tới dùng `from` là ngày hôm nay theo múi giờ lịch
  BE UTC+07 và bỏ `to`; trạng thái vẫn hiển thị nguyên bản. Tên Sắp tới mô tả
  khoảng ngày, không suy diễn rằng mọi buổi trong khoảng đều chưa bắt đầu.
  Có lối vào màn Lịch rảnh/nghỉ hiện tại, không xóa nghiệp vụ Provider.
- Lịch sử: query `status=COMPLETED`, không mặc định giới hạn hôm nay; mở chi
  tiết để xem ca và báo cáo. Không tải chi tiết từng thẻ chỉ để lấy sessionId.
  Các trạng thái MISSED/CANCELLED/CUSTOMER_NO_SHOW vẫn xem qua Lịch làm.
- Ca mở và Hồ sơ giữ các thao tác hiện có, thống nhất tiêu đề, khoảng cách,
  khối thông tin và hành động với các tab mới.
- Chi tiết và trong ca: phân cấp thông tin người bệnh, lịch/địa chỉ, dịch vụ,
  lưu ý đặc biệt rồi hành động nhận/bắt đầu ca. Checklist hiển thị số DONE
  riêng; SKIPPED không được tính là công việc đã thực hiện.
- Không đưa toggle “Sẵn sàng nhận ca” từ prototype vào app vì chưa có endpoint
  phù hợp cho toggle này. Không đưa tên, số liệu hoặc ca mẫu vào production.
- Mỗi nhãn mới dùng context.t; bổ sung Việt/Anh cùng nhau. UI dùng được trên
  viewport 320×480 và cỡ chữ 1.5, không khóa landscape bằng thay đổi này.
- Giữ route cũ hợp lý (buổi `/visits`, lịch rảnh `/availability`, chi tiết,
  reports); thêm route Hôm nay và Lịch sử. Route bảo vệ vẫn theo phiên.

## Hợp đồng và thông báo

- GET `/api/v1/booking-occurrences`: from/to là LocalDate, BE quy đổi theo
  timezone lịch UTC+07; timestamp buổi vẫn là Instant và hiển thị theo timezone
  thiết bị như kiến trúc hiện tại. Chỉ số và nhãn “hôm nay” tính theo ngày lịch
  Việt Nam để khớp query của BE. Không đổi trạng thái hoặc scope tại client.
- Bắt đầu ca dùng POST `/care-sessions`; dùng CareSessionResponse trả về để
  điều hướng. Kết thúc dùng POST `/care-sessions/{id}/end`. Không tự lặp lại
  writes sau timeout. Khi kết quả chưa rõ, cho tải lại trạng thái server.
- Gửi báo cáo chỉ khi session ENDED. CareReportServiceImpl.submit đã gửi
  REPORT_SUBMITTED tới customer sở hữu booking. Không gửi SMS/email hoặc chọn
  người thân ngoài quyền BE bằng mobile.
- Thông báo in-app: tải unread-count và trang thông báo mới nhất trong thời
  gian foreground; lần đầu chỉ lấy mốc ID, không hiện lại hàng loạt thông báo
  cũ. Lần sau chỉ hiện banner cho ID mới. Không log/lưu bền payload thông báo.
  Resume tải lại; pause hủy timer; logout hủy theo dõi, xóa ID trong bộ nhớ.
  Chống lượt tải chồng nhau và bỏ kết quả của phiên cũ. Việc tải/đánh dấu đã đọc
  vẫn theo API thật. Banner chỉ là thông tin; không chặn điều hướng.
- Chu kỳ 30 giây là đề xuất của người thực hiện; banner và badge không phải
  push notification của Android/iOS. Không thêm FCM/APNs khi BE chưa có hợp
  đồng đăng ký thiết bị/gửi push. Không yêu cầu quyền thông báo hệ điều hành.
  Nếu người dùng cần nhận khi app đóng, phải bổ sung BE trong một phạm vi riêng.
- Không sửa mã BE, Compose, migration, database hoặc gửi báo cáo thật để test.

## Ranh giới và kiểm chứng

- Domain dữ liệu tổng quan/lịch/lịch sử thuộc features, shared core không
  import feature. Repository visits sở hữu truy vấn lặp lại và dữ liệu tổng
  quan typed. Chỉ thêm abstraction khi có consumer.
- Giữ secure storage refresh token, access token trong bộ nhớ; không patient
  cache, không logs nhạy cảm, không giả thành công, không hạ checks.
- Thêm tests query theo ngày/status/phân trang; tổng chính xác từ BE; lịch sử
  ngoài ngày hiện tại; check-in đi tới session thật; tiến độ DONE khác SKIPPED;
  thông báo mới không phát lại, pause/logout không cập nhật UI cũ.
- Cập nhật test điều hướng 5 tab trên màn nhỏ/cỡ chữ lớn, vẫn truy cập lịch
  rảnh/nghỉ và thông báo, test loading/empty/error khi phù hợp.
- Chạy `dart format --output=none --set-exit-if-changed lib test`,
  `flutter analyze`, `flutter test`, Android debug build; kiểm tra native trên
  LDPlayer nếu thiết bị còn sẵn. Không tạo AVD/cache emulator mới trong repo.
- Cập nhật README, ARCHITECTURE và bảng nghiệp vụ theo kết quả thực tế.
  Không commit/push/merge/release nếu người dùng chưa yêu cầu.

## Những chi tiết giao cho người triển khai

Tên file/widget, icon, độ bo/khoảng cách phù hợp, cách giữ bộ lọc khi chuyển tab,
sắp xếp khối trong profile và các test fixtures. Tôn trọng thứ tự/phân trang BE;
không giả định trang đầu chứa mọi ca hoặc mọi thông báo trong một khoảng dài.
