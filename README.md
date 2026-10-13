# Task Manager – Full-Stack App

A full-stack task management app with user authentication, role-based admin access and a cloud PostgreSQL database.

**Live demo:** YOUR-LIVE-LINK

> Hosted on Render's free plan, so the first load can take 30–60 seconds while the server wakes up.

## Features

- Sign up and log in with JWT authentication
- Passwords hashed with bcrypt (never stored in plain text)
- Create, edit, complete and delete your own tasks
- Filter tasks: All / Pending / Completed
- Per-user privacy: users can only see and change their own tasks
- Role-based access: an Admin panel visible only to admins
- Admin panel shows every user, their signup and last login time, and their task stats
- Pagination for large lists

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | JSON Web Tokens, bcryptjs |
| Frontend | HTML, CSS, vanilla JavaScript |
| Hosting | Render |

## Project Structure

```
task-api/
├── controllers/     # Business logic (tasks, users)
├── routes/          # API routes
├── middlewares/     # Auth (protect) and admin-only checks
├── prisma/          # Database schema and migrations
├── frontend/        # Login, dashboard and admin pages
├── makeAdmin.js     # Script to promote a user to admin
├── seed.js          # Script to create demo users
└── server.js        # App entry point
```

## API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Create an account |
| POST | `/api/auth/login` | Public | Log in and receive a token |
| GET | `/api/tasks` | Logged in | Get your tasks |
| GET | `/api/tasks/:id` | Logged in | Get one of your tasks |
| POST | `/api/tasks` | Logged in | Create a task |
| PUT | `/api/tasks/:id` | Logged in | Update a task |
| DELETE | `/api/tasks/:id` | Logged in | Delete a task |
| GET | `/api/auth/users` | Admin | All users with their tasks (paginated) |
| GET | `/api/tasks/all/with-users` | Admin | All tasks with their owners |
| GET | `/api/tasks/all/count` | Admin | Total, pending and completed counts |
| GET | `/api/tasks/user/:userId` | Admin | One user's tasks (paginated) |
| POST | `/api/tasks/assign` | Admin | Assign a task to any user |

## Run Locally

1. Clone the repo and install packages:
```bash
   git clone https://github.com/diyaagarwall004-hue/task-api.git
   cd task-api
   npm install
```
2. Create a `.env` file:
```
   DATABASE_URL="your-postgresql-connection-string"
   JWT_SECRET="any-long-random-string"
```
3. Set up the database:
```bash
   npx prisma migrate dev
```
4. Start the server:
```bash
   npm run dev
```
5. Open `http://localhost:5000`

To make a user an admin:
```bash
node makeAdmin.js user@example.com
```