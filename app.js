// --- Set these values in your environment variables
const PORT = process.env.PORT;
const TEST_MODE = process.env.TEST_MODE == 'true';

const STRIPE_SECRET = process.env.STRIPE_SECRET;
const STRIPE_KEY = process.env.STRIPE_KEY;
const STRIPE_KEY_TEST = process.env.STRIPE_KEY_TEST;

const RC_API_KEY = process.env.RC_API_KEY;

const SUCCESS_URL = process.env.SUCCESS_URL;
const CANCEL_URL = process.env.CANCEL_URL;
const corsOrigins = process.env.CORS_ORIGINS;
// -------------------



// --- Imports
const express = require('express');
const cors = require('cors')
const createError = require('http-errors');
const path = require('path');
// -------------------



// --- Axios request library
const axios = require('axios').create({
  baseURL: 'https://api.revenuecat.com/v1',
  headers: { 'X-Platform': 'stripe', 'Authorization': `Bearer ${RC_API_KEY}` }
});
// -------------------

const Stripe = require('stripe')
const stripe = Stripe(STRIPE_SECRET)

// --- Express app setup
const app = express();

const corsOptions = {
  origin: corsOrigins.split(',')
}
app.use(cors(corsOptions))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// -------------------



// --- Landing Page
app.get('/', function (req, res, next) {
  res.render('landing', { test_mode: TEST_MODE });
});
// -------------------



// --- Endpoints
app.get('/purchase/:userId/:productId', async function (req, res, next) {

  // - Render our redirection page with context
  res.render('redirectToCheckout', {
    user_id: req.params.userId,
    email: req.query.email,
    key: (TEST_MODE == true ? STRIPE_KEY_TEST : STRIPE_KEY),
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    product_id: req.params.productId
  });

});

app.get('/cancel/:email', async function (req, res, next) {
  const customers = await stripe.customers.search({
    query: `email: "${decodeURI(req.params.email)}"`,
  });

  for(let i = 0; i < customers.data.length; i++) {
    const customer = customers.data[i]

    await stripe.customers.del(
      customer.id
    );
  }

  res.status(200).json();
});

app.post('/webhooks/stripe', async function (req, res, next) {

  // - Ensure there is a purchase object
  let purchaseObject = req.body?.data?.object
  if (purchaseObject) {

    // - Get the associated app user ID and token
    let userId = purchaseObject.client_reference_id;
    let token = purchaseObject.subscription;

    // - Print to log
    console.log(userId);
    console.log(token);

    // - Post receipt data to RevenueCat
    axios.post('/receipts', {
      app_user_id: userId,
      fetch_token: token,
      attributes: { "stripe_customer_id": { value: purchaseObject.customer } }
    })
      .then(function (response) {
        // TODO: ensure a successful response from RevenueCat, retry if necessary
      })
      .catch(function (error) {
        // TODO: error- retry if necessary
      });

    // - Respond to Stripe to let them know we got the webhook
    res.status(200).json();

  } else {

    // - No purchase object found
    console.log("No purchase found in webhook body:")
    console.log(req.body);

    res.status(400).json();
  }

});
// -------------------



// --- Catch generic errors
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = TEST_MODE ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
// -------------------



// --- Start listening
app.listen(PORT, function () {
  console.log(`App is listening on port ${PORT} - Test Mode: ${TEST_MODE}`);
});
// -------------------
