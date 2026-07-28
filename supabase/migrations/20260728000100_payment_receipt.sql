-- Migration: 20260728000100_payment_receipt.sql
-- Add receipt_path to payments table to store resident uploaded payment proof screenshots / PDFs.

alter table payments add column if not exists receipt_path text;
