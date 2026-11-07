# Hồ sơ người được chăm sóc — 07/11/2026

## Đối chiếu FE và backend

FE được tham khảo chỉ đọc tại `C:/Users/Juuga/Documents/MSS301/FE-careconnect`:

- `app/features/caregiver/visits/components/care-profile.tsx`: avatar/tên, tuổi/giới tính/nhóm máu, vận động/tự lập, bệnh nền, tóm tắt thuốc và giờ dùng, dặn dò, hai lối mở cùng hồ sơ.
- `app/features/caregiver/visits/components/recipient-profile-dialog.tsx`: hồ sơ hiện tại, dị ứng, thông tin cá nhân, sức khỏe, thuốc, tất cả liên hệ khẩn cấp và sinh hoạt.
- `app/entities/care-recipient/care-recipient-api.ts`: `fetchAssignedCareRecipient` đọc caregiver view từ `GET /care-recipients/{id}`.

BE được tham khảo chỉ đọc tại `C:/Users/Juuga/Documents/MSS301/BE`:

- BookingService: `CaregiverOccurrenceResponse` có recipientId và recipientSnapshot ở chi tiết; `RecipientSnapshot` là bản chụp lúc đặt lịch.
- CareRecipientService: controller cho CAREGIVER đọc chi tiết; `CareRecipientServiceImpl.getAssignedDetail` xác minh phân công qua BookingService, không được phân công trả404.
- `CareRecipientDetailResponse` có careSnapshot, careDetails và emergencyContacts cho caregiver. `CaregiverCareDetailsResponse` cung cấp medicalHistory/sleepHabits/heightCm/weightKg; snapshot cung cấp thuốc đang dùng. Không đọc customer/admin profile hoặc gọi thêm API để vượt phạm vi.

## Điều chỉnh cho Android

Giữ các nhóm thông tin của FE, thêm ngày sinh ngay trên thẻ tóm tắt theo yêu cầu. Dùng một cột cuộn dọc và lưới thông tin tự xuống dòng; Full profile mở toàn màn hình có nút đóng cố định và Android Back. Nút gọi/phần mở hồ sơ tối thiểu48dp, văn bản theo cỡ chữ hệ thống, safe area, màu/icon có sẵn. Ghi riêng địa chỉ hồ sơ và địa chỉ chăm sóc của ca.

UNKNOWN hiển thị Chưa xác định, thông tin trống hiển thị Chưa cung cấp; không tự suy ra không dị ứng/không bệnh. Hồ sơ đầy đủ giữ nhóm máu UNKNOWN thay vì ẩn như dialog FE. Tuổi dùng giá trị backend; ngày sinh giữ calendar date. Nút thuốc mở cùng hồ sơ như FE. Thuốc/liên hệ giữ văn bản nghiệp vụ API; mã enum được dịch Việt/Anh. Mỗi lần mở đọc lại; đóng loại bỏ dữ liệu hồ sơ khỏi component. Mất quyền xem không thay bằng dữ liệu cũ.

## Xác minh

Kiểm thử fake transport/native components tại `tests/recipient-profile.test.tsx`: thẻ nhận diện, không đọc hồ sơ trước khi bấm, thông tin caregiver đầy đủ, gọi đúng liên hệ, chặn số bị che, đóng/mở lại kiểm tra quyền mới, lỗi có thể tải lại, snapshot bị ẩn không mở API phụ, parsing ngày/thuốc/liên hệ và chặn sai recipient ID. Đây không phải bằng chứng chạy live backend.

Kết quả thực thi:

- `npx jest --runInBand tests/recipient-profile.test.tsx tests/visits.test.ts tests/visits-ui.test.tsx`:18/18 đạt, gồm4 test mới.
- `npm run check`: format/lint/TypeScript đạt; lint còn94 cảnh báo trên repo. Toàn bộ Jest:223/237 đạt,14 lỗi thuộc3 suite `home.test.tsx`, `work-shifts-ui.test.tsx`, `reports-ui.test.tsx`. Một số expectation vẫn tìm nhãn/vai trò/luồng UI trước các thay đổi đang có trong working tree (ví dụ Lịch chăm sóc hôm nay, nút Lịch sử, thẻ ca Đã đăng ký, Báo cáo đã gửi); không đổi test hoặc quy tắc sản phẩm của các phần đó để làm xanh kiểm tra lần này.
- Đã sửa tham chiếu callback reload trong hook dependency ở màn yêu cầu/buổi và khai báo kiểu ref ScrollView ở chứng chỉ để gỡ lỗi lint/TypeScript phát hiện khi kiểm tra; giữ nguyên hành vi và các thay đổi có sẵn.
- `npx react-native config`: đạt, Android/autolinking hợp lệ.
- `npm run doctor`: Android SDK/ADB/Gradle hợp lệ; báo JDK25.0.1 ngoài khoảng17–20 mà CLI doctor công bố và Metro chưa chạy. Không thay cấu hình máy.
- `npm run build:android`: BUILD SUCCESSFUL; tạo APK debug tại `artifacts/careconnect-react-native-debug.apk` (đã được gitignore).

Kiểm tra trực quan còn cần thực hiện trên thiết bị: màn hình hẹp/landscape, cỡ chữ lớn nhất, VIE/ENG, TalkBack, reduced motion, nội dung dài, nút đóng và vùng thanh hệ thống. Không cài app hoặc mở emulator trong thay đổi này.

## Bổ sung chỉ đường và sao chép địa chỉ

Đã đối chiếu thêm FE `visit-logistics.tsx` và `caregiver-format.ts`. Địa chỉ chăm sóc và địa chỉ trong hồ sơ đều có Chỉ đường/Sao chép địa chỉ, mỗi nút sử dụng đúng địa chỉ hiển thị ở phần tương ứng. Không tự lấy tọa độ hiện tại. Địa chỉ trống không có nút. Chỉ đường dùng [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started); sao chép dùng Android ClipboardManager với [cờ nội dung nhạy cảm](https://developer.android.com/develop/ui/views/touch-and-input/copy-paste), không thêm thư viện hoặc quyền hệ thống.

Native clipboard package mới yêu cầu cài lại Android bằng `npm run android`; reload Metro không đăng ký được module mới. Cờ sensitive chỉ giúp ẩn nội dung preview trên hệ thống hỗ trợ, không phải cam kết giới hạn quyền truy cập clipboard.

Kiểm thử `address-actions.test.tsx` xác minh địa chỉ Unicode/ký tự đặc biệt được encode đúng, chỉ mở Maps sau khi bấm, sao chép nguyên địa chỉ, đợi kết quả native mới báo thành công, khóa bấm lặp, xử lý thất bại/thử lại và bridge bị thiếu. Tổng4 suite liên quan (address-actions/recipient-profile/visits/visits-ui):22/22 đạt. Build Android mới thành công, `react-native config` đạt; doctor vẫn báo JDK25.0.1 ngoài dải17–20 và Metro chưa chạy. Chưa kiểm tra Maps/clipboard trên thiết bị thật; không cài app hoặc mở emulator.

Sau khi bổ sung thêm nút lịch ngày nghỉ trong cùng lượt làm việc, `npm run check` qua format/lint/TypeScript; toàn bộ test230/244 đạt,14 lỗi vẫn thuộc Home/Work shifts/Report như trên. Các kiểm thử hồ sơ/địa chỉ và33 kiểm thử ngày nghỉ/availability đều đạt. Build Android cuối cùng BUILD SUCCESSFUL.
