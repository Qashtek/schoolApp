# School Management System

A production-oriented school management system built for a single school using modern web technologies. Designed to be simple, scalable, and solo-developer friendly.

## Tech Stack

- **Frontend**: Next.js App Router with TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (local)
- **ORM**: Prisma
- **Authentication**: Auth.js (NextAuth)

## Features

- User roles: Admin, Teacher, Student, Parent
- Dashboard for each role
- Attendance tracking
- Grade management
- Student and teacher management

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SchoolApp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   - Run Prisma migrations:
     ```bash
     npx prisma migrate dev
     ```
   - (Optional) Seed a default admin:
     ```bash
     npx prisma db seed
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/` - Utilities, services, and validators
- `prisma/` - Database schema, migrations, and seed

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

## Demo Login

- Email: `admin@school.edu`
- Password: `admin123`

## Contributing

This project is designed for solo development. Keep changes simple, well-documented, and focused on scalability.

## License

[MIT License](LICENSE)
