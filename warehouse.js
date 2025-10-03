import fs from "fs";
import 'dotenv/config';

const WAREHOUSE_GROUP_ID = process.env.WAREHOUSE_GROUP_JID;
const MIDDLEMAN_GROUP_ID = process.env.MIDDLEMAN_GROUP_JID;
const dataPath = "./data.json";

// Ensure data.json exists
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(
    dataPath,
    JSON.stringify({ lastWarehouseUpdate: "", lastUpdateTime: null }, null, 2)
  );
}

// Utility to read/write data
function readData() {
  return JSON.parse(fs.readFileSync(dataPath));
}
function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export async function handleWarehouse(sock, msg) {
  try {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.documentMessage?.caption;

    if (!text) return;

    if (text.toLowerCase().startsWith("update:")) {
      const updateText = text.slice(7).trim();

      const data = readData();
      data.lastWarehouseUpdate = updateText;
      data.lastUpdateTime = new Date();
      data.reminderActive = false; // stop nagging if update received
      writeData(data);

      // Forward to middleman
      await sock.sendMessage(MIDDLEMAN_GROUP_ID, {
        text: `📦 Warehouse update:\n${updateText}\n\nType "accept" to forward to client, "decline" to discard, or "edit: [new message]" to modify.`
      });
    }
  } catch (err) {
    console.error("Error in warehouse handler:", err);
  }
}

// Scheduler: 3-hourly reminders
setInterval(async () => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun, 6 = Sat

  if (day === 0 || day === 6) return; // skip weekends
  if (hour < 9 || hour > 18) return; // only work hours

  const data = readData();
  const lastUpdate = data.lastUpdateTime ? new Date(data.lastUpdateTime) : null;

  let shouldRemind = false;
  if (!lastUpdate) {
    shouldRemind = true;
  } else {
    const diffHrs = (now - lastUpdate) / (1000 * 60 * 60);
    if (diffHrs >= 3) shouldRemind = true;
  }

  if (shouldRemind) {
    await sock.sendMessage(WAREHOUSE_GROUP_ID, {
      text: "⏰ Reminder: Please send a warehouse update (use `update:`)."
    });

    // Activate 5-min nagging mode until update comes in
    data.reminderActive = true;
    writeData(data);
  }
}, 1000 * 60 * 60 * 3); // check every 3 hours

// Nagging loop: every 5 min if no update after 3hr mark
setInterval(async () => {
  const now = new Date();
  const data = readData();

  if (data.reminderActive) {
    await sock.sendMessage(WAREHOUSE_GROUP_ID, {
      text: "⚠️ Urgent: Still no warehouse update received. Please send it ASAP!"
    });
  }
}, 1000 * 60 * 5); // every 5 minutes
