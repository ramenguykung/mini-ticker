# Mini-Ticker

A lightweight, anonymous check-in/check-out tracking system built with Next.js, Prisma, and PostgreSQL. Perfect for managing attendance, workspace occupancy, or any scenario requiring simple session tracking with privacy in mind.

## Features

- **Anonymous Check-ins** - Users can check in with custom or auto-generated anonymous IDs
- **Session Tracking** - Complete check-in and check-out history retained in the database
- **Reusable IDs** - Same anonymous ID can be used for multiple sessions over time
- **Local Storage** - Session IDs stored locally in the browser for easy management
- **Responsive Design** - Clean, modern UI built with Tailwind CSS
- ️**PostgreSQL Database** - Reliable data persistence with Prisma ORM
- **Dashboard View** - Monitor all active and historical check-ins

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Database:** PostgreSQL with [Prisma ORM](https://www.prisma.io)
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Language:** TypeScript
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- npm, yarn, pnpm, or bun package manager

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/ramenguykung/mini-ticker.git
    cd mini-ticker
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Set up your environment variables:

    ```bash
    # Create a .env file in the root directory
    DATABASE_URL="postgresql://user:password@localhost:5432/mini_ticker?schema=public"
    ```

4. Run database migrations:

    ```bash
    npx prisma migrate dev
    ```

5. Generate Prisma Client:

    ```bash
    npx prisma generate
    ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Project Structure

```text
mini-ticker/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migration files
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── checkin/       # API routes for check-in operations
│   │   ├── dashboard/         # Dashboard page for viewing all check-ins
│   │   └── page.tsx           # Main check-in page
│   ├── components/
│   │   ├── CheckInForm.tsx    # Check-in/out form component
│   │   └── CheckInList.tsx    # List of check-ins component
│   ├── lib/
│   │   ├── db.ts              # Prisma client instance
│   │   └── services/
│   │       └── CheckInService.ts  # Business logic for check-ins
│   └── generated/
│       └── prisma/            # Generated Prisma Client
```

## API Endpoints

### Check-in Operations

- `POST /api/checkin` - Create a new check-in
- `GET /api/checkin` - Get all check-ins (active and inactive)
- `POST /api/checkin/[id]/checkout` - Check out by check-in ID
- `DELETE /api/checkin/[id]` - Delete a check-in record

## Database Schema

```prisma
model CheckIn {
  id            String    @id @default(uuid())
  anonymousId   String    
  status        String    @default("active")
  checkInTime   DateTime  @default(now())
  checkOutTime  DateTime?
  deviceInfo    String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## Usage

### Check In

1. Enter an anonymous ID (or leave blank for auto-generation)
2. Click "Check In"
3. Save your Anonymous ID and Check-In ID for later use

### Check Out

1. Click "Check Out" button (uses stored Check-In ID from localStorage)
2. Your session will be marked as checked-out while retaining the record

### View Dashboard

Navigate to `/dashboard` to see all check-ins with their status and timestamps.

## Client-Side ID Access

IDs are accessible via browser localStorage:

```javascript
// In browser DevTools console
localStorage.getItem('checkInId');     // Current check-in session ID
localStorage.getItem('anonymousId');   // Your anonymous user ID
```

## Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (All) 
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add your `DATABASE_URL` environment variable
4. Deploy!

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.
