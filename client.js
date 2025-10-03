import fs from "fs";
import path from "path";

const dataPath = path.resolve("./data.json");

// Ensure data file exists
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify({ lastWarehouseUpdate: null }, null, 2));
}

// Handle direct client messages (currently disabled – all flow via middleman)
export async function handleClient(sock, msg, text) {
  // For now, clients don’t directly send anything here.
}

// Start scheduled updates every 3 hours (Mon–Fri, 9 AM to 6 PM)
export function startClientScheduler(sock) {
  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sun, 6 = Sat

    if (day === 0 || day === 6) return;       // Skip weekends
    if (hour < 9 || hour > 18) return;        // Work hours only
    if ((hour - 9) % 3 !== 0) return;         // Only 9, 12, 15, 18

    let data;
    try {
      data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    } catch (err) {
      console.error("Failed to read data.json:", err);
      return;
    }

    if (!data.lastWarehouseUpdate) {
      await sock.sendMessage("120363402245834989@g.us", { 
        text: "Reminder: No warehouse update received yet." 
      });
      return;
    }

    // Send the latest approved warehouse update
    await sock.sendMessage("120363404381805010@g.us", {
      text: `Scheduled update:\n${data.lastWarehouseUpdate}`
    });

    console.log("Sent scheduled client update.");
  }, 1000 * 60 * 10); // check every 10 minutes, only send at the right hours
}
