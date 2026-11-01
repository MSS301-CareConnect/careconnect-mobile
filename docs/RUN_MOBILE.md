# Hướng dẫn chạy CareConnect Mobile (React Native CLI)

Repository này dùng **React Native CLI + TypeScript**, hiện chỉ nhắm **Android**, cho tài khoản CAREGIVER. `android/` là native source được quản lý trong Git, có thể mở bằng Android Studio. Quyết định CLI ngày 01/11/2026 thay thế kế hoạch Expo trung gian; không chạy Expo prebuild hoặc development launcher.

## 1. Chuẩn bị máy phát triển Android

Cài Node.js 24 LTS (kèm npm), JDK 21 và Android Studio. Trong SDK Manager, cài Android SDK Platform 37, Build Tools 37.0.0, Platform Tools và Command-line Tools. Dự án dùng React Native 0.88.1, React 19.3.0, Community CLI 20.2.0, TypeScript 6, Gradle 9.4.1, NDK 27.1.12297006 và CMake 3.22.1. Android chạy từ API 24 trở lên. Build đầu cần mạng và dung lượng đĩa để tải dependency hoặc SDK còn thiếu sau khi chấp nhận licenses.

Lấy SDK Location từ SDK Manager và đặt biến môi trường trong PowerShell. Thay đường dẫn ví dụ bằng đường dẫn thật trên máy, không commit chúng:

    $env:JAVA_HOME='C:\duong-dan\jdk-21'
    $env:ANDROID_HOME='C:\duong-dan\Android\Sdk'
    $env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
    node --version
    npm --version
    java -version
    adb version

Cách này chỉ áp dụng cho cửa sổ hiện tại; có thể đặt lâu dài trong Windows Environment Variables. Android Studio → Settings → Build Tools → Gradle cũng cần dùng JDK 21. `android/local.properties` có thể chứa `sdk.dir=C:/duong-dan/Android/Sdk` nếu cần; file riêng của máy này bị gitignore.

## 2. Cài thư viện và cấu hình gateway

Mở Terminal tại gốc repo, nơi có `package.json`:

    npm ci

Chỉ tạo `.env` nếu chưa có, để tránh ghi đè cấu hình hiện tại:

    Copy-Item .env.example .env

Dependency được khóa trong `package-lock.json`; giữ file này cùng app source và không trộn npm/yarn/pnpm. Trong `.env`, đặt `API_URL` là **origin API gateway**, không thêm `/api/v1` và không trỏ trực tiếp tới microservice. App tự thêm `/api/v1`.

| Thiết bị                            | Giá trị ví dụ                          |
| ----------------------------------- | -------------------------------------- |
| Android Studio Emulator             | `API_URL=http://10.0.2.2:8080`         |
| LDPlayer có adb reverse             | `API_URL=http://127.0.0.1:8080`        |
| Android thật qua USB có adb reverse | `API_URL=http://127.0.0.1:8080`        |
| Android thật cùng mạng LAN          | `API_URL=http://192.168.1.10:8080`     |
| Môi trường release                  | `API_URL=https://your-gateway.example` |

Địa chỉ LAN/HTTPS là ví dụ, cần thay bằng gateway thật. `API_URL` là cấu hình public được nhúng vào JavaScript, không phải nơi chứa token, mật khẩu hoặc signing secret. `.env` bị gitignore.

BE/gateway chạy theo hướng dẫn riêng; mobile không khởi động BE, tạo caregiver, seed bệnh nhân hoặc chạy migration. Kiểm tra cổng gateway trên máy phát triển:

    Test-NetConnection 127.0.0.1 -Port 8080

Dùng tài khoản **ACTIVE** có role **CAREGIVER** do trung tâm cấp. Customer/Manager/Admin không thay thế quyền caregiver. Nếu BE chưa chạy, màn đăng nhập vẫn mở được nhưng thao tác API sẽ báo lỗi kết nối, không có dữ liệu giả.

Sau khi đổi `.env`, dừng Metro rồi khởi động lại với:

    npm start -- --reset-cache

Lần đầu chuyển từ Expo sang CLI cần đăng nhập lại: refresh token trong Expo SecureStore không được di chuyển sang secure storage mới. Không tự gỡ ứng dụng hay xóa dữ liệu để xử lý việc chuyển đổi.

## 3. Cài và chạy bằng Android Studio Emulator

Đặt `API_URL=http://10.0.2.2:8080` trong `.env` cho Android Studio Emulator. Nếu vừa đổi `.env`, khởi động Metro với `npm start -- --reset-cache` thay cho `npm start`.

