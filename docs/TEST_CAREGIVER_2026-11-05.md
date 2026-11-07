# Kiểm thử nghiệp vụ Caregiver cập nhật05/11/2026

Đọc hướng dẫn chạy Android Studio/LDPlayer trong [RUN_MOBILE.md](RUN_MOBILE.md). BE/gateway phải chạy phiên bản mới; mobile không tự cập nhật schema hay khởi động các service. Dùng tài khoản ACTIVE/CAREGIVER và dữ liệu kiểm thử được trung tâm phân quyền. Các thao tác xác nhận/hủy/gửi sau đây ghi dữ liệu thật khi bạn thực hiện; bộ kiểm thử Jest dùng API giả.

| Mục | Cách vào và kết quả cần kiểm tra |
| --- | --- |
| Hôm nay | Lời chào/ngày → banner chăm sóc → số ca hôm nay/đã hoàn thành → toàn bộ ca trong ngày (có phân trang), giữ Xem chi tiết. Không còn khối Cần bạn phản hồi hoặc thẻ ca ưu tiên tách riêng. Ngày thực sự không có ca phải hiện Đăng ký ca và Xem buổi sắp tới; thử cả khi danh sách buổi được giao trước đó đang ở Lịch sử/có bộ lọc. Lỗi tải không được hiển thị như không có ca. |
| Yêu cầu từ khách | Buổi được giao → Cần phản hồi. Customer chọn Caregiver trên FE; mobile hiển thị khu vực, tuổi/giới tính, dịch vụ, lịch và hạn phản hồi. Chưa có quyền xem địa chỉ đầy đủ/hồ sơ bệnh nhân ở preview. |
| Nhận yêu cầu | Mở xác nhận rồi nhận. Kết quả là chờ khách thanh toán; không tự xuất hiện ca đã xác nhận. Kiểm tra trường hợp hết hạn, bị chuyển về trung tâm, nhiều trang và lỗi mạng. |
| Từ chối yêu cầu | Nhập lý do1–1000 ký tự rồi xác nhận. SHIFT bị từ chối; RECURRING/CUSTOM có thể chuyển về trung tâm theo BE. Lý do phải còn khi lỗi; sau kết quả chưa rõ cần tải lại, không gửi lặp. |
| Ca được giao | Buổi được giao → Xem chi tiết. Nhận ca chỉ trước giờ bắt đầu; bắt đầu trong cửa sổ check-in BE trả về. Kiểm tra thông báo chưa đủ thanh toán/cần phân công lại; trạng thái chưa được đổi khi BE từ chối. |
| Khách vắng mặt | Trong đúng cửa sổ cho phép, mở báo khách vắng mặt, nhập10–1000 ký tự và xác nhận. Sau gửi thành công hiển thị chờ trung tâm xử lý; mobile không quyết định kết quả thay quản lý. |
| Đăng ký ca | Lịch làm việc → Đăng ký ca → Ca mở → lọc ngày/loại/còn chỗ → Đăng ký ca. Ca đã có PENDING/APPROVED của bạn không được xuất hiện lại ở Ca mở dù trung tâm mới đủ1/4 người. Chờ duyệt/Đã duyệt chỉ có đăng ký chưa tới giờ bắt đầu; ca đã qua/từ chối/hủy vào Lịch sử. Kiểm tra số đếm cùng phân nhóm, ca có thể đăng ký ở trang BE sau khi trang đầu toàn ca đã đăng ký, hiệu lực CLOSED/COMPLETED và ca trung tâm đã hủy. Lịch sử giữ thông tin nhúng khi chi tiết ca không còn đọc được. |
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

## Home và Cần phản hồi (06/11/2026)

