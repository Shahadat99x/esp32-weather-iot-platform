# Project Plan

## Phase 1 - ESP32 Firmware (Current)

- [x] Basic sensor reading (DHT)
- [x] Re-try logic
- [x] Validation & Smoothing
- [x] Serial Output

## Phase 1.1 - Firmware Upgrade (Current)

- [x] Calibration Offsets
- [x] Health Score Logic
- [x] Boot Safety Defaults

## Phase 2 - Wi-Fi & Metadata (Current)

- [x] Wi-Fi Connection Manager (Reconnect, Backoff)
- [x] Device ID & Metadata
- [x] JSON Payload Builder
- [x] Structured Logging

## Phase 3 - Cloud Ingestion

- [ ] Supabase Integration
- [x] Database Schema
- [x] API Endpoint (Moved to Phase 4)

## Phase 3 - Supabase Database Setup (Current)

- [x] Initial Migration `001_init.sql`
- [x] Database Schema Documentation
- [x] RLS Strategy & Policies
- [x] Indexing Strategy

## Phase 4 - Vercel API & Storage (Completed)

- [x] Next.js Project Init
- [x] API Routes (/api/ingest, /api/latest, etc.)
- [x] Supabase Client & RLS Integration
- [x] Rate Limiting (In-Memory)

## Phase 5 - ESP32 Integration (Completed)

- [x] HTTPS Client & Auth
- [x] Outbox (Ring Buffer) & Retry Logic
- [x] Resilience Testing

## Phase 6 - Public Dashboard (Current)

- [x] Tailwind & UI Libs Setup
- [x] Dashboard UI (Hero, Charts, Grid)
- [x] Client-Side Polling & Metrics
- [x] Verification
