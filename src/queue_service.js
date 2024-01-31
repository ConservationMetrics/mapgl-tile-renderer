import { QueueServiceClient } from "@azure/storage-queue";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

import { initiateRendering } from "./initiate.js";

// Connection string and queue names
const connStr = process.env["QueueConnectionString"];
const sourceQueueName = "mappacker-requests";
const destinationQueueName = "jg-mp-test-out";

// Create QueueClients
const queueServiceClient = QueueServiceClient.fromConnectionString(connStr);
const sourceQueueClient = queueServiceClient.getQueueClient(sourceQueueName);
const destinationQueueClient =
  queueServiceClient.getQueueClient(destinationQueueName);

const processQueueMessages = async () => {
  // TODO: erase this dummy code when the rendering is implemented
  // Write dummy text file to /maps/
  // const __filename = fileURLToPath(import.meta.url);
  // const __dirname = dirname(__filename);

  // const dirPath = path.join("/", "maps");
  // const filePath = path.join(dirPath, "dummy.txt");

  // // Ensure the directory exists
  // fs.mkdirSync(dirPath, { recursive: true });

  // // Now write the file
  // console.log(`Writing dummy file to ${filePath}`)
  // fs.writeFileSync(filePath, "dummy");

  while (true) {
    // Receive message
    const response = await sourceQueueClient.receiveMessages({
      visibilityTimeout: 2 * 60 * 60,
    });
    const message = response.receivedMessageItems[0];

    if (message) {
      try {
        const decodedMessageText = Buffer.from(
          message.messageText,
          "base64",
        ).toString("utf8");
        console.log(`Received message (decoded): '${decodedMessageText}'`);

        // Parse the message text as JSON
        const messageData = JSON.parse(decodedMessageText);

        // Extract the required values
        const {
          style,
          styleObject = null,
          styleDir = null,
          sourceDir = null,
          apiKey,
          mapboxStyle,
          monthYear,
          overlay,
          bounds,
          minZoom = 0,
          maxZoom,
          output = "output",
        } = messageData;

        // Pass the extracted values to initiateRendering
        await initiateRendering(
          style,
          styleObject,
          styleDir,
          sourceDir,
          apiKey,
          mapboxStyle,
          monthYear,
          overlay,
          bounds,
          minZoom,
          maxZoom,
          output,
        );

        // Send completion message
        const completionMessage = `Finished rendering map`;
        console.log(completionMessage);
        await destinationQueueClient.sendMessage(completionMessage);
      } finally {
        // Delete the message from the source queue
        await sourceQueueClient.deleteMessage(
          message.messageId,
          message.popReceipt,
        );
      }
    } else {
      console.log("No message found. Retrying in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000)); // Wait for 10 seconds before retrying
    }
  }
};

processQueueMessages();
