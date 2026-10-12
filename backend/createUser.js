const bcrypt = require("bcryptjs");
const db = require("./db/db");

const users = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
  },
  {
    username: "nodal1",
    password: "nodal123",
    role: "nodal_officer",
  },
  {
    username: "incharge1",
    password: "incharge123",
    role: "incharge_officer",
  },
];

async function createUsers() {
  try {
    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      const [existingUsers] = await db.query(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [user.username]
      );

      if (existingUsers.length > 0) {
        await db.query(
          `UPDATE users
           SET password_hash = ?, role = ?
           WHERE username = ?`,
          [
            passwordHash,
            user.role,
            user.username,
          ]
        );

        console.log(
          `Updated: ${user.username} (${user.role})`
        );
      } else {
        await db.query(
          `INSERT INTO users
           (username, password_hash, role)
           VALUES (?, ?, ?)`,
          [
            user.username,
            passwordHash,
            user.role,
          ]
        );

        console.log(
          `Created: ${user.username} (${user.role})`
        );
      }
    }

    console.log("--------------------------------");
    console.log("All users processed successfully.");
    console.log("--------------------------------");

    console.log("LOGIN USERS:");
    console.log("Admin          : admin / admin123");
    console.log("Nodal Officer  : nodal1 / nodal123");
    console.log("incharge Officer : incharge1 / incharge123");
    console.log("--------------------------------");

  } catch (error) {
    console.error("CREATE USERS ERROR:");
    console.error(error);
  } finally {
    await db.end();
  }
}

createUsers();