Trong Android Studio mở Device Manager và chạy một AVD Android API 24 trở lên. Tại gốc repo:

    adb devices
    npm start

Metro dùng **8090** vì BE Identity dùng 8081. Giữ Terminal Metro mở; trong Terminal thứ hai chạy:

    npm run android

CLI build Gradle, cài app rồi mở CareConnect. Nếu có nhiều thiết bị, dùng lệnh sau để chọn đúng thiết bị:

    npm run android -- --list-devices

`npm run android` đã bật `--active-arch-only` để build đúng kiến trúc thiết bị đang dùng. Có thể mở thư mục `android/` bằng Android Studio, chờ Gradle sync, chọn thiết bị và Run cấu hình app. Metro vẫn cần chạy tại gốc repo.

Sau lần cài đầu, chỉ cần `npm start` rồi mở biểu tượng CareConnect trên emulator. Thay đổi JavaScript/TypeScript cập nhật bằng Fast Refresh. Không cần cài lại hay bấm Connect cho mỗi lần sửa giao diện. Khi sửa native Android, native dependency hoặc cấu hình native, chạy lại `npm run android` hoặc build/Run bằng Android Studio.

`android/` là source native: chỉnh trực tiếp và giữ thay đổi trong Git. Không dùng Expo config/plugins để sinh lại thư mục này.

## 4. LDPlayer và điện thoại Android thật

Với LDPlayer, bật ADB debugging cục bộ rồi chạy:

    .\scripts\connect-ldplayer.ps1
    adb devices

Script mặc định kết nối `127.0.0.1:5555`, reverse gateway 8080 cùng Metro 8090. Đặt `API_URL=http://127.0.0.1:8080`, chạy `npm start`, rồi `npm run android` ở Terminal khác để cài lần đầu. Những lần sau mở app từ biểu tượng. Chạy lại script kết nối sau khi khởi động lại LDPlayer. Có thể truyền `-AdbPath` hoặc `-Address`; xem [LDPLAYER.md](LDPLAYER.md).

Với điện thoại Android thật, bật Developer options/USB debugging, kết nối USB và chấp nhận quyền ADB. Kiểm tra `adb devices`, rồi reverse hai cổng trước khi chạy Metro/cài app:

    adb reverse tcp:8080 tcp:8080
    adb reverse tcp:8090 tcp:8090

Đặt `API_URL=http://127.0.0.1:8080`. Khi có nhiều thiết bị, thêm `-s DEVICE_ID` ngay sau `adb` trong các lệnh reverse/install. Nếu dùng LAN, điện thoại phải truy cập được gateway/Metro qua mạng; dùng IP LAN thật và kiểm tra firewall. HTTP local chỉ cho Android debug; release dùng HTTPS.

## 5. Build APK debug

Trong PowerShell tại gốc repo, sau khi cấu hình JDK/SDK:

    npm run build:android

Script chạy Gradle `assembleDebug` từ native project hiện có và chép APK tới:

    artifacts/careconnect-react-native-debug.apk

Cài vào thiết bị đã kết nối:

    adb install -r artifacts/careconnect-react-native-debug.apk

**APK debug cần Metro 8090 để chạy JavaScript.** Chạy `npm start`, giữ kết nối Metro phù hợp với emulator/USB/LAN rồi mở CareConnect. APK này không có Expo launcher hay embedded bundle và không phải bản phát hành cửa hàng.

Release chưa được cấu hình: cần gateway HTTPS và signing riêng. Không dùng debug key để ký release, không đưa signing key, mật khẩu, local SDK paths hoặc output build vào Git.

## 6. Kiểm tra trước khi bàn giao

    npm run check
    npx react-native config
    npm run doctor
    npm run build:android

`npm run check` chạy formatter, ESLint, strict TypeScript và Jest; `react-native config` kiểm tra cấu hình/autolinking; `doctor` kiểm tra công cụ môi trường ở máy phát triển. Không tắt lint, giảm ngưỡng hoặc bỏ test để qua kiểm tra. Test dùng fake API/native mocks, không chứng minh giao dịch BE thật. CI chạy cài dependency, check, native config và Gradle debug build; không chạy doctor tương tác.

CLI doctor mặc định tìm Metro ở 8081. Khi kiểm tra dự án này, đặt `$env:RCT_METRO_PORT='8090'` trước `npm run doctor`. Doctor20.2 hiện khai báo dải JDK17–20 và có thể báo lỗi JDK21; bản native của dự án đã build thành công với JAVA_HOME21. Nếu `java -version` ra25 trong khi JAVA_HOME trỏ21, đưa `$env:JAVA_HOME\bin` lên đầu PATH như bước chuẩn bị. Giữ nguyên kiểm tra; phân biệt cảnh báo phiên bản của doctor với kết quả Gradle thực tế.

