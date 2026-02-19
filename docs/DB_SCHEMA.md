# Database Schema (Supabase)

## Tables

### `devices`

| Column         | Type          | Default        | Description                                 |
| :------------- | :------------ | :------------- | :------------------------------------------ |
| `device_id`    | `text`        | PK             | Unique identifier (e.g., `esp32-246f28...`) |
| `name`         | `text`        | `'New Device'` | Friendly name                               |
| `location`     | `text`        | `null`         | Physical location (e.g., "Living Room")     |
| `created_at`   | `timestamptz` | `now()`        | Registration time                           |
| `is_active`    | `boolean`     | `true`         | Soft delete flag                            |
| `last_seen_at` | `timestamptz` | `null`         | Updated on every reading                    |

### `readings` (Time-Series)

| Column       | Type          | Description                     |
| :----------- | :------------ | :------------------------------ |
| `id`         | `bigserial`   | PK                              |
| `device_id`  | `text`        | FK to `devices`                 |
| `created_at` | `timestamptz` | **Partition Key** (Server time) |
| `temp_c`     | `real`        | Temperature (°C)                |
| `hum_pct`    | `real`        | Humidity (%)                    |
| `temp_avg`   | `real`        | Smoothed Temperature            |
| `hum_avg`    | `real`        | Smoothed Humidity               |
| `status`     | `text`        | 'OK', 'FAIL', etc.              |
| `health`     | `int`         | 0-100 score                     |
| `rssi`       | `int`         | Signal strength                 |
| `raw_json`   | `jsonb`       | Full original payload           |

### `alert_rules`

| Column      | Type        | Description                  |
| :---------- | :---------- | :--------------------------- |
| `id`        | `bigserial` | PK                           |
| `device_id` | `text`      | FK to `devices`              |
| `type`      | `text`      | `TEMP_HIGH`, `OFFLINE`, etc. |
| `threshold` | `real`      | Trigger value                |
| `enabled`   | `boolean`   | Toggle rule                  |

### `alerts`

| Column         | Type          | Description            |
| :------------- | :------------ | :--------------------- |
| `id`           | `bigserial`   | PK                     |
| `device_id`    | `text`        | FK                     |
| `severity`     | `text`        | `INFO`, `WARN`, `CRIT` |
| `message`      | `text`        | Read-friendly alert    |
| `triggered_at` | `timestamptz` | Time of event          |

## Row Level Security (RLS)

- **Public Read**: Access via view `public_readings` (active devices only) and `devices` table.
- **Service Write**: Backend (Vercel) uses `service_role` key to bypass RLS for inserts.
- **Anon Write**: Disabled.

## Common Queries

### Latest Reading

```sql
select * from readings
where device_id = 'esp32-lab-01'
order by created_at desc limit 1;
```

### Last 10 Minutes History

```sql
select created_at, temp_c, hum_pct
from readings
where device_id = 'esp32-lab-01'
and created_at > now() - interval '10 minutes'
order by created_at asc;
```

### Detect Offline (No reading in 5 mins)

```sql
select device_id, last_seen_at
from devices
where is_active = true
and last_seen_at < now() - interval '5 minutes';
```
