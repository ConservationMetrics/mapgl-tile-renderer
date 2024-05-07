import { QueueServiceClient } from "@azure/storage-queue";
import { Client } from "pg";

import {
  parseListToFloat,
  validateInputOptions,
  handleError,
} from "./utils.js";
import { initiateRendering } from "./initiate.js";

// Make db connection
const connectionString = process.env["CONNECTION_STRING"];
const client = new Client({
  connectionString: connectionString,
});
client.connect();

const db_table = process.env["DB_TABLE"];

// Connection string and queue names
const connStr = process.env["QueueConnectionString"];
const sourceQueueName = "mappacker-requests";

// Create QueueClients
const queueServiceClient = QueueServiceClient.fromConnectionString(connStr);
const sourceQueueClient = queueServiceClient.getQueueClient(sourceQueueName);

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
      outputDir,
      outputFilename;
    let boundsArray = [];

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
        outputDir = "/maps",
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
      await writeRenderResult(renderResult, message);
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
        openStreetMap,
        overlay,
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
      await writeRenderResult(renderResult, message);
    }
  }
};

const writeRenderResult = async (renderResult, message) => {
  if (renderResult) {
    let updateDbRenderRequest = `UPDATE ${db_table} SET `;
    let params = [];
    let count = 1;

    for (let key in renderResult) {
      // If the renderResult property is not null or undefined,
      // add a clause to the SQL query to update the corresponding column
      // and add the property value to the parameters array
      if (renderResult[key] !== null && renderResult[key] !== undefined) {
        // All keys converted to lowercase match the db column names
        updateDbRenderRequest += `${key.toLowerCase()} = $${count}, `;
        params.push(renderResult[key]);
        count++;
      }
    }

    // Remove space and comma from last column
    updateDbRenderRequest = updateDbRenderRequest.slice(0, -2);
    updateDbRenderRequest += ` WHERE id = $${count}`;
    params.push(message.requestId);

    await client.query(updateDbRenderRequest, params);
  }
  // Delete message from queue
  await sourceQueueClient.deleteMessage(message.messageId, message.popReceipt);
};

processQueueMessages();
