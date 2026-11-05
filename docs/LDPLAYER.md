# Chạy CareConnect trên LDPlayer

Thực hiện tại thư mục `careconnect-mobile`. Mở LDPlayer trước và chỉ giữ một emulator đang chạy. BE/gateway cần chạy trên máy ở cổng8080.

## 1. Kiểm tra file .env

Mở file `.env` ngay trong thư mục dự án, đặt dòng này:

```dotenv
API_URL=http://127.0.0.1:8080
```

Nếu chưa có `.env`, sao chép `.env.example` thành `.env`, rồi sửa dòng trên. Nếu vừa lấy code/cài máy mới, chạy `npm ci` một lần.

## 2. Terminal thứ nhất: chạy Metro

Tại thư mục dự án, chạy:

```powershell
npm start
```

Khi thấy `Dev server ready`, giữ Terminal này mở.

Nếu vừa đổi `.env`, dùng `npm start -- --reset-cache` thay cho `npm start`.

## 3. Terminal thứ hai: cài và mở CareConnect

Mở một Terminal khác, vẫn tại thư mục `careconnect-mobile`, chạy:

```powershell
npm run android
```

Chờ build/cài xong; CareConnect sẽ tự mở trong LDPlayer. Lần đầu build có thể lâu. Đăng nhập bằng tài khoản Caregiver.

Lệnh này tự tìm ADB và nối lại cổng gateway8080 cùng Metro8090 trước khi chạy app. Không cần nhập đường dẫn SDK hoặc chạy lệnh `adb reverse` riêng. Các kết nối này có thể mất khi khởi động lại emulator/ADB; chỉ cài app hoặc chạy Metro sẽ không tự nối cổng gateway.

Nếu đang mở nhiều emulator/điện thoại, chạy `adb devices`, rồi chọn đúng mã thiết bị, ví dụ `npm run android -- --device emulator-5554`. Với API127.0.0.1, dùng `--device SERIAL` thay cho trình chọn `--list-devices` để nối cổng đúng thiết bị.

## Những lần mở app sau

1. Mở LDPlayer.
2. Chạy `.\scripts\connect-ldplayer.ps1` để nối lại cổng, rồi `npm start`.
3. Bấm biểu tượng **CareConnect** trong LDPlayer.

Sửa giao diện JavaScript/TypeScript dùng Fast Refresh; không cần chạy lại `npm run android` mỗi lần. Chỉ build/cài lại khi đổi native code hoặc native dependency.

## Nếu gặp lỗi

- **Không tìm thấy ADB:** Android Studio → SDK Manager → SDK Tools → cài Android SDK Platform-Tools. Script tự tìm SDK mặc định trong `%LOCALAPPDATA%\Android\Sdk`.
- **Không thấy thiết bị:** mở LDPlayer, bật ADB debugging cục bộ, chạy `.\scripts\connect-ldplayer.ps1` rồi thử lại `npm run android`.
- **Không kết nối máy chủ:** kiểm tra BE/gateway8080 đang chạy, `.env` đúng như bước1 và chạy lại script kết nối.
- **INSTALL_FAILED_UPDATE_INCOMPATIBLE:** APK cũ và mới dùng khóa ký khác nhau. Giữ bản cũ nếu còn dữ liệu cần giữ; không tự gỡ/xóa dữ liệu để xử lý.

Hướng dẫn SDK/JDK, Android Studio Emulator và kiểm thử chức năng: [RUN_MOBILE.md](RUN_MOBILE.md).
