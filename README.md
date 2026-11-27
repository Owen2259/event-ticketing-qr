# Event Ticketing with QR Check-in

Individual student project (Project 7) by Owen Stevens, student number 20260011.

A web application for a student society or community organiser. Organisers create events with ticket types and capacity limits. Attendees reserve tickets and receive a unique QR code for each one. At the door, the organiser enters a ticket's code on a phone-friendly check-in page, and the app marks the ticket as used. A ticket can never be checked in twice.

# Features
- Register, log in and log out. Passwords are stored hashed.
- Two roles: organiser and attendee, each with different permissions.
- Organisers create events (name, venue, date, time, capacity) with several ticket types and prices.
- Attendees browse upcoming events and reserve tickets. Sales stop when capacity is reached.
- Each ticket has a unique QR code, shown on screen and downloadable as a PNG.
- Check-in page: enter a code and the ticket is marked as used. Used, cancelled, invalid and wrong-event tickets are rejected with a clear message.
- Attendees can cancel a ticket up to 48 hours before the event. This frees the place.
- Organiser dashboard: tickets sold, checked in and remaining for each event.
- Server-side validation on every form, with clear error messages.
- Responsive layout for laptop and phone screens.

# Tech stack
- JavaScript on Node.js
- Express with EJS templates
- SQLite database
- HTML and CSS front end
- Jest and Supertest for automated tests

# How to run it

1. Install Node.js 

2. Download the project:
   git clone <repository link>
   cd event-ticketing-qr
   
3. Install the libraries:
   npm install
   
4. Create the database with sample data:
   npm run seed
   
5. Start the app:
   npm start
   
6. Open http://localhost:3000 in your browser.

Running "npm run seed" again resets the database to the sample data.

# Test logins

The password for every account is "Password123".

| Role       | Email                 |
| Organiser  | organiser@example.com |
| Attendee   | alice@example.com     |
| Attendee   | bob@example.com       |
| Attendee   | carol@example.com     |

The sample data includes an event with plenty of space, an event starting in about 24 hours (cancellation is closed), and a sold-out event. It also includes active, used and cancelled tickets.

# Running the tests

npm test

There are 61 automated tests covering authentication, role checks, event creation and validation, booking and the capacity rule, QR code generation, check-in, cancellation and the dashboard numbers.

# Business rules

- Capacity is counted across all ticket types of an event. Active and used tickets count. Cancelled tickets do not.
- Booking checks capacity and creates the ticket inside one database transaction, so two people cannot take the last place.
- Check-in rejects tickets that are already used, cancelled, unknown, or for a different event. An organiser can only check in tickets for their own events.
- Cancellation is allowed only if the event starts at least 48 hours from now.

# Project structure

src/
  server.js        starts the app
  app.js           sets up Express, sessions and routes
  db/              database schema and connection
  routes/          web routes (what happens at each address)
  services/        business rules (booking, check-in, cancellation, QR codes)
  middleware/      login and role checks
views/             EJS page templates
public/            stylesheet and browser script
scripts/seed.js    creates the sample data
tests/             automated tests

# Libraries used

- express, express-session, ejs, bcryptjs, better-sqlite3 (runtime)
- jest, supertest (testing only)
- Node.js built-in modules: crypto, zlib, fs, path

No QR code library is used. The QR code generator ("src/services/qr-code.js") and the PNG writer ("src/services/png.js") are written for this project.

# AI assistance and code declaration

I used Claude, an AI assistant, while building this project. It helped with the project and helped me with the code when i struggled. I wrote, ran, tested, and debugged the code myself. No code was copied from other projects.

# Known limitations

- Sessions are kept in memory, so everyone is logged out when the server restarts.
- The QR generator supports one size (up to 14 characters), which is enough for the 9-character ticket codes.
- Check-in uses manual code entry. Camera scanning is not built.
- No payments or emailed tickets.