1. Khách đặt trực tiếp người chăm sóc: BE tạo thông báo CAREGIVER_REQUEST. Khi mobile ở foreground, kiểm tra chuông và thẻ Cần bạn xử lý ngay trên Lịch chăm sóc hôm nay (chu kỳ đọc30 giây). Số yêu cầu phải bằng tổng pending BE, không phụ thuộc đã đọc thông báo.
2. Bấm Trả lời trên Home hoặc mở thông báo: tới Buổi được giao → Cần phản hồi. Không còn thẻ điều hướng Yêu cầu từ khách ở ngoài thanh tab. Yêu cầu khách và buổi trung tâm giao chưa xác nhận là hai nhóm riêng.
3. Nhận/từ chối một yêu cầu: xác nhận, kiểm tra trạng thái BE, danh sách và số đếm mới. Nhận yêu cầu chưa biến ngay thành buổi chăm sóc đã thanh toán. Không gửi lại khi kết quả mạng chưa rõ.
4. Không có yêu cầu: Home ẩn thẻ khi API xác nhận tổng0; Cần phản hồi vẫn mở được và có trạng thái trống. Lỗi/403 phải có thông báo và tải lại, không giả định tổng0.
5. Thử nhiều trang, thông báo trỏ tới yêu cầu ở trang sau, yêu cầu đã hết hạn/đã trả lời, font lớn, VIE/ENG và trở lại Home sau khi phản hồi. Tên/dị ứng chỉ hiển thị khi BE cung cấp; không suy đoán địa chỉ đầy đủ hoặc thông tin lâm sàng.

Chưa chạy kiểm tra tự động hoặc kiểm tra trên emulator cho thay đổi này theo yêu cầu của người dùng.

## Nhập chứng chỉ theo FE (06/11/2026)

- Chạy lại `npm run android` để cài bộ chọn ngày Android mới. Mở Hồ sơ → Chứng chỉ → Thêm: chọn tệp ở đầu, rồi điền tên/đơn vị cấp, số chứng chỉ và ngày nếu có.
- Tạo mới bắt buộc chọn PDF/JPEG/PNG≤10MB. Ảnh chọn có xem trước; PDF hiện tên/dung lượng. Chọn/bỏ tệp không tự gửi API.
- Bấm Lưu khi thiếu dữ liệu phải thấy lỗi từng ô và giữ nội dung. Ngày hết hạn trước ngày cấp bị chặn; cùng ngày được chấp nhận theo BE. Số chứng chỉ tối đa255 ký tự theo BE.
- Bấm lịch ở từng ô ngày: xác nhận mới đổi dữ liệu, hủy không tự điền ngày. Nếu calendar chưa được cài trong APK, vẫn nhập được YYYY-MM-DD.
- Thử upload lỗi sau khi metadata đã lưu: lần lưu tiếp theo dùng ID/phiên bản đã nhận, không tạo thêm chứng chỉ. Kết quả chưa rõ vẫn khóa gửi lặp và yêu cầu tải lại/kiểm tra tệp.

## Nhận buổi → Bắt đầu (06/11/2026)

- SCHEDULED chưa nhận: thấy Nhận buổi trước giờ bắt đầu, không thấy nút Bắt đầu chăm sóc hoặc Mở lúc.
- Nhận buổi thành công, BE trả ACKNOWLEDGED: trước giờ mở check-in thì nút bị khóa và ghi Mở lúc HH:mm theo giờ Việt Nam (giờ BE trả về, không phải tự lấy giờ bắt đầu buổi).
- Đến đúng giờ mở: tự đổi sang Bắt đầu chăm sóc sau nhịp cập nhật đồng hồ, có thể thao tác. Đến hạn đóng hoặc giờ kết thúc: không còn nút bắt đầu.
- Nhận buổi lỗi/kết quả chưa rõ: không tự hiển thị thành đã nhận, giữ khóa/tải lại. Buổi đã có session hoặc đang chờ xử lý báo vắng không cho tạo session mới.

Các ca kiểm tra này chưa được chạy tự động hoặc trên emulator theo yêu cầu của người dùng.

## Chi tiết chăm sóc theo FE (06/11/2026)

