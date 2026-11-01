# Kết quả nâng schema BE — 01/11/2026

Người dùng đã yêu cầu thực thi các lệnh backup/migration/rebuild đã hướng dẫn.
Chỉ thay đổi schema theo ba script hiện có và trạng thái container liên quan;
không sửa source BE/FE, không reset database, không xóa volume.

## Backup trước migration

Thư mục local (gitignore, ACL giới hạn tài khoản Windows hiện tại và SYSTEM):
`artifacts/be-schema-upgrade-20261101T014810Z/`.

- care-recipient-postgres.dump — CARECONNECT_CARE_RECIPIENT
- booking-postgres.dump — CARECONNECT_BOOKING
- care-catalog-postgres.dump — CARECONNECT_CATALOG

Đã dùng pg_dump custom format, đọc toàn bộ archive bằng pg_restore xuất vào
/dev/null và đối chiếu SHA-256 giữa file trong container và bản sao local.
Chưa thực hiện thử restore vào một database mới. Manifest, hash, SQL đã áp và
snapshot số bản ghi nằm trong thư mục backup riêng; không đưa dump vào Git.
Bản tạm trong container được giới hạn quyền600.

## Migration đã commit

1. CareRecipientService/schema/changes/2026-10-30-manager-invitations.sql
   — tạo recipient_manager_invitations với12 cột và các index.
2. BookingService/schema/changes/2026-10-30_care_session_auto_close.sql
   — care_sessions.auto_closed BOOLEAN NOT NULL DEFAULT false.
3. CareCatalogService/schema/changes/2026-10-30_catalog_version.sql
   — version BIGINT NOT NULL DEFAULT0 cho care_services, center_services,
   price_plans.

Mỗi script dùng transaction sẵn có; psql ON_ERROR_STOP, lock_timeout10s và
statement_timeout120s. Tất cả có COMMIT thành công. Đã kiểm tra kiểu dữ liệu,
NOT NULL/default của các cột mới và số bản ghi trước/sau trong tám bảng:
care_recipients, recipient_managers, bookings, booking_occurrences,
care_sessions, care_services, center_services, price_plans. Số bản ghi không đổi.

## Rebuild và xác minh

Đã chạy docker compose up -d --build cho care-recipient-service,
booking-service, care-catalog-service trên stack careconnect hiện tại.

| Service | Docker health | GET /actuator/health |
| --- | --- | --- |
| care-recipient-service | healthy | localhost8082: UP |
| care-catalog-service | healthy | localhost8083: UP |
| booking-service | healthy | localhost8085: UP |

Log của lượt khởi động hiện tại xác nhận cả ba Application đã Started, không
còn ba lỗi schema được báo. Lỗi ngày30/10 trong lịch sử Docker log không phải
lỗi của lượt khởi động sau migration.

Gateway, Identity, Provider, Media, Payment và database phụ của chúng vẫn dừng
như trước thao tác. Chưa xác minh toàn stack hoặc giao dịch mobile qua gateway.
Không áp tự động các migration khác, bao gồm notification invitation constraint.
Không commit/push/release.
