import { QueueServiceClient } from "@azure/storage-queue";

import { parseListToFloat, validateInputOptions } from "./utils.js";
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
        console.log(`Received queue message: '${decodedMessageText}'`);

        // Parse the message text as JSON
        const options = JSON.parse(decodedMessageText);

        const {
          style,
          apiKey,
          mapboxStyle,
          monthYear,
          overlay,
          bounds,
          minZoom = 0,
          maxZoom,
          outputFilename = "output",
        } = options;

        validateInputOptions(
          style,
          null,
          null,
          apiKey,
          mapboxStyle,
          monthYear,
          overlay,
          bounds,
          minZoom,
          maxZoom,
        );

        const boundsArray = parseListToFloat(bounds);
        const outputDir = "/maps";

        // Pass the extracted values to initiateRendering
        await initiateRendering(
          style,
          null,
          null,
          apiKey,
          mapboxStyle,
          monthYear,
          overlay,
          boundsArray,
          minZoom,
          maxZoom,
          outputDir,
          outputFilename,
        );

        // Send completion message
        const completionMessage = `Finished rendering map`;
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
