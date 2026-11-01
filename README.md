# CareConnect Mobile

Ứng dụng **React Native CLI + TypeScript**, hiện chỉ dành cho **Android**, phục vụ CAREGIVER. Quyết định dùng CLI ngày 01/11/2026 thay thế kế hoạch Expo trung gian và triển khai Flutter cũ. BE và FE-careconnect chỉ dùng để tham chiếu, không bị chỉnh sửa.

Hướng dẫn đầy đủ: [Chạy mobile với React Native CLI](docs/RUN_MOBILE.md); [LDPlayer](docs/LDPLAYER.md).

## Cài đặt và chạy

Cần Node.js 24 LTS, npm, JDK 21, Android Studio/Android SDK. Dependency khóa trong `package-lock.json`: React Native 0.88.1, React 19.3.0, TypeScript 6 và Community CLI 20.2.0. Android tối thiểu API 24; build dùng SDK/Build Tools 37, NDK 27.1.12297006 và Gradle 9.4.1.

    npm ci
    Copy-Item .env.example .env
    npm start

Chỉ tạo `.env` nếu chưa có file đó. Giữ Terminal Metro chạy, mở Terminal thứ hai tại repo để build/cài ứng dụng lần đầu:

    npm run android

Có thể mở thư mục `android/` bằng Android Studio để sync/build/chạy. `android/` là source native được quản lý trong Git. Dự án không dùng Expo prebuild, Expo Go hoặc development launcher.

Metro dùng cổng **8090** vì Identity BE đã dùng 8081. Sau lần cài đầu, chạy `npm start` và mở biểu tượng CareConnect trên emulator; sửa JavaScript/TypeScript dùng Fast Refresh, không cần cài lại hay bấm Connect. Chỉ build/cài lại khi đổi native code hoặc native dependency. Lần đầu chuyển từ Expo sang CLI cần đăng nhập lại vì refresh token trong Expo SecureStore không được di chuyển.

`API_URL` trong `.env` là origin gateway, không thêm `/api/v1`; app tự thêm đường dẫn này. Đây là cấu hình public, không đặt secrets. Android Studio Emulator dùng `http://10.0.2.2:8080`; LDPlayer/USB dùng `http://127.0.0.1:8080` sau `adb reverse` cho 8080 và 8090. Gateway/BE chạy riêng. Sau khi đổi `.env`, khởi động lại Metro bằng `npm start -- --reset-cache`.

## Chức năng

- Năm tab Hôm nay, Buổi được giao, Ca làm việc, Lịch rảnh, Hồ sơ. Lịch sử hoàn thành nằm trong Buổi được giao → Lịch sử. Bộ lọc ngày/trạng thái mở riêng; chỉ Áp dụng bộ lọc mới đổi truy vấn.
- Đăng nhập ACTIVE + CAREGIVER, khôi phục phiên/refresh, quên/đặt lại/đổi mật khẩu và đăng xuất.
- Lịch hôm nay/sắp tới/tất cả, lọc ngày/trạng thái, phân trang, lịch phân công Provider; lịch sử COMPLETED không giới hạn ngày mặc định.
- Chi tiết người bệnh/snapshot được BE cấp, địa chỉ, dịch vụ, thuốc, lưu ý và liên hệ. Không suy đoán thông tin y tế thiếu.
- Nhận ca, bắt đầu bằng sessionId thật, checklist DONE/SKIPPED/PENDING, lý do bỏ qua, thêm việc, ghi chú/chỉ số tùy chọn và xác nhận kết thúc.
- Báo cáo nháp có version, chủ động chọn tình trạng, tóm tắt bắt buộc và khuyến nghị tùy chọn. Chọn ảnh trước khi có nháp chỉ giữ URI trong bộ nhớ; Lưu/Gửi lưu nháp rồi tải ảnh lên. Gửi cần session ENDED và xác nhận; đã gửi chỉ đọc. BE thông báo customer sở hữu booking.
- Hồ sơ cá nhân/chuyên môn, kỹ năng, chứng chỉ/tài liệu; sửa tài khoản theo DTO Identity.
- Inbox, badge/banner foreground cập nhật mỗi 30 giây và khi resume. BE chưa có hợp đồng FCM, nên chưa có push khi đóng app.
- Tiếng Việt/Anh; loading/empty/retry/denied, khóa pending writes, giữ form khi lỗi, xác nhận rời form bẩn.

