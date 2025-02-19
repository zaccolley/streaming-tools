import obs from "../obs/index.js";

import Logger from "../helpers/logger.js";
const logger = new Logger("🍕 Command: Pizza");

let isPlaying = false;

async function pizzaCommand({ messageData }) {
  if (isPlaying) {
    return;
  }

  const { user } = messageData;
  logger.log(`${user.username} triggered pizza`);

  const timeout = 2000;
  obs.turnOnOverlay("Pizza", timeout);

  isPlaying = true;
  setTimeout(() => {
    isPlaying = false;
  }, timeout);
}

export default pizzaCommand;
