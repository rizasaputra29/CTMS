# CTMS (Capstone / Tugas Akhir Management System)

A comprehensive web application designed for managing student academic projects such as Capstone and Tugas Akhir (Final Project). The system provides structured workflows, document tracking, scheduling, and role-based access for Admins, Lecturers (Dosen), and Students (Mahasiswa).

## Tech Stack

**Frontend:**

- Next.js 16 (React 19)
- Tailwind CSS (v4)
- Shadcn UI & Radix UI
- TypeScript

**Backend:**

- Laravel 12 (PHP 8.2+)
- PostgreSQL

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- Node.js (v18+ recommended)
- npm or pnpm
- PHP 8.2 or higher
- Composer
- Database server (MySQL, PostgreSQL) or SQLite

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd CTMS
```

### 2. Backend Setup

Open a terminal and navigate to the `backend` directory:

```bash
cd backend
```

Install PHP dependencies:

```bash
composer install
```

Set up the environment variables by copying the example file:

```bash
cp .env.example .env
php artisan key:generate
```

Configure your database connection in the `.env` file. If you want to use SQLite for quick local development, you can create the database file and run the migrations:

```bash
touch database/database.sqlite
php artisan migrate --seed
```

Start the Laravel development server:

```bash
php artisan serve
```

The backend API will typically be accessible at `http://localhost:8000`.

### 3. Frontend Setup

Open a new terminal window and navigate to the `frontend` directory:

```bash
cd frontend
```

Install Node.js dependencies:

```bash
npm install
# or if using pnpm: pnpm install
```

Configure the frontend environment variables. Create a `.env.local` file (or copy from `.env.example` if it exists) in the `frontend` directory and define your API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Start the Next.js development server:

```bash
npm run dev
# or: pnpm run dev
```

The frontend application will be accessible at `http://localhost:3000`.

---

## Features

- **Role-Based Access Control**: Tailored dashboards and permissions for Admins, Lecturers, and Students.
- **Schedule System**: Context-aware scheduling for events like SEMPRO, SIDANG, EXPO, and BIMBINGAN with visibility restrictions based on the user's role.
- **Document Management**: Stepper-based document submission, review, and approval cycles.
- **Group Management**: Tools to manage and organize student groups for their Capstone/Tugas Akhir projects.
- **Portfolio Gallery**: A dedicated space to showcase completed student projects with detailed views.

## Contributing

Follow standard Git workflows to contribute: create a feature branch, commit your changes, and open a Pull Request. Please ensure code conforms to the existing Prettier/ESLint rules in the frontend and Laravel standards in the backend.
