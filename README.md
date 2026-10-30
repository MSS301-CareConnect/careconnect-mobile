# CareConnect Mobile

Ứng dụng Flutter cho **CAREGIVER**, kết nối BE CareConnect qua API gateway. Chỉ repo mobile được thay đổi; BE và FE-careconnect được đọc để đối chiếu hợp đồng và nghiệp vụ.

## Chuẩn bị môi trường Android

Yêu cầu Flutter **3.44.1** / Dart **3.12.1**, JDK 21, Android Studio và Android SDK. Thiết bị chạy app cần Android 7.0 / API 24 trở lên. iOS yêu cầu macOS/Xcode, iOS 14 trở lên.

1. Cài Flutter SDK ngoài repo, thêm thư mục `flutter/bin` vào `PATH`.
2. Trong Android Studio, mở **Settings → Plugins → Marketplace**, cài **Flutter** và Dart nếu được yêu cầu, sau đó khởi động lại IDE.
3. Mở **Tools → SDK Manager**, chuẩn bị Android SDK Platform theo yêu cầu build, SDK Platform-Tools, Build-Tools và Command-line Tools. Dùng JDK 21 cho Gradle; không thay đổi version Gradle/AGP đã khóa trong repo.
4. Mở PowerShell tại thư mục gốc `careconnect-mobile` (chứa `pubspec.yaml`) và kiểm tra:

```powershell
flutter --version
flutter doctor -v
flutter doctor --android-licenses
flutter pub get --enforce-lockfile
```

Xử lý các lỗi thuộc Android toolchain trong `flutter doctor` trước khi chạy. Nếu chỉ phát triển Android, không cần cài Xcode hoặc bộ công cụ Windows desktop. Lần build đầu cần mạng để tải dependencies và có thể mất vài phút.

## Chạy bằng Android Studio

1. Chọn **File → Open**, mở thư mục gốc **careconnect-mobile**, không chỉ mở thư mục `android`.
2. Tại **Settings → Languages & Frameworks → Flutter**, chọn đường dẫn Flutter SDK nếu IDE chưa nhận. Chạy `flutter pub get --enforce-lockfile` trong Terminal của IDE.
3. Chuẩn bị thiết bị theo một trong hai cách:
   - **Android Emulator:** mở **Tools → Device Manager**, tạo/chạy một thiết bị điện thoại Android API 24 trở lên.
   - **LDPlayer:** mở LDPlayer và chạy script kết nối theo mục bên dưới. Khi dùng LDPlayer, không cần tạo thêm Android Emulator.
4. Mở **Run → Edit Configurations**, chọn cấu hình Flutter hiện có hoặc thêm cấu hình **Flutter**, đặt **Dart entrypoint** là `lib/main.dart`.
5. Trong **Additional run args**, chọn cấu hình gateway tương ứng:
   - Android Emulator của Android Studio: `--dart-define=API_BASE_URL=http://10.0.2.2:8080`.
   - LDPlayer sau khi chạy script: `--dart-define=API_BASE_URL=http://127.0.0.1:8080`.
6. Chọn thiết bị ở thanh công cụ rồi bấm **Run ▶** hoặc **Debug**. LDPlayer có thể xuất hiện dưới tên model Android; kiểm tra ID bằng `flutter devices` nếu có nhiều thiết bị.

Sửa giao diện rồi dùng **Hot Reload** để xem thay đổi. Khi đổi `API_BASE_URL`, dừng phiên chạy và Run lại. Cấu hình `.vscode/launch.json` chỉ phục vụ VS Code; Android Studio dùng cấu hình Flutter vừa tạo.