Để thử luồng giao diện, kiểm tra đăng nhập, năm tab, danh sách/chi tiết ca, mở báo cáo/chọn ảnh và luồng denied/retry trên thiết bị. Ghi rõ kiểm chứng nào dùng BE thật, thao tác nào chưa xác nhận và các giới hạn môi trường; không coi kết quả Expo cũ là kết quả CLI mới.

## 7. Xử lý lỗi thường gặp

Nếu BE báo thiếu bảng/cột sau khi cập nhật mà vẫn dùng database cũ, xem [hướng dẫn nâng schema BE và giữ dữ liệu](BE_SCHEMA_UPGRADE.md). Rebuild mobile hoặc image BE không tự nâng schema cũ.

| Lỗi                                              | Cách xử lý                                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Không tìm thấy node/npm/java/adb                 | Kiểm tra PATH/JAVA_HOME/ANDROID_HOME và mở lại Terminal.                                                                                            |
| Gradle không tương thích Java                    | Kiểm tra `java -version`, JAVA_HOME và Gradle JDK trong Android Studio cùng trỏ JDK 21.                                                             |
| SDK location not found                           | Đặt ANDROID_HOME hoặc tạo `android/local.properties` với `sdk.dir=` và đường dẫn dùng dấu `/`; không commit file này.                               |
| Thiếu SDK/NDK/license                            | Dùng SDK Manager và Command-line Tools, chấp nhận licenses; giữ các phiên bản đã khóa.                                                              |
| Ninja báo đường dẫn quá dài trên Windows         | Giữ cấu hình CMake của native project và đặt repo ở đường dẫn ngắn hơn; không chạy Expo prebuild để xử lý.                                          |
| Không thấy thiết bị hoặc trạng thái offline      | Kiểm tra `adb devices`, quyền USB, emulator; LDPlayer cần chạy lại script kết nối.                                                                  |
| Unable to load script/could not connect to Metro | Chạy `npm start` tại repo, kiểm tra cổng 8090 và reverse/LAN. APK debug cần Metro.                                                                  |
| API lỗi trên emulator                            | Android Studio Emulator dùng `10.0.2.2`; LDPlayer/USB dùng `127.0.0.1` sau reverse 8080. Kiểm tra gateway.                                          |
| API URL vẫn cũ                                   | Dừng Metro rồi chạy `npm start -- --reset-cache`.                                                                                                   |
| INSTALL_FAILED_UPDATE_INCOMPATIBLE               | Bản cũ và bản mới có signing key khác nhau. Dùng emulator thử nghiệm riêng hoặc chủ động quyết định cách xử lý bản cũ; không tự gỡ app/xóa dữ liệu. |
| Phiên Expo cũ không khôi phục                    | Đăng nhập lại; refresh token Expo SecureStore không được di chuyển.                                                                                 |
| Đăng nhập web được nhưng mobile bị từ chối       | Kiểm tra ACTIVE, role CAREGIVER và đúng gateway/môi trường. App không tự cấp role.                                                                  |
| Ghi dữ liệu báo chưa rõ kết quả                  | Tải lại trạng thái máy chủ trước khi tiếp tục; không gửi lặp tự động.                                                                               |
| Không có thông báo khi đóng app                  | Bản này có inbox/banner/badge foreground; BE chưa có hợp đồng push FCM.                                                                             |

## 8. Đính kèm ảnh báo cáo

Có thể **Thêm ảnh** trước khi có báo cáo nháp. URI/metadata ảnh chờ nằm trong bộ nhớ; bỏ ảnh chờ chưa gửi API. Chủ động chọn tình trạng, điền tóm tắt bắt buộc và khuyến nghị tùy chọn, rồi bấm **Lưu bản nháp** hoặc **Gửi báo cáo cho người thân**. App lưu nháp, giữ ID/version rồi tải ảnh; Gửi chỉ tiếp tục sau xác nhận và khi ca đã ENDED. Không có tình trạng/chỉ số y tế mặc định.

Tổng ảnh đã lưu và ảnh chờ tối đa 5 ảnh JPEG/PNG/WebP, mỗi ảnh không quá 10 MB. Trên emulator, chuyển ảnh thử từ máy tính vào thiết bị ảo trước khi chọn. Hủy trình chọn giữ nguyên danh sách. App không sao chép ảnh vào patient cache; server kiểm tra nội dung và quyền sở hữu.