Đăng ký ca nằm trong tab **Ca làm việc**: ca sắp tới có nút Đăng ký ca hoặc nhãn Đã đăng ký; Đăng ký của tôi nằm phía dưới. Hồ sơ phải ACTIVE/VERIFIED để đăng ký. PENDING được hủy sau xác nhận với version BE; APPROVED tạo lịch rảnh và không hủy qua luồng đăng ký. Booking chăm sóc nằm riêng trong Buổi được giao. Tự khai ngày nghỉ chưa nằm trong phạm vi hiện tại.

## Quy tắc

Chỉ gateway `/api/v1`. Auth `/auth/login` và `/auth/refresh` với `X-Client-Type: mobile`, bearer access token trong RAM và refresh token trong secure storage của thiết bị. Không cookie web, token/password/patient logs, patient cache bền vững hoặc offline write queue. Logout xóa UI/forms/memory/pollers; response phiên cũ bị loại.

401 dùng chung refresh và thử lại tối đa một lần sau lỗi xác thực. Không tự lặp mutation sau timeout/đứt mạng/5xx; phải đọc lại trạng thái trước khi tiếp tục. Report conflict phải đọc version mới. Không giả thành công.

Check-in mặc định từ 30 phút trước đến trước 30 phút sau startAt và trước endAt; BE quyết định cuối. Work shifts là local Việt Nam UTC+07; Booking timestamps là Instants hiển thị theo timezone thiết bị; query ngày dùng ngày Việt Nam. Vị trí là tùy chọn, foreground khi check-in/out, không tracking nền.

Ảnh báo cáo JPEG/PNG/WebP tối đa 10 MB/ảnh, tổng tối đa 5 ảnh đã lưu và ảnh chờ. Chọn/bỏ ảnh chờ không ghi API. Không sao chép ảnh vào patient cache; ảnh báo cáo đã lưu mở bằng HTTPS. Server kiểm tra file và quyền sở hữu. Kết quả upload chưa rõ phải đọc lại trạng thái, kiểm tra ảnh máy chủ và bỏ batch ảnh chờ đó trước khi chọn lại; app không tự upload lại.

## Kiểm tra và build

    npm run check
    npx react-native config
    npm run doctor
    npm run build:android

Script build chạy Gradle `assembleDebug` từ native source và chép APK tới `artifacts/careconnect-react-native-debug.apk` (gitignore). **APK debug cần Metro 8090 để chạy JavaScript**; không có launcher hoặc embedded bundle. Build đầu có thể tải SDK/NDK/dependency còn thiếu.

Release cần gateway HTTPS và signing riêng; HTTP chỉ bật trong Android debug. Chưa cấu hình phát hành hoặc signing release. Không commit signing keys, local SDK paths hoặc output build.

`npm run check` gồm formatter, ESLint, strict TypeScript và Jest. Test dùng fake transport/native mocks, không chứng minh giao dịch BE thật. CI kiểm tra source, autolinking config và Android debug build; `doctor` chạy tương tác ở máy phát triển.

## Cấu trúc và tài liệu lịch sử

`App.tsx` gắn provider; `src/app` ghép auth guard/tab/stack và routes. `src/core` chứa HTTP/session, parser, dịch, theme, shared UI và device helpers; không import feature. `src/features` sở hữu nghiệp vụ và repository cho các workflow lặp lại. Xem [ARCHITECTURE.md](ARCHITECTURE.md) và [AGENTS.md](AGENTS.md).

Tài liệu Flutter ngày 30/10/2026 và kế hoạch Expo trước quyết định CLI ngày 01/11/2026 là lịch sử. Kết quả Expo cũ không chứng minh bản CLI đã qua kiểm thử. Bản dự phòng Flutter local trong `artifacts/flutter-source-before-react-native-20261101.zip` và `artifacts/flutter-legacy/` bị gitignore. Native source `android/` và `package-lock.json` đi cùng app source; `.env`, dependencies và output build không được commit.
