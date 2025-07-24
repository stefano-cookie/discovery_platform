-- Script to setup PostgreSQL database for Discovery Platform
-- Run this as PostgreSQL superuser

-- Create database
CREATE DATABASE discovery_db;

-- Create user
CREATE USER discovery_user WITH ENCRYPTED PASSWORD 'discovery_secure_password_2025';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE discovery_db TO discovery_user;

-- Connect to the database
\c discovery_db

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO discovery_user;