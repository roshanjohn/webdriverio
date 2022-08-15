import fs from 'fs';
import xml2js from "xml2js";
const reportLocation = 'report/';

async function removeSkippedAndModifyBrokenTests() {
    fs.readdirSync(reportLocation).forEach(function (folder) {
        if (folder.indexOf("-results") > 1) {
            fs.readdirSync(reportLocation + folder).forEach(function (file) {
                if (file.indexOf("testsuite.xml") > 1) {
                    console.log(file);
                    fs.readFile(reportLocation + folder + '/' + file, "utf-8", function (err, data) {
                        if (err) console.log(err);
                        xml2js.parseString(data, function (err, result) {
                            if (err) console.log(err);
                            const json = result['ns2:test-suite']['test-cases'][0]['test-case'];
                            for (let i = 0; i < json.length; i++) {
                                console.log(json[i]['$'].status);
                                if (json[i]['$'].status == 'broken') {
                                    json[i]['$'].status = 'failed';
                                }
                                if (json[i]['$'].status == 'pending') {
                                    delete json[i];
                                }
                            }
                            const xml = new xml2js.Builder().buildObject(result);
                            fs.writeFile(reportLocation + folder + '/' + file, xml, function (err) {
                                if (err) console.log(err);
                                console.log("successfully written our update xml to file");
                            });
                        });
                    });
                }
            });
        }
    });
}

async function removeImagesVisualPassedTests() {
    fs.readdirSync(reportLocation).forEach(function (folder) {
        if (folder.indexOf("-results") > 1 && process.argv[2] == 'visualRegression') {
          fs.readdirSync(reportLocation + folder).forEach(function (file) {
            if (file.endsWith('.png')) {
              fs.unlink(__dirname + '/' + reportLocation + folder + '/' + file, function (err) {
              if (err) {
                console.log(err);
              }
            });
          }
          });
          console.log("Removed redundant visual regression images");
        }
    });
}

removeSkippedAndModifyBrokenTests();
removeImagesVisualPassedTests();
