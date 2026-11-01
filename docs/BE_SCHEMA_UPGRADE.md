# BE sau khi pull code mới nhưng giữ database cũ

Đối chiếu mã BE ngày 01/11/2026 tại `C:/Users/Juuga/Documents/MSS301/BE`.
Tài liệu này hướng dẫn thao tác thủ công. Ba migration đã được thực thi theo yêu cầu riêng của người dùng; xem [kết quả và backup](BE_SCHEMA_UPGRADE_RESULT.md). Source BE/FE không bị sửa.

## Nguyên nhân

Code mới cần schema mới. `git pull` cập nhật mã nguồn; dữ liệu/schema trong
database hoặc Docker volume cũ vẫn còn nguyên. Cả ba service đang cấu hình
`spring.jpa.hibernate.ddl-auto: validate` và `spring.sql.init.mode: never`.
Hibernate kiểm tra schema khi khởi động, không tự nâng cấp database.

`BE/DOCKER.md` cũng xác nhận SQL trong `/docker-entrypoint-initdb.d` chỉ khởi
tạo database mới; volume đã có dữ liệu phải áp change script. Rebuild image
không thay thế bước này. Việc giữ dữ liệu cũ là bình thường, nhưng phải nâng
schema tương ứng phiên bản code.

## Ba script khớp lỗi hiện tại

Các đường dẫn sau tính từ gốc repo **BE**, không phải repo mobile:

| Service / database mặc định | Script hiện có | Tác dụng |
| --- | --- | --- |
| CareRecipient / `CARECONNECT_CARE_RECIPIENT` | `CareRecipientService/schema/changes/2026-10-30-manager-invitations.sql` | Tạo bảng invitations, khóa ngoại và các index |
| Booking / `CARECONNECT_BOOKING` | `BookingService/schema/changes/2026-10-30_care_session_auto_close.sql` | Thêm `care_sessions.auto_closed BOOLEAN NOT NULL DEFAULT false` |
| Catalog / `CARECONNECT_CATALOG` | `CareCatalogService/schema/changes/2026-10-30_catalog_version.sql` | Thêm `version BIGINT NOT NULL DEFAULT 0` cho **care_services, center_services và price_plans** |

Ba script này dùng transaction và `IF NOT EXISTS`, bổ sung schema, không có
lệnh xóa bản ghi hoặc drop bảng. Vẫn cần backup và kiểm tra đúng database trước
khi áp dụng. Nếu schema từng được sửa tay, phải kiểm tra định nghĩa thực tế;
`IF NOT EXISTS` không sửa một bảng/cột đã có nhưng sai cấu trúc.

## Quy trình giữ dữ liệu cũ

1. Backup ba database liên quan; giữ bản backup ngoài container và kiểm tra
   có thể đọc/restore trên môi trường thử. Không reset database/volume.
2. Tạm dừng các ứng dụng ghi vào ba database trong thời gian nâng schema;
   giữ PostgreSQL chạy. Kiểm tra database/schema đang kết nối bằng
   `SELECT current_database(), current_schema();`.
3. Mở từng file SQL **hiện có trong BE**, áp vào đúng database tương ứng.
   Dùng `psql -v ON_ERROR_STOP=1` hoặc công cụ SQL có dừng khi lỗi. Không chạy
   lại file schema khởi tạo toàn bộ trên database đang chứa dữ liệu.
4. Nếu SQL báo lỗi, dừng và kiểm tra nguyên nhân; không bỏ constraint hoặc
   đổi `ddl-auto` sang `update/create` để vượt kiểm tra.
5. Khởi động lại ba service, kiểm tra log schema validation và healthcheck.
   Chỉ kiểm tra nghiệp vụ mobile khi gateway và service đã hoạt động.

Nếu dùng PostgreSQL trực tiếp/pgAdmin/DBeaver, làm theo các bước trên với
database thật trong cấu hình của từng service. Tên database ở bảng là mặc định,
có thể đã được team thay đổi.

## Ví dụ cho Docker Compose tổng của BE

Chạy PowerShell ở **gốc BE**, nơi có `compose.yaml`. Chỉ dùng các lệnh này nếu
bạn đang dùng stack tổng hiện tại, có các service PostgreSQL tương ứng. Không
khởi động thêm stack PostgreSQL riêng cùng dùng một volume.

Ví dụ backup một database bằng custom-format dump; `docker compose cp` giữ
nguyên dữ liệu nhị phân, tránh redirect dump nhị phân bằng PowerShell cũ:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec -T care-recipient-postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/before-schema-upgrade.dump'
docker compose cp care-recipient-postgres:/tmp/before-schema-upgrade.dump ./backups/care-recipient-before-upgrade.dump
```

Thực hiện backup tương tự cho `booking-postgres` và `care-catalog-postgres`,
lưu thành file riêng. Kiểm tra từng lệnh thành công trước khi thực hiện tiếp.

Sau khi đã backup và xác minh đúng database, áp ba script (mỗi lệnh vào một DB):

```powershell
Get-Content -Raw ./CareRecipientService/schema/changes/2026-10-30-manager-invitations.sql | docker compose exec -T care-recipient-postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

Get-Content -Raw ./BookingService/schema/changes/2026-10-30_care_session_auto_close.sql | docker compose exec -T booking-postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

Get-Content -Raw ./CareCatalogService/schema/changes/2026-10-30_catalog_version.sql | docker compose exec -T care-catalog-postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`POSTGRES_USER` và `POSTGRES_DB` được đọc trong container; không cần chép mật
khẩu vào hướng dẫn hoặc log. Sau từng lệnh, kiểm tra `$LASTEXITCODE` bằng 0 và
kết quả SQL commit thành công. Không chạy tiếp nếu một lệnh lỗi.

Sau khi schema hợp lệ, cập nhật/chạy lại ba ứng dụng theo cách team triển khai.
Với stack Compose tổng:

```powershell
docker compose up -d --build care-recipient-service booking-service care-catalog-service
docker compose ps
```

Các lệnh tương ứng đã được thực thi cho ba service theo yêu cầu người dùng; xem [biên bản thực thi](BE_SCHEMA_UPGRADE_RESULT.md).

## Kiểm tra các thay đổi khác trong lần pull

Ba file trên khớp ba lỗi đang báo, chưa chứng minh toàn bộ database đã đồng bộ
mọi commit mới. Đối chiếu mốc code/schema đang dùng với các change script chưa
áp dụng. Không chạy hàng loạt tất cả SQL theo wildcard.

Đặc biệt Booking còn có
`BookingService/schema/changes/2026-10-30_notification_recipient_invitation.sql`
để constraint notifications chấp nhận loại `RECIPIENT_INVITATION`, liên quan
chức năng lời mời quản lý hồ sơ mới. Đây là thay đổi constraint riêng, cần
review/áp dụng khi nâng chức năng tương ứng, không chỉ tạo bảng invitations.

Tham khảo `BE/DOCKER.md`, README của từng service và nội dung change script.
Nếu xuất hiện lỗi schema tiếp theo, kiểm tra migration còn thiếu trước khi sửa
code mobile hoặc bỏ kiểm tra schema của BE.
