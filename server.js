/* eslint-disable require-jsdoc */
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const DecompressZip = require("decompress-zip");
const cors = require("cors");
const { readFile, readFileSync, unlink } = require("fs");
const XML2JS = require("xml2js");
var http = require("http");
var request = require("request");

function generateUniqueCode() {
  return crypto.randomBytes(4).toString("hex");
}

function getExtension(file) {
  return path.extname(file);
}

const application = express();
const storageConfig = multer.diskStorage({
  destination: (req, res, cb) => {
    cb(null, "./scorm-zips");
  },
  filename: (req, file, cb) => {
    cb(null, `scorm_${generateUniqueCode()}${getExtension(file.originalname)}`);
  },
});

const fileParser = multer({
  storage: storageConfig,
});
application.use(cors({ origin: true }));
application.use("/scorms", express.static("./scorm-repo"));
application.use("/static", express.static("./static-assets"));

application.post(
  "/upload-scorm",
  fileParser.single("scorm_file"),
  (req, res) => {
    const scormPackage = req.file.path;
    let destination =
      "scorm-repo\\" + path.basename(scormPackage, getExtension(scormPackage));
    console.log(destination);
    const unzipper = new DecompressZip(scormPackage);

    unzipper.on("error", (error) => {
      res.status(500).json(error.message);
    });
    unzipper.extract({ path: destination });

    unzipper.on("extract", () => {
      readFile(destination + "/imsmanifest.xml", (error, data) => {
        if (error) {
          res.status(500).json({ message: error.message });
          return;
        }
        const xml2js = new XML2JS.Parser();
        xml2js.parseString(data, (error, jsonEquivalent) => {
          const indexPath =
            jsonEquivalent.manifest.resources[0].resource[0].$.href;
          let launchURL =
            (req.hostname === "localhost" ? "http" : "https") +
            "://" +
            req.hostname +
            (req.hostname === "localhost" ? ":5000/" : "/") +
            "player?path=" +
            (req.hostname === "localhost" ? "http" : "https") +
            "://" +
            req.hostname +
            (req.hostname === "localhost" ? ":5000/" : "/") +
            destination.replace("scorm-repo", "scorms") +
            "\\" +
            indexPath;
          launchURL = launchURL.replace(/\\/g, "/");
          res.json({
            launchURL,
          });
          unlink(scormPackage, (error) => {
            if (error) {
              return;
            }
          });
        });
      });
    });
  }
);

function _eval(body, ...args) {
  const Fn = Function;
  return new Fn(args.toString(), "return " + body);
}

// application.get("/player", (req, res) => {
//   // var options = {
//   //   host: "www.sewanaholdings.com",
//   //   port: 8080,
//   //   path: "scorm/player/index.html",
//   // };

//   // http
//   //   .get(options, function (res) {
//   //     console.log("Got response: " + res.statusCode);
//   //   })
//   //   .on("error", function (e) {
//   //     console.log("Got error: " + e.message);
//   //   });

//   // request.send(null);
//   // request.onreadystatechange = function () {
//   //   if (request.readyState == 4) alert(request.responseText);
//   // };

//   const indexPath = req.query.path;
//   console.log(indexPath);

//   // var html;
//   // request(
//   //   "http://www.sewanaholdings.com/scorm/player/index.html",
//   //   function (error, response, body) {
//   //     if (!error) {
//   //       html = _eval(body, "indexPath")(indexPath);
//   //     } else {
//   //       console.log(error);
//   //     }
//   //   }
//   // );

//   // request(indexPath, function (error, response, body) {
//   //   if (!error) {
//   //     html2 = _eval(html, "indexPath")(indexPath);
//   //     res.send(html2);
//   //   } else {
//   //     console.log(error);
//   //   }
//   // });
// });

application.get("/player", (req, res) => {
  const indexPath = req.query.path;
  let html = readFileSync("player/index.html", { encoding: "utf-8" });
  html = _eval(html, "indexPath")(indexPath);
  console.log(html);
  res.send(html);
});

application.listen(process.env.PORT || 5000, () => {
  console.log(`server: http://localhost:5000/service running...`);
});

module.exports = application;
