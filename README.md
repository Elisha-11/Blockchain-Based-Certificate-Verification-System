Blockchain-Based Academic Certificate Verification System
 Project Description

The Blockchain-Based Academic Certificate Verification System is a hybrid web and blockchain-based platform designed to prevent academic certificate forgery and improve certificate verification processes. The system allows educational institutions to issue digitally verifiable certificates whose cryptographic hashes are stored on a blockchain network, while certificate data is stored securely in a relational database.

The system enables:

Secure certificate issuance
Public certificate verification
Certificate revocation
Audit logging
Blockchain hash storage
QR code verification

Objectives

The main objectives of this project are:

Analyze existing certificate verification methods
Design a decentralized certificate verification architecture
Develop smart contracts for certificate hash storage
Implement a web-based certificate management system
Evaluate system performance, security, and scalability

System Architecture

The system uses a hybrid architecture combining traditional web technologies with blockchain technology.

Architecture Layers
Presentation Layer – React Frontend (Admin Dashboard & Verification Portal)
Application Layer – Node.js/Express Backend API
Data Layer – MySQL Database
Blockchain Layer – Ethereum Smart Contracts

User → Frontend → Backend API → MySQL Database
                                ↓
                           Blockchain Network

    Hybrid Storage Model
Data	                   Storage Location
Student Information	             MySQL
Certificate Metadata	        MySQL
Certificate Hash	          Blockchain
Verification Logs	            MySQL
Blockchain Transactions     	MySQL

Technology Stack
Layer	               Technology
Frontend	        React.js, Tailwind CSS
Backend	             Node.js, Express.js
Database	              MySQL 8
Blockchain	     Ethereum (Ganache / Sepolia)
Smart Contracts	        Solidity
Authentication	           JWT
Security	          bcrypt, Zod
QR Codes	              qrcode
API Testing              Postman
Version Control     	Git & GitHub

Project Structure

cert-verification-system/
│
├── controllers/
├── services/
├── repositories/
├── middleware/
├── routes/
├── utils/
├── config/
├── database/
│   └── schema.sql
├── smart-contracts/
├── frontend/
├── tests/
├── docs/
├── app.js
├── package.json
├── .env
└── README.md

System Features
Authentication & Authorization
JWT Authentication
Role-Based Access Control (RBAC)
Institution Admin Accounts
Public Verification Access
Certificate Management
Issue Certificates
Generate Certificate Hash (SHA-256)
Generate QR Code
Verify Certificates
Revoke Certificates
Audit Logging
Blockchain Integration
Store certificate hash on Ethereum blockchain
Verify certificate hash on blockchain
Track blockchain transactions
Transaction retry mechanism

Database Tables

The system database contains the following tables:

institutions
users
students
certificates
blockchain_transactions
verification_logs
revocation_logs
api_keys

Installation Guide

Clone Repository

git clone https://github.com/yourusername/blockchain-cert-verification.git
cd blockchain-cert-verification

Install Dependencies
npm install

Run Server

npm run dev

API Endpoints
Authentication
Method	Endpoint	Description
POST	/api/auth/register	Register user
POST	/api/auth/login	Login
Certificates
Method	  Endpoint	         Description
POST	/api/certificates	Issue certificate
POST	/api/verify	      Verify certificate
POST     /api/revoke           Revoke certificate

| Method | Endpoint    | Description  |
| ------ | ----------- | ------------ |
| GET    | /api/health | Health check |

Certificate Verification Process
Institution issues certificate
System generates SHA-256 hash of certificate data
Certificate metadata stored in MySQL
Certificate hash stored on blockchain
QR code generated for certificate
User scans QR code or enters certificate ID
System recomputes hash
Hash compared with stored hash and blockchain hash
Verification result returned (Valid / Invalid / Revoked)

Development Roadmap

| Phase   | Description          | Status      |
| ------- | -------------------- | ----------- |
| Phase 1 | Proposal & Research  | Complete    |
| Phase 2 | Backend & Database   | Complete    |
| Phase 3 | Smart Contracts      | In Progress |
| Phase 4 | Frontend Development | Pending     |
| Phase 5 | Testing & Deployment | Pending     |
| Phase 6 | Final Report         | Pending     |

Testing

Testing includes:

Unit Tests
Integration Tests
API Testing (Postman)
Security Testing (SQL Injection, XSS)
Smart Contract Testing
Performance Testing

Security Features
bcrypt password hashing
JWT authentication
Role-based access control
Parameterized SQL queries
Input validation using Zod
Certificate hash verification
Audit logs
Blockchain immutability

Developers

Elisha Lungu
Nkonsi David Shumba

Supervisor: Mr. Andrea Theu
Department: Computing and Informatics
University of Zambia
Year: 2026

License

This project is developed for academic and research purposes at the University of Zambia.