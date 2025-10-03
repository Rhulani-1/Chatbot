import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { startClientScheduler } from "./client.js";
import { handleWarehouse } from "./warehouse.js";
import middlemanHandler from "./middleman.js";

async function startBot() {
  // 1️⃣ Initialize auth
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);

  // 2️⃣ Start client scheduler (scheduled updates every 3 hours)
  startClientScheduler(sock);

  // 3️⃣ Handle middleman events (approve/decline/edit warehouse updates and client requests)
  middlemanHandler(sock);

  // 4️⃣ Listen to all incoming messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const jid = msg.key.remoteJid;
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.documentMessage?.caption;

    if (!text) return;

    const lowerText = text.toLowerCase();

    // -----------------------------
    // Warehouse messages
    // -----------------------------
    if (jid === process.env.WAREHOUSE_GROUP_JID) {
      await handleWarehouse(sock, msg);
      return;
    }

    // -----------------------------
    // Client messages (still forward to middleman if 'bot' keyword)
    // -----------------------------
    if (jid === process.env.CLIENT_GROUP_JID) {
      if (lowerText.includes("bot")) {
        // Remove "bot" keyword
        const cleanClientText = text.replace(/\bbot\b/i, "").trim();

        // Forward to middleman with approval instructions
        await sock.sendMessage(process.env.MIDDLEMAN_GROUP_JID, {
          text: `Client wants to send: "${cleanClientText}"\nReply with "accept <id>" or "decline <id>"`
        });

        console.log("Forwarded client request to middleman group.");
      } else {
        console.log("Client message ignored (missing 'bot' keyword).");
      }
      return;
    }

    // -----------------------------
    // Optional: Other groups or unknown messages
    // -----------------------------
  });

  console.log("Bot started and listening...");
}

startBot();