1. Mở ca đã bắt đầu: trạng thái Đang diễn ra; ba thẻ Danh sách công việc, Ghi chú phiên chăm sóc, Báo cáo chăm sóc. Công việc sắp theo sortOrder BE, có loại/giờ nếu API cung cấp.
2. Có việc PENDING: Kết thúc ca bị khóa và hiện số việc còn lại. Xong chuyển DONE; Bỏ qua cần lý do và vẫn hiển thị SKIPPED riêng. Chưa thực hiện trả về PENDING. Khi mọi việc đã xử lý mới kết thúc, có xác nhận.
3. Thêm công việc/ghi chú thực, thử lỗi mạng và tải lại. Nhập chỉ số chỉ sau khi mở phần mở rộng; không có mặc định lâm sàng. Lỗi/response chưa rõ giữ nội dung và không gửi lặp.
4. Nhập nháp báo cáo, đổi trang ghi chú và cập nhật công việc: báo cáo/ảnh đang chọn phải còn nguyên. Khi quay lại phải xác nhận bỏ tất cả phần chưa lưu chỉ một lần.
5. Điều kiện chưa chọn phải trống. Chọn điều kiện, điền tóm tắt/khuyến nghị, chọn ảnh và lưu nháp tại chỗ. Khi ca IN_PROGRESS nút gửi vẫn khóa; kết thúc ca xong mở gửi mà giữ nháp. Xác nhận gửi, kiểm tra SUBMITTED chỉ đọc và customer nhận được báo cáo.
6. Kiểm tra cỡ chữ lớn/VIE/ENG, nút không chồng nhau; lỗi tải báo cáo không làm mất công việc/ghi chú. Không coi hướng dẫn24 giờ trên FE là quy tắc BE đã có.

Chưa chạy các kiểm tra tự động hoặc kiểm tra emulator cho thay đổi này theo yêu cầu người dùng.

## Nút lịch trong Thêm ngày nghỉ (07/11/2026)

Đã thêm nút Chọn ngày bắt đầu / Chọn ngày kết thúc vào hai ô ngày của form ngày nghỉ, đối chiếu DatePicker trong FE `work/time-off/time-off-form.tsx` và dùng lại native date dialog đã có.

- Bấm từng nút: mở lịch Android với giá trị hiện tại, chọn ngày để điền đúng ô. Không tự gửi hoặc sửa ô ngày còn lại; lý do và các giờ đã nhập vẫn còn.
- Hủy lịch/Android Back ở lịch: giữ nguyên ngày/lý do. Khi lịch đang mở, Lưu/Đóng và các nút lịch bị khóa.
- Nếu không mở được lịch: thông báo hướng dẫn nhập YYYY-MM-DD; nhập tay vẫn có thể Lưu. Không tự chọn ngày thay thế.
- Chọn cả ngày01–02/03/2030 rồi Lưu: payload bắt đầu28/02/2030 17:00Z, kết thúc02/03/2030 17:00Z; vẫn là hai ngày theo UTC+07 và end exclusive.
- Các khóa gửi lặp, giữ form khi lỗi và reconciliation của kết quả chưa rõ vẫn được giữ.

Kiểm thử fake transport/native components: `availability-time-off-ui.test.tsx`, `availability-time-off.test.ts`, `availability-ui.test.tsx` đạt33/33, gồm3 test mới cho chọn/hủy/lỗi lịch. Chưa kiểm tra bảng lịch trực quan trên thiết bị; không cài app hoặc mở emulator. Nếu bản app đang cài chưa có native date picker thì cần `npm run android`, reload Metro không bổ sung module native.

## Liên kết đặt lại mật khẩu theo FE (07/11/2026)

Đặt lại mật khẩu là liên kết chữ xanh căn phải dưới ô mật khẩu, trước nút Đăng nhập, đối chiếu FE `features/shared/auth/login-page.tsx`. Giữ vùng chạm48dp, accessibilityRole=link, trạng thái nhấn/khóa khi đang đăng nhập, điều hướng Forgot và API khôi phục hiện có. Không thêm tạo tài khoản theo yêu cầu đã điều chỉnh.

Hai kiểm thử đăng nhập hiện có (`app.test.tsx -t login`) đạt; format/lint/TypeScript và build Android đạt. Toàn bộ Jest vẫn230/244 đạt,14 lỗi thuộc Home/Work shifts/Report ngoài phần đổi này. Native config đạt; doctor tiếp tục báo JDK25 ngoài dải17–20 và Metro chưa chạy. Không gửi OTP/email thật để kiểm tra giao diện; QA trên thiết bị còn cần xác minh tiếng Việt/Anh, cỡ chữ lớn, thứ tự duyệt TalkBack và mở đúng màn khôi phục.
