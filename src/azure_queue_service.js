import { QueueServiceClient } from "@azure/storage-queue";

import {
  parseListToFloat,
  validateInputOptions,
  handleError,
} from "./utils.js";
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

    // If no message is found, retry after 10 seconds
    if (!message) {
      console.log("No message found. Retrying in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
      continue;
    }

    // Initialize variables with default or null values
    let renderResult;
    let decodedMessageText = "";
    let options = {};
    let style,
      apiKey,
      mapboxStyle,
      monthYear,
      overlay,
      openStreetMap,
      bounds,
      minZoom,
      maxZoom,
      ratio,
      tiletype,
      outputFilename;
    let boundsArray = [];
    const outputDir = "/maps"; // TODO: Get this from environment variable (or confirm that we are happy with this default value)

    // Decode, parse, and validate the message
    try {
      decodedMessageText = Buffer.from(message.messageText, "base64").toString(
        "utf8",
      );
      console.log(`Received queue message: '${decodedMessageText}'`);

      options = JSON.parse(decodedMessageText);

      ({
        style,
        apiKey,
        mapboxStyle,
        monthYear,
        overlay,
        openStreetMap,
        bounds,
        minZoom = 0,
        maxZoom,
        ratio = 1,
        tiletype = "jpg",
        outputFilename = "output",
      } = options);

      boundsArray = parseListToFloat(bounds);

      validateInputOptions(
        style,
        null,
        null,
        apiKey,
        mapboxStyle,
        monthYear,
        openStreetMap,
        overlay,
        boundsArray,
        minZoom,
        maxZoom,
      );
    } catch (error) {
      renderResult = handleError(error, "badRequest");
      await sendCompletionMessage(
        renderResult,
        destinationQueueClient,
        message,
      );
      continue;
    }

    // Initiate rendering
    try {
      renderResult = await initiateRendering(
        style,
        null,
        null,
        apiKey,
        mapboxStyle,
        monthYear,
        overlay,
        openStreetMap,
        boundsArray,
        minZoom,
        maxZoom,
        ratio,
        tiletype,
        outputDir,
        outputFilename,
      );
    } catch (error) {
      renderResult = handleError(error, "internalServerError");
    } finally {
      await sendCompletionMessage(
        renderResult,
        destinationQueueClient,
        message,
      );
    }
  }
};

const sendCompletionMessage = async (renderResult, queueClient, message) => {
  if (renderResult) {
    const completionMessage = JSON.stringify(renderResult);
    await queueClient.sendMessage(completionMessage);
  }
  await sourceQueueClient.deleteMessage(message.messageId, message.popReceipt);
};

processQueueMessages();
