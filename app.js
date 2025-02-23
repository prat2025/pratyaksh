require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const pdf = require('html-pdf');
const fs = require('fs');
const multer = require('multer'); // Ensure multer is required
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Route for login page
app.get('/', (req, res) => {
  res.render('login', { errorMessage: null });
});

// Handle login logic
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ?';

  db.query(query, [username], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) throw err;
        if (isMatch) {
          res.redirect('/terms/1');
        } else {
          res.render('login', { errorMessage: 'Invalid credentials. Please try again.' });
        }
      });
    } else {
      res.render('login', { errorMessage: 'User not found. Please register.' });
    }
  });
});

// Route to display terms and handle agreement
app.get('/terms/:termId?', (req, res) => {
  const termId = req.params.termId ? parseInt(req.params.termId) : 1;
  const query = 'SELECT * FROM terms ORDER BY id ASC';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching terms:', err);
      return res.status(500).send('Error fetching terms');
    }
    const currentTerm = results.find((term) => term.id === termId);

    if (currentTerm) {
      res.render('terms', { terms: [currentTerm], currentTermId: termId, errorMessage: null });
    } else {
      res.redirect('/signature');
    }
  });
});

// Handle the acceptance of terms and redirect to next term
app.post('/agree/:termId', (req, res) => {
  const { termId } = req.params;
  const { agreed } = req.body;

  if (agreed === 'yes') {
    const nextTermId = parseInt(termId) + 1;
    res.redirect(`/terms/${nextTermId}`);
  } else {
    res.render('terms', { terms: [], currentTermId: termId, errorMessage: 'You must agree to this term to proceed.' });
  }
});

// Route to display signature pad after terms
app.get('/signature', (req, res) => {
  res.render('signature');
});

// Handle saving the signature image and generating the PDF
app.post('/save-signature', upload.single('signature'), (req, res) => {
  const { file } = req;
  const termsAgreed = req.body.termsAgreed ? JSON.parse(req.body.termsAgreed) : [];

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const signaturePath = `public/signature_${Date.now()}.png`;
  fs.renameSync(file.path, signaturePath);

  const html = `<h1>Bond Agreement</h1>
    <p>User has agreed to the following terms:</p>
    <ul>
      ${termsAgreed.map(term => `<li>${term}</li>`).join('')}
    </ul>
    <h3>Digital Signature:</h3>
    <img src="${signaturePath}" width="100" height="50">`;

  const options = { format: 'Letter' };
  pdf.create(html, options).toFile('./signed_bond.pdf', (err, result) => {
    if (err) {
      console.log(err);
      res.send('Error generating PDF');
    } else {
      console.log(result);
      res.send('Bond saved as PDF');
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