Tham khảo: [Flutter với Android Studio](https://docs.flutter.dev/tools/android-studio), [thiết lập Android toolchain](https://docs.flutter.dev/platform-integration/android/setup).

## Chạy trên LDPlayer

LDPlayer do người dùng tự cài ngoài repo. Cấu hình nhẹ để thử giao diện: **2 CPU, RAM 2048 MB, 30 FPS, màn hình dọc 720 × 1280, DPI 240**. Đây là cấu hình khởi điểm; có thể tăng tài nguyên nếu máy chạy chậm.

1. Mở LDPlayer, vào **Settings → Other settings/Others → ADB debugging**, bật **kết nối cục bộ** rồi lưu/khởi động lại nếu được yêu cầu. Không cần bật root.
2. Tại Terminal PowerShell ở thư mục gốc repo, chạy:

```powershell
flutter pub get --enforce-lockfile
.\scripts\connect-ldplayer.ps1
flutter devices
flutter run -d 127.0.0.1:5555 --dart-define=API_BASE_URL=http://127.0.0.1:8080
```

Script kết nối instance đầu tiên tại `127.0.0.1:5555`, kiểm tra API Android và chạy `adb reverse tcp:8080 tcp:8080`. Chạy lại script mỗi lần khởi động lại LDPlayer. Sau khi kết nối, có thể dùng nút Run trong Android Studio thay cho lệnh `flutter run`.

Nếu script không tìm thấy Android SDK, lấy đường dẫn từ SDK Manager và truyền rõ `adb.exe`:

```powershell
.\scripts\connect-ldplayer.ps1 -AdbPath 'C:\duong-dan-sdk\platform-tools\adb.exe'
```

Xem [hướng dẫn LDPlayer chi tiết](docs/LDPLAYER.md) để đổi instance/cổng và dùng cấu hình VS Code có sẵn **CareConnect - LDPlayer (local API)**.

### Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không tìm thấy lệnh `flutter` | Thêm `flutter/bin` vào `PATH`, mở lại Terminal/Android Studio. |
| Android Studio chỉ có cấu hình Gradle, không có Flutter | Cài plugin Flutter và mở lại thư mục gốc chứa `pubspec.yaml`. |
| Không thấy LDPlayer trong danh sách thiết bị | Chờ LDPlayer khởi động xong, kiểm tra ADB cục bộ, chạy lại script rồi `flutter devices`. |
| Thiết bị có trạng thái `offline` | Khởi động lại LDPlayer, chạy lại script kết nối. |
| Có nhiều thiết bị Android | Chọn đúng thiết bị trong IDE hoặc chỉ định `-d` với ID từ `flutter devices`. |
| Login hiện nhưng báo lỗi kết nối khi đăng nhập | Chạy gateway BE, kiểm tra `API_BASE_URL`; với LDPlayer chạy lại script để tạo ADB reverse. |
| Build lỗi sau khi dọn cache | Chạy `flutter pub get --enforce-lockfile`, kiểm tra `flutter doctor -v`, rồi chạy lại app. |

## Kết nối BE

`API_BASE_URL` là **origin của gateway**, không thêm `/api/v1` và không trỏ thẳng tới từng microservice.

- Android emulator: `http://10.0.2.2:8080` (mặc định).
- Máy Android thật: IP LAN của máy chạy gateway, ví dụ `http://192.168.1.10:8080`. Thiết bị và máy chạy BE cần kết nối được với nhau.
- iOS hoặc release: gateway HTTPS có chứng chỉ hợp lệ. iOS giữ ATS; Android release không cho HTTP cleartext.
- Bản debug Android cho phép HTTP phục vụ phát triển cục bộ.

Đăng nhập bằng tài khoản **ACTIVE** có role **CAREGIVER** do trung tâm cung cấp. App không tự tạo tài khoản hoặc dữ liệu mẫu. Các service và cơ sở dữ liệu BE cần chạy theo hướng dẫn riêng của BE; app không khởi động hoặc thay đổi BE.

## Chức năng

- Đăng nhập, khôi phục mật khẩu, khôi phục phiên, refresh token, đăng xuất.
- Buổi được giao: lọc ngày/trạng thái, phân trang, snapshot người bệnh, thuốc, liên hệ, nhận ca, check-in và báo khách vắng mặt.
- Ca chăm sóc: checklist hoàn thành/bỏ qua/hoàn tác, thêm việc, ghi chú/chỉ số sinh tồn và check-out.
- Báo cáo: chọn tình trạng chủ động, lưu/sửa nháp với version, đính kèm ảnh, gửi sau khi kết thúc ca, chỉ đọc sau khi gửi.
- Lịch rảnh, hủy lịch có lý do, thêm/xóa khoảng nghỉ.
- Ca mở thuộc trung tâm, đăng ký, lịch sử xét duyệt; chỉ đăng ký PENDING có thể hủy qua endpoint đăng ký. Lịch đã duyệt được quản lý tại Lịch rảnh.
- Hồ sơ chuyên môn, kỹ năng, chứng chỉ/file, ảnh đại diện, thông tin tài khoản và đổi mật khẩu.
- Thông báo cá nhân, số chưa đọc, đánh dấu đã đọc và điều hướng tới buổi được giao.
- Tiếng Việt mặc định; chuyển tiếng Anh trong đăng nhập hoặc Hồ sơ.

## Các rule quan trọng

- Gọi `/auth/login`, `/auth/refresh` với `X-Client-Type: mobile`, không dùng cookie web/CSRF. BE hiện đánh dấu `/auth/mobile/*` là deprecated.
- Access token chỉ ở bộ nhớ; refresh token ở Android secure storage/iOS Keychain. Không lưu mật khẩu hoặc hồ sơ bệnh nhân xuống database cục bộ.
- Nhiều request 401 dùng chung một refresh, thử lại tối đa một lần. Lỗi mạng không tự đăng xuất và không tự lặp lại mutation có kết quả chưa rõ.
- Check-in trong khoảng ±30 phút so với giờ bắt đầu; BE là bên quyết định hợp lệ cuối cùng.
- Vị trí là tùy chọn, chỉ đọc khi check-in/out. Từ chối quyền hoặc tắt GPS vẫn có thể tiếp tục theo hợp đồng BE hiện tại.
- Giờ ca Provider là giờ Việt Nam UTC+07; timestamp Booking được đổi sang giờ thiết bị để hiển thị.
- Báo cáo không chọn sẵn tình trạng y tế. BE chỉ cho gửi khi session ENDED; SUBMITTED không thể sửa. Khi mất phản hồi, lần thử lại chủ động đọc trạng thái/version trước khi ghi; có nút Tải lại để lấy dữ liệu mới.
- Ảnh đại diện: JPEG/PNG/WebP tối đa 5 MB. Chứng chỉ: PDF/JPEG/PNG tối đa 10 MB. Ảnh báo cáo: JPEG/PNG/WebP tối đa 10 MB, tối đa 5 ảnh. Server tiếp tục kiểm tra nội dung file và quyền sở hữu.
- Thông báo tải khi mở màn/resume, số chưa đọc cập nhật khi app ở foreground. Chưa có push notification nền, chat hoặc đồng bộ offline.

## Kiểm tra và build

```powershell
dart format --output=none --set-exit-if-changed lib test
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --debug --no-pub
```

APK debug tại `build/app/outputs/flutter-apk/app-debug.apk`. Bản release cần cấu hình signing và gateway HTTPS riêng; repo chưa cấu hình phát hành cửa hàng. Gradle 9.4.1 / AGP 9.0.1, dependency Dart khóa trong `pubspec.lock`; CI chạy cùng Flutter version và các kiểm tra trên.

Trên macOS, sử dụng Swift Package Manager mặc định của Flutter. File picker yêu cầu iOS 14. Keychain entitlement và lời giải thích quyền vị trí đã khai báo. Để chỉ biên dịch quyền vị trí khi dùng app:

```bash
BYPASS_PERMISSION_LOCATION_ALWAYS=1 flutter build ios --no-codesign --dart-define=API_BASE_URL=https://your-gateway.example
```

Chưa xác minh build/ký/chạy iOS trên Windows. Không thêm quyền vị trí nền để vượt yêu cầu của plugin.

## Cấu trúc

`lib/core` chứa HTTP/session, localization, theme, widget chung và tích hợp thiết bị. `lib/features` chia theo auth, visits, sessions, reports, availability, work_shifts, profile, notifications. Các model typed và repository xử lý hợp đồng ở ranh giới API. Xem [ARCHITECTURE.md](ARCHITECTURE.md) và [AGENTS.md](AGENTS.md) trước khi mở rộng.

Tests dùng fake HTTP transport để kiểm tra client/repository thật và hành vi widget; dữ liệu kiểm thử không được đưa vào UI production. Các kiểm tra bao phủ refresh đồng thời, phiên cũ, role bị thu hồi, cửa sổ check-in, phân trang, version báo cáo, mất phản hồi, ca lịch sử bị xóa, form khoảng nghỉ và màn hình nhỏ/cỡ chữ lớn.

Chưa xác minh end-to-end với tài khoản caregiver/BE thật. Gateway localhost:8080 không phản hồi tại thời điểm kiểm tra; không có thao tác tạo tài khoản hoặc sửa dữ liệu BE trong phiên triển khai.

Kết quả xác minh ngày 30/10/2026: formatter và analyzer sạch, 25 test thành công, build APK debug thành công. Đã cài/mở trên emulator Android 36.1 và kiểm tra đăng nhập trống, chuyển ngôn ngữ, điều hướng khôi phục mật khẩu. Các tab nghiệp vụ được kiểm tra bằng widget test với fake HTTP; chưa xác minh giao dịch thật trên BE.

## Dọn dung lượng sau khi build

Chạy `flutter clean` để xóa build/cache sinh tự động. Lần chạy tiếp theo dùng `flutter pub get` rồi `flutter run` hoặc `flutter build apk`. Không lưu dữ liệu emulator trong repo.

Sau lượt dọn hiện tại, APK được giữ tại `artifacts/careconnect-debug.apk` (gitignore). Nếu không cần bản APK này, có thể xóa thư mục `artifacts`; mã nguồn và cấu hình còn khoảng 6 MB. Các lệnh build ở trên sẽ tạo lại APK tại đường dẫn build mặc định.
