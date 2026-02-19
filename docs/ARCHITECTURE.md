# System Architecture

## Overview

The system consists of three main components:

1. **IoT Node (ESP32)**: Collects sensor data and sends it to the cloud.
2. **Backend API (Vercel/Next.js)**: Ingests data, secures access, and provides query APIs.
3. **Database (Supabase)**: Stores time-series data, device registry, and alerts.

## Data Flow

```mermaid
graph LR
    ESP32[ESP32 Node] -->|POST /api/ingest (JSON + Key)| Vercel[Vercel API]
    Vercel -->|Validate & Rate Limit| Vercel
    Vercel -->|Insert (Service Role)| Supabase[(Supabase DB)]
    User[Dashboard/User] -->|GET /api/latest (Public/Anon)| Vercel
    Vercel -->|Select (Service Role)| Supabase
```

## Components

### 1. ESP32 Firmware

- **Role**: Sensor Driver & HTTP Client
- **Protocol**: HTTP POST (JSON)
- **Auth**: Shared Secret (`x-device-key`)

### 2. Vercel API (Next.js)

- **Role**: Ingestion Gatekeeper & Query Layer
- **Auth**:
  - Writes: `x-device-key` validation.
  - Reads: Public (for now) or via Dashboard session.
- **Validation**: Zod schemas ensure data integrity.
- **Rate Limit**: In-memory (per instance) to prevent spam.

### 3. Supabase (PostgreSQL)

- **Role**: Primary Data Store
- **Security**:
  - **RLS**: Enforces "Service Role only" for writes.
  - **Tables**: `devices`, `readings`, `alerts`.
