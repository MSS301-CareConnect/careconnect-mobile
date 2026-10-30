# Chạy CareConnect trên LDPlayer

Người dùng tự cài LDPlayer; cấu hình này không cài đặt, cập nhật hay tạo emulator.
Lưu LDPlayer ở ngoài repo, ví dụ `D:\LDPlayer\LDPlayer9`. LDPlayer 9 bản 64-bit
(Android 9) phù hợp với minSdk 24 của CareConnect. Không cần bật root.

## 1. Thiết lập LDPlayer

- Màn hình điện thoại dọc: 720 × 1280, DPI 240.
- CPU: 2 nhân; RAM: 2048 MB; FPS: 30 là đủ để thử app.
- Settings → Other settings/Others → ADB debugging → Open/Enable local connection.
- Lưu cấu hình và khởi động lại emulator nếu được yêu cầu.

Tên mục có thể khác giữa phiên bản/ngôn ngữ. Chỉ bật kết nối ADB cục bộ.
Không cần đăng nhập Google để cài app bằng Flutter/ADB.

## 2. Kết nối app

Trong terminal tại repo:

```powershell
flutter pub get --enforce-lockfile
.\scripts\connect-ldplayer.ps1
flutter run -d 127.0.0.1:5555 --dart-define=API_BASE_URL=http://127.0.0.1:8080
```

Hoặc chọn **CareConnect - LDPlayer (local API)** trong Run and Debug của VS Code
và bấm F5. Cấu hình này tự chạy script kết nối trước khi khởi động app.

Nếu dùng Android Studio: mở thư mục gốc repo, chạy script trong Terminal, chọn
thiết bị LDPlayer rồi Run cấu hình Flutter với entrypoint `lib/main.dart` và
**Additional run args** là `--dart-define=API_BASE_URL=http://127.0.0.1:8080`.
Xem [các bước Android Studio trong README](../README.md#chạy-bằng-android-studio).

Script dùng `adb.exe` trong Android SDK, kiểm tra Android API >= 24, rồi thực hiện
`adb reverse tcp:8080 tcp:8080` cho đúng thiết bị `127.0.0.1:5555`. Vì vậy
`127.0.0.1:8080` trong app trỏ về gateway trên PC, không phụ thuộc địa chỉ NAT
của LDPlayer và không yêu cầu mở firewall cho mạng LAN. Mọi API vẫn qua `/api/v1/**`.

Chạy lại script sau mỗi lần khởi động lại emulator. Nếu script không tìm được SDK:

```powershell
.\scripts\connect-ldplayer.ps1 -AdbPath 'C:\duong-dan-sdk\platform-tools\adb.exe'
```

Nếu có nhiều instance, tài liệu LDPlayer quy định port `5555 + index * 2`.
Ví dụ instance index 1:

```powershell
.\scripts\connect-ldplayer.ps1 -Address 127.0.0.1:5557
flutter run -d 127.0.0.1:5557 --dart-define=API_BASE_URL=http://127.0.0.1:8080
```

Đồng thời đổi `deviceId` trong `.vscode/launch.json` và thêm
`-Address 127.0.0.1:5557` vào args của task nếu muốn dùng F5 cho instance này.

## 3. Kiểm tra BE

Gateway phải chạy trên PC tại `http://127.0.0.1:8080`. Kiểm tra từ PC:

```powershell
curl.exe http://127.0.0.1:8080/actuator/health
```

Đã mở màn đăng nhập trên LDPlayer Android API 28 với màn hình dọc 720 × 1280,
DPI 240. Chưa xác minh đăng nhập/giao dịch với BE thật. Khi gateway chưa chạy,
app vẫn mở màn đăng nhập nếu chưa có phiên đã lưu; thao tác đăng nhập cần BE.

APK cũ trong `artifacts` dùng cấu hình Android Emulator mặc định. Để dùng cấu hình
LDPlayer/ADB reverse này, chạy bằng lệnh Flutter ở trên hoặc build lại:

```powershell
flutter build apk --debug --dart-define=API_BASE_URL=http://127.0.0.1:8080
```

Build/cache Flutter sẽ được tạo lại khi chạy. Dữ liệu LDPlayer nằm ngoài repo;
dùng `flutter clean` để dọn build/cache sau khi thử xong nếu cần.

Nguồn: [ldconsole chính thức](https://vnm.ldplayer.net/support/huong-dan-su-dung-ldconsole-ldplayer.html),
[Android ADB reverse](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server).
