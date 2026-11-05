# Kiểm thử nghiệp vụ Caregiver cập nhật05/11/2026

Đọc hướng dẫn chạy Android Studio/LDPlayer trong [RUN_MOBILE.md](RUN_MOBILE.md). BE/gateway phải chạy phiên bản mới; mobile không tự cập nhật schema hay khởi động các service. Dùng tài khoản ACTIVE/CAREGIVER và dữ liệu kiểm thử được trung tâm phân quyền. Các thao tác xác nhận/hủy/gửi sau đây ghi dữ liệu thật khi bạn thực hiện; bộ kiểm thử Jest dùng API giả.

| Mục | Cách vào và kết quả cần kiểm tra |
| --- | --- |
| Hôm nay | Lời chào/ngày → banner chăm sóc → số ca hôm nay/đã hoàn thành → toàn bộ ca trong ngày (có phân trang), giữ Xem chi tiết. Không còn khối Cần bạn phản hồi hoặc thẻ ca ưu tiên tách riêng. Ngày thực sự không có ca phải hiện Đăng ký ca và Xem buổi sắp tới; thử cả khi danh sách buổi được giao trước đó đang ở Lịch sử/có bộ lọc. Lỗi tải không được hiển thị như không có ca. |
| Yêu cầu từ khách | Buổi được giao → Yêu cầu từ khách. Customer chọn Caregiver trên FE; mobile hiển thị khu vực, tuổi/giới tính, dịch vụ, lịch và hạn phản hồi. Chưa có quyền xem địa chỉ đầy đủ/hồ sơ bệnh nhân ở preview. |
| Nhận yêu cầu | Mở xác nhận rồi nhận. Kết quả là chờ khách thanh toán; không tự xuất hiện ca đã xác nhận. Kiểm tra trường hợp hết hạn, bị chuyển về trung tâm, nhiều trang và lỗi mạng. |
| Từ chối yêu cầu | Nhập lý do1–1000 ký tự rồi xác nhận. SHIFT bị từ chối; RECURRING/CUSTOM có thể chuyển về trung tâm theo BE. Lý do phải còn khi lỗi; sau kết quả chưa rõ cần tải lại, không gửi lặp. |
| Ca được giao | Buổi được giao → Xem chi tiết. Nhận ca chỉ trước giờ bắt đầu; bắt đầu trong cửa sổ check-in BE trả về. Kiểm tra thông báo chưa đủ thanh toán/cần phân công lại; trạng thái chưa được đổi khi BE từ chối. |
| Khách vắng mặt | Trong đúng cửa sổ cho phép, mở báo khách vắng mặt, nhập10–1000 ký tự và xác nhận. Sau gửi thành công hiển thị chờ trung tâm xử lý; mobile không quyết định kết quả thay quản lý. |
| Đăng ký ca | Lịch làm việc → Đăng ký ca → Ca mở → lọc ngày/loại/còn chỗ → Đăng ký ca. Kiểm tra các nhóm Chờ duyệt, Đã duyệt và Lịch sử (toàn bộ đăng ký), số lượng từ BE, hiệu lực CLOSED/COMPLETED và ca trung tâm đã hủy. Lịch sử giữ thông tin nhúng khi chi tiết ca không còn đọc được. |
| Hủy đăng ký/khung rảnh | PENDING hủy đăng ký có xác nhận. APPROVED → hủy khung rảnh → mở đúng lịch liên kết, nhập lý do và dùng version mới nhất. BE từ chối nếu khung đã có buổi chăm sóc; không dùng thao tác hủy PENDING cho APPROVED. |
| Lịch/ngày nghỉ | Lịch làm việc → Lịch theo ngày hoặc Ngày nghỉ. Thanh tuần chỉ có ngày/tháng; thẻ buổi chăm sóc chỉ gồm tên bệnh nhân, địa chỉ, ngày/giờ, trạng thái và Xem chi tiết. Ngày nghỉ cho phép thêm cả ngày hoặc giờ cụ thể. Giờ Việt Nam, thời điểm kết thúc là cận loại trừ, tối đa30 ngày, lý do≤500. Kiểm tra trùng ngày nghỉ, trùng buổi được giao và xác nhận xóa. |
| Tiền cọc được hưởng | Hồ sơ → Tiền cọc được hưởng. Chọn tháng/30 ngày/năm, kiểm tra tổng BE và nhiều trang. Phạm vi lọc theo ngày ghi nhận; đây không phải bảng lương hoặc số dư rút tiền. |
| Thông báo | Chuông → tất cả/chưa đọc; thử đọc/chưa đọc, chọn nhiều, xóa và xóa thông báo đã đọc có xác nhận. Sau xóa bản ghi cuối ở trang cuối vẫn phải xem được các trang còn lại. Liên kết mở yêu cầu/ca trong quyền Caregiver. |
| Ảnh đại diện | Hồ sơ → Chọn ảnh đại diện → kiểm tra tên ảnh → Cập nhật. JPEG/PNG/WebP≤5MB. Lỗi giữ lựa chọn; kết quả chưa rõ cần tải lại và bỏ lựa chọn cũ trước lần tải khác. |
| Chứng chỉ | Hồ sơ → Chứng chỉ → thêm/sửa metadata, chọn PDF/JPEG/PNG≤10MB và lưu. Tên/đơn vị cấp bắt buộc≤255; ngày hết hạn được bằng ngày cấp. Chứng chỉ mới/sửa quay về chờ xác minh; xóa dùng version và xác nhận. Lỗi tải file không được tạo lại metadata trùng. |
| Hồ sơ | Ảnh/tên/trạng thái thực tế → độ hoàn thiện6 tiêu chí → Thông tin cá nhân → Giới thiệu → Dịch vụ đảm nhận → Tiền cọc được hưởng → Chứng chỉ/Bảo mật. Chạm camera để chọn ảnh, kiểm tra bản xem trước rồi xác nhận Cập nhật; ảnh chờ chưa được tính là đã lưu. Kiểm tra cỡ chữ lớn, trường chưa có, chứng chỉ hết hạn/bị từ chối và lỗi tải chứng chỉ. Đổi ngôn ngữ ở cuối trang. |
| Bảo mật | Hồ sơ → Sửa ở số điện thoại hoặc Bảo mật → Đổi mật khẩu mở thông tin tài khoản: số điện thoại10–11 chữ số, mật khẩu mạnh≤72byte UTF-8 và xác nhận. Đổi thành công đưa về đăng nhập. Bảo mật → Thiết bị đăng nhập hiển thị trình duyệt/hệ điều hành (hoặc chưa xác định), IP thực tế, hoạt động gần nhất và Thiết bị này. Thử Xem tất cả/Thu gọn, đăng xuất một thiết bị khác hoặc tất cả thiết bị khác có xác nhận. Phiên hiện tại phải được giữ; lỗi giữa chừng phải dừng, yêu cầu tải lại và không tự gửi lặp. |
| Báo cáo | Buổi đã kết thúc → Báo cáo. Giữ hai ô tóm tắt/khuyến nghị, lựa chọn tình trạng bắt buộc theo BE và tối đa5 ảnh≤10MB. Thử chọn ảnh trước khi lưu, lỗi upload, tải lại và xác nhận gửi; report đã gửi chỉ đọc. |

## Kiểm tra giao diện

Thử tiếng Việt/English, điện thoại nhỏ và màn hình ngang, chữ hệ thống lớn nhất, bàn phím mở khi nhập lý do/báo cáo, TalkBack và giảm chuyển động. Kiểm tra đủ loading/trống/không có quyền/lỗi/tải lại, nút48dp, không che nội dung bởi thanh hệ thống. Các bản sửa source/fixture không thay thế việc nhìn và chạm trực tiếp trên Android.
