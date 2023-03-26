const express = require("express");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const dbUtils = require("./dbUtils");
const db = require("./database").db;
const categoryCache = require("./database").getCategories;

const app = express();
const PORT = process.env.PORT || 4040;
const redis = require("redis");
const { isValidUrl, isNullOrEmpty } = require("./Helper.js");

let redisClient;

app.set("view engine", "ejs");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
});

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// parse application/json
app.use(express.json());

app.use(express.static("views"));

// Render the form page
app.get("/main/home", (req, res) => {
  const defaults = {
    key: res.body.value,
  };
  res.render("form", { defaults });
});

app.get("/:value", apiLimiter, (req, res) => {
  console.log("value is " + req.params.value);
  let redirectUrl;

  dbUtils.getUrlByKey(req.params.value, (err, data) => {
    if (err) {
      console.error(err.message);
      res.status(500).send(err.message);
    }
    if (!Object.is(data, null)) {
      console.log(req.params.value);

      res.redirect(301, data.url);
    } else {
      const defaults = {
        value: req.params.value,
        dropdownValues: categoryCache(),
      };

      console.log(defaults);
      res.render("form", { defaults });
    }
  });
});

app.get("/get/all", apiLimiter, (req, res) => {
  db.all(
    `
  SELECT * FROM urls
`,
    [],
    (err, rows) => {
      if (err) {
        throw err;
      }

      // Convert rows to JSON and send as response
      const jsonObject = dbUtils.rowsToJSON(rows);
      res.json(jsonObject);
    }
  );
});
app.post("/add/insert", apiLimiter, (req, res) => {
  console.log(`API is listening on get /add`);

  let keyName = req.body.key;
  let UrlPath = req.body.url;

  const urlData = {
    key: req.body.key,
    url: req.body.url,
    category: req.body.dropdown,
    customvalue: req.body.customValue,
  };

  console.log(res.body);
  console.log("Key value is ", keyName);
  console.log("Value value is ", UrlPath);
  console.log("Url is ", validator.isURL(UrlPath));
  console.log("Key check ", isNullOrEmpty(keyName));

  if (validator.isURL(UrlPath) && !isNullOrEmpty(keyName)) {
    console.log(UrlPath);

    dbUtils.insertUrl(urlData, (err, data) => {
      if (err) {
        console.error(err.message);
        res.status(500).send(err.message);
      } else {
        const defaults = {
          key: data.key,
          value: data.url,
        };
        console.log(
          `Successfully inserted key '${keyName}'/value : '${UrlPath}' pair in Redis.`
        );
        res.render("success", { defaults });
      }
    });
  } else {
    res
      .status(400)
      .send(`Bad Request - key : '${keyName}'/value : '${UrlPath}'`);
  }
});

// app.delete("/remove/:keyName", apiLimiter, async (req, res) => {
//   const { keyName } = req.params;
//   redisClient.del(keyName);
//   console.log(`Deleted ${keyName} key`);
//   res.status(200).send(`Deleted ${keyName} key`);
// });

// app.get("/get/healthcheck", apiLimiter, checkRedisConnection, (req, res) => {
//   res.status(200).send("API is up and running");
// });

app.listen(PORT, () => {
  console.log(`API is listening on port ${PORT}`);
});
