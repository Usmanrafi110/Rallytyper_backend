const mysql = require("mysql2");
const connection = mysql.createConnection({
  host: "mysql.rallytyper.com",
  user: "rallytypercom1",
  password: "A9P!f-jK",
  database: "rallytyper_com_1",
});

module.exports = { connection };
