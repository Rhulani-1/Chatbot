// middleman.js
import fs from "fs";

const CLIENT_GROUP_ID = process.env.CLIENT_GROUP_JID;
const MIDDLEMAN_GROUP_ID = process.env.MIDDLEMAN_GROUP_JID;
const dataPath = "./data.json";

function readData() {
  return JSON.parse(fs.readFileSync(dataPath));
}

function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export default function middlemanHandler(sock) {
  // 1. Listen for middleman responses
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    if (msg.key.remoteJid === MIDDLEMAN_GROUP_ID) {
      const text =
        msg.message?.conversation?.toLowerCase() ||
        msg.message?.extendedTextMessage?.text?.toLowerCase() ||
        "";

      let data = readData();

      if (text.startsWith("accept")) {
        if (data.lastWarehouseUpdate) {
          await sock.sendMessage(CLIENT_GROUP_ID, {
            text: `✅ Approved update:\n${data.lastWarehouseUpdate}`
          });
          data.lastApprovalTime = new Date();
          writeData(data);
          console.log("Forwarded approved update to client group.");
        }

      } else if (text.startsWith("decline")) {
        console.log("Middleman declined the update.");
        await sock.sendMessage(MIDDLEMAN_GROUP_ID, {
          text: "❌ Update has been declined. Warehouse must resend."
        });
        data.lastWarehouseUpdate = "";
        writeData(data);

      } else if (text.startsWith("edit:")) {
        const editedText = text.replace("edit:", "").trim();
        if (editedText) {
          data.lastWarehouseUpdate = editedText;
          data.lastApprovalTime = new Date();
          writeData(data);

          await sock.sendMessage(CLIENT_GROUP_ID, {
            text: `✏️ Edited & approved update:\n${editedText}`
          });
          console.log("Forwarded edited message to client group.");
        }
      }
    }
  });

  // 2. Auto-approval fallback every 5 minutes
  setInterval(async () => {
    let data = readData();

    if (!data.lastWarehouseUpdate || !data.lastUpdateTime) return;

    const now = new Date();
    const lastUpdateTime = new Date(data.lastUpdateTime);
    const lastApprovalTime = data.lastApprovalTime ? new Date(data.lastApprovalTime) : null;

    // If 30 mins passed and no approval/decline/edit, auto-approve
    if (
      !lastApprovalTime &&
      (now - lastUpdateTime) > 30 * 60 * 1000
    ) {
      await sock.sendMessage(CLIENT_GROUP_ID, {
        text: `⚡ Auto-approved (no middleman response in 30 mins):\n${data.lastWarehouseUpdate}`
      });
      data.lastApprovalTime = new Date();
      writeData(data);
      console.log("Auto-approved warehouse update to client group.");
    }
  }, 1000 * 60 * 5); // check every 5 mins
}
