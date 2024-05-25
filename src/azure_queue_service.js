import fs from "fs";
import path from "path";

import { QueueServiceClient } from "@azure/storage-queue";
import pg from "pg";

import {
  parseListToFloat,
  validateInputOptions,
  handleError,
} from "./utils.js";
import { initiateRendering } from "./initiate.js";

// Make db connection
const connectionString = process.env["DB_CONNECTION_STRING"];

const client = new pg.Client({
  connectionString: connectionString,
});
client.connect();

const db_table = process.env["DB_TABLE"];

// Connection string and queue names
const connStr = process.env["QUEUE_CONNECTION_STRING"];
const sourceQueueName = process.env["QUEUE_NAME"];

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

    // Decode and parse the message
    let decodedMessageText = Buffer.from(
      message.messageText,
      "base64",
    ).toString("utf8");
    console.log(`Received queue message: '${decodedMessageText}'`);

    let options = JSON.parse(decodedMessageText);
    let type = options.type;

    if (type === "new_request" || type === "resubmit_request") {
      await handleNewRequest(options, message);
    } else if (type === "delete_request") {
      await handleDeleteRequest(options, message);
    } else {
      console.log(`Unknown request type: '${type}'`);
      let renderResult = handleError(
        new Error(`Unknown request type: '${type}'`),
        "badRequest",
      );
      await writeRenderResult(renderResult, message, options.requestId);
      await sourceQueueClient.deleteMessage(
        message.messageId,
        message.popReceipt,
      );
    }
  }
};

const handleNewRequest = async (options, message) => {
  // Initialize variables with default or null values
  let renderResult;
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
  let requestId;

  try {
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

    requestId = options.requestId;

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

    // Update the request status to PROCESSING
    let updateStatusQuery = `UPDATE ${db_table} SET status = 'PROCESSING' WHERE id = $1`;
    await client.query(updateStatusQuery, [requestId]);
  } catch (error) {
    renderResult = handleError(error, "badRequest");
    await writeRenderResult(renderResult, message, requestId);
    return;
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
    await writeRenderResult(renderResult, message, requestId);
  }
};

const handleDeleteRequest = async (options, message) => {
  const requestId = options.requestId;
  const outputFilename = options.outputFilename;
  const outputDir = options.outputDir;

  // Delete file from volume mounted to the container
  try {
    const filePath = path.join(outputDir, outputFilename);

    fs.unlinkSync(filePath);
    console.log(`File ${filePath} has been successfully deleted!`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}: ${error}`);
  }

  // Delete the database row associated with the requestId
  try {
    let deleteDbRenderRequest = `DELETE FROM ${db_table} WHERE id = $1`;
    await client.query(deleteDbRenderRequest, [requestId]);
    console.log(
      `Request with id ${requestId} has been successfully deleted from the database!`,
    );
  } catch (error) {
    console.error(
      `Error deleting request with id ${requestId} from the database: ${error}`,
    );
  }

  // Delete message from queue
  await sourceQueueClient.deleteMessage(message.messageId, message.popReceipt);
};

const writeRenderResult = async (renderResult, message, requestId) => {
  if (renderResult) {
    console.log(`Writing render result to database..`);

    let updateDbRenderRequest = `UPDATE ${db_table} SET `;
    let params = [];
    let count = 1;

    for (let key in renderResult) {
      // If the renderResult property is not null or undefined,
      // add a clause to the SQL query to update the corresponding column
      // and add the property value to the parameters array
      if (renderResult[key] !== null && renderResult[key] !== undefined) {
        // Convert camelCase to snake_case for db column names
        let snakeCaseKey = camelToSnakeCase(key);
        updateDbRenderRequest += `${snakeCaseKey} = $${count}, `;
        params.push(renderResult[key]);
        count++;
      }
    }

    // Remove space and comma from last column
    updateDbRenderRequest = updateDbRenderRequest.slice(0, -2);
    updateDbRenderRequest += ` WHERE id = $${count}`;
    params.push(requestId);

    await client.query(updateDbRenderRequest, params);

    console.log(`Render result has successfully been written to database!`);
  }
  // Delete message from queue
  await sourceQueueClient.deleteMessage(message.messageId, message.popReceipt);
};

function camelToSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

processQueueMessages();