Nếu lưu/upload báo chưa rõ kết quả, bấm **Tải lại trạng thái**; nội dung và ảnh chờ vẫn giữ. Sau upload chưa rõ kết quả, kiểm tra ảnh đã lưu trên server, bỏ batch ảnh chờ đó trước khi chọn lại để tránh trùng. App không tự gửi lại yêu cầu. Rời bỏ form hoặc đăng xuất xóa dữ liệu chờ trong bộ nhớ; gửi báo cáo là thao tác cần xác nhận và báo cáo SUBMITTED chỉ đọc.

## 9. Kiểm thử đăng ký ca làm việc

1. Trên FE, Admin duyệt hồ sơ caregiver đạt VERIFIED/ACTIVE; Manager cùng trung tâm tạo ca OPEN trong tương lai, còn chỗ.
2. Mobile đăng nhập CAREGIVER, mở **Ca làm việc**. Ca sắp tới có ngày/giờ chính, nút **Đăng ký ca** hoặc nhãn **Đã đăng ký**. **Đăng ký của tôi** nằm ngay dưới; đăng ký quá giờ vẫn giữ lịch sử trạng thái.
3. Kiểm tra giờ Việt Nam UTC+07, trung tâm, số người được duyệt và hạn đăng ký. Nhập ghi chú tối đa 2.000 ký tự rồi gửi. Kết quả phải là PENDING, chưa tạo lịch rảnh được duyệt và chưa phải booking chăm sóc.
4. Khi PENDING, kiểm tra hủy với xác nhận và version hiện tại. Nếu Manager vừa duyệt, phải đọc lại trạng thái thay vì hủy lặp.
5. Manager duyệt trên FE; mobile tải lại để thấy APPROVED, không có nút hủy đăng ký tại **Ca làm việc**. Khung giờ duyệt xuất hiện ở **Lịch rảnh**, có luồng hủy khung rảnh riêng theo điều kiện bên dưới. Booking chăm sóc nằm trong **Buổi được giao**, lịch sử ở **Buổi được giao → Lịch sử**. Bộ lọc chỉ áp dụng khi bấm **Áp dụng bộ lọc**.
6. Thử ca đã bắt đầu, hết hạn, đủ người hoặc hồ sơ chưa xác minh: app giải thích, BE quyết định cuối. Lỗi mạng giữ ghi chú và yêu cầu đọc lại trạng thái trước lần gửi tiếp.

Jest dùng API giả có kiểm soát, không thay thế duyệt đăng ký thật trên FE/BE. Sửa JavaScript/TypeScript khi Metro chạy dùng Fast Refresh/Reload; đổi native code mới build/cài lại.

### Hủy khung rảnh

1. Mở **Lịch rảnh**, chọn khung có trạng thái **Đang mở** và chưa qua giờ kết thúc. Bấm **Hủy khung rảnh**.
2. Nhập lý do hủy (bắt buộc, tối đa 500 ký tự), kiểm tra ngày/giờ rồi xác nhận hủy trong form. Mở form hoặc nhập lý do chưa gửi yêu cầu hủy.
3. Khi backend xác nhận thành công, khung chuyển thành **Đã hủy**. Backend cũng xử lý đăng ký liên quan; không cần hủy thêm ở trang Ca làm việc.
4. Khung đã có buổi chăm sóc được phân công sẽ bị backend từ chối hủy. Nếu có lỗi mạng hoặc lịch vừa thay đổi, giữ lý do và tải lại trạng thái trước khi thử tiếp; không bấm gửi lặp.
5. Thử thêm trường hợp đóng form đang nhập lý do, lỗi đọc lại và khung đã hủy/đã qua giờ kết thúc. Các kiểm thử tự động dùng dữ liệu giả; quá trình sửa giao diện không hủy khung giờ thật.

## 10. Source và tài liệu lịch sử

Source app nằm ở `App.tsx`, `src/app`, `src/core`, `src/features`; native source ở `android/`. Giữ native project và `package-lock.json` trong Git. `.env`, `node_modules/`, `artifacts/`, native build output, `local.properties` và signing keys không được commit.

Flutter ngày 30/10/2026 và Expo trước quyết định CLI ngày 01/11/2026 là tài liệu lịch sử. Bản dự phòng Flutter local gồm thay đổi chưa commit nằm ở `artifacts/flutter-source-before-react-native-20261101.zip` và `artifacts/flutter-legacy/`, bị gitignore. Các ghi chép kiểm thử Expo cũ không chứng minh CLI/release đã qua kiểm thử.
