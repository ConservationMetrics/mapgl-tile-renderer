import { QueueServiceClient } from "@azure/storage-queue";
import { initiateRendering } from "./initiate.js";

// Connection string and queue names
const connStr = process.env["QueueConnectionString"];
const sourceQueueName = "mappacker-requests";
const destinationQueueName = "jg-mp-test-out";

// Create QueueClients
const queueServiceClient =
  QueueServiceClient.fromConnectionString(connStr);
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
        console.log(`Received message: '${message.messageText}'`);

        // Parse the message text as JSON
        const messageData = JSON.parse(message.messageText);

        // Extract the required keys
        const {
          styleProvided,
          styleObject,
          styleDir,
          sourceDir,
          onlineSource,
          onlineSourceAPIKey,
          mapboxStyle,
          monthYear,
          overlaySource,
          bounds,
          minZoom,
          maxZoom,
          output,
        } = messageData;

        // Pass the extracted keys to initiateRendering
        await initiateRendering(
          styleProvided,
          styleObject,
          styleDir,
          sourceDir,
          onlineSource,
          onlineSourceAPIKey,
          mapboxStyle,
          monthYear,
          overlaySource,
          bounds,
          minZoom,
          maxZoom,
          output
        );

        // Send completion message
        const completionMessage = `Finished rendering map`;
        await destinationQueueClient.sendMessage(completionMessage);
      } finally {
        // Delete the message from the source queue
        await sourceQueueClient.deleteMessage(
          message.messageId,
          message.popReceipt
        );
      }
    } else {
      console.log("No message found. Retrying in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000)); // Wait for 10 seconds before retrying
    }
  }
};

processQueueMessages();
