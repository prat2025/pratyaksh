require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const pdf = require('html-pdf');
const fs = require('fs');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'user_auth',
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Route for login page
app.get('/', (req, res) => {
  res.render('login');
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
          res.redirect('/terms');
        } else {
          res.send('Invalid credentials');
        }
      });
    } else {
      res.send('User not found');
    }
  });
});

// Route to display terms and handle agreement
app.get('/terms', (req, res) => {
  const query = 'SELECT * FROM terms ORDER BY id ASC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching terms:', err);
      return res.status(500).send('Error fetching terms');
    }
    res.render('terms', { terms: results });
  });
});

// Handle the acceptance of terms and redirect to next term
app.post('/agree/:termId', (req, res) => {
  const { termId } = req.params;
  const { agreed } = req.body;
  
  if (agreed === 'yes') {
    // Redirect to next term or signature pad if last term
    const nextTermId = parseInt(termId) + 1;
    res.redirect(`/terms/${nextTermId}`);
  } else {
    res.send('You must agree to this term to proceed.');
  }
});

// Route to display signature pad after terms
app.get('/terms/:termId', (req, res) => {
  const { termId } = req.params;
  const query = 'SELECT * FROM terms ORDER BY id ASC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching terms:', err);
      return res.status(500).send('Error fetching terms');
    }
    const currentTerm = results.find((term) => term.id === parseInt(termId));
    
    if (currentTerm) {
      res.render('terms', { terms: [currentTerm], currentTermId: termId });
    } else {
      res.redirect('/signature'); // All terms agreed, move to signature pad
    }
  });
});

// Signature route
app.get('/signature', (req, res) => {
  res.render('signature'); // Render signature page
});

// Handle saving the signature image and generating the PDF
app.post('/save-signature', (req, res) => {
  const { signature, termsAgreed } = req.body; // Signature image in base64 and agreed terms

  // Convert base64 to image
  const base64Data = signature.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync('signature.png', base64Data, 'base64');

  // Generate PDF with signature and terms
  const html = `<h1>Bond Agreement</h1>
    <p>User has agreed to the following terms:</p>
    <ul>
      ${termsAgreed.map(term => `<li>${term}</li>`).join('')}
    </ul>
    <h3>Digital Signature:</h3>
    <img src="signature.png" width="100" height="50">`;

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
