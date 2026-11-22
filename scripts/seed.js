const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createDb } = require('../src/db/database');
const { generateCode } = require('../src/services/codes');

const file = path.join(__dirname, '..', 'data', 'app.db');
if (fs.existsSync(file)) fs.unlinkSync(file);
const db = createDb(file);

const hash = (pw) => bcrypt.hashSync(pw, 10);
const inDays = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
const addEvent = db.prepare('INSERT INTO events (organiser_id, name, venue, event_datetime, capacity) VALUES (?, ?, ?, ?, ?)');
const addType = db.prepare('INSERT INTO ticket_types (event_id, name, price) VALUES (?, ?, ?)');
const addTicket = db.prepare('INSERT INTO tickets (ticket_type_id, attendee_id, code, status) VALUES (?, ?, ?, ?)');

const seed = db.transaction(() => {
  const organiser = addUser.run('Olivia Organiser', 'organiser@example.com', hash('Password123'), 'organiser').lastInsertRowid;
  const alice = addUser.run('Alice Attendee', 'alice@example.com', hash('Password123'), 'attendee').lastInsertRowid;
  const bob = addUser.run('Bob Attendee', 'bob@example.com', hash('Password123'), 'attendee').lastInsertRowid;
  const carol = addUser.run('Carol Attendee', 'carol@example.com', hash('Password123'), 'attendee').lastInsertRowid;

  // Event 1
  const music = addEvent.run(organiser, 'Campus Music Night', 'Main Hall', inDays(10), 100).lastInsertRowid;
  const musicGeneral = addType.run(music, 'General', 50).lastInsertRowid;
  const musicVip = addType.run(music, 'VIP', 120).lastInsertRowid;
  addTicket.run(musicGeneral, alice, generateCode(), 'active');
  addTicket.run(musicVip, bob, generateCode(), 'active');

  // Event 2
  const quiz = addEvent.run(organiser, 'Charity Quiz', 'Student Centre', inDays(1), 60).lastInsertRowid;
  const quizEntry = addType.run(quiz, 'Entry', 20).lastInsertRowid;
  addTicket.run(quizEntry, carol, generateCode(), 'used');
  addTicket.run(quizEntry, alice, generateCode(), 'cancelled');

  // Event 3
  const gala = addEvent.run(organiser, 'Society Gala', 'Grand Ballroom', inDays(20), 3).lastInsertRowid;
  const galaStandard = addType.run(gala, 'Standard', 80).lastInsertRowid;
  addTicket.run(galaStandard, alice, generateCode(), 'active');
  addTicket.run(galaStandard, bob, generateCode(), 'active');
  addTicket.run(galaStandard, carol, generateCode(), 'active');
});

seed();
console.log('Database seeded: data/app.db');
console.log('Logins (password for all: Password123):');
console.log('  organiser@example.com');
console.log('  alice@example.com, bob@example.com, carol@example.com');