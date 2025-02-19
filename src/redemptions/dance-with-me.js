import { setTimeout } from "timers/promises"; // eslint-disable-line node/no-missing-import
import { v4 as randomID } from "uuid";

import BaseRedemption from "./base-redemption.js";

import Logger from "../helpers/logger.js";
const logger = new Logger("💃 Redemption: Dance With Me");

class DanceWithMeRedemption extends BaseRedemption {
  constructor({ io, streamingService }) {
    const title = "dance with me";

    super({ streamingService, title });

    this.io = io;
    this.streamingService = streamingService;
    this.data = {
      id: "1970bc27-8ffa-4cfd-ade3-ded68bb893c7",
      title,
      prompt: "pop-up on the stream as a little blob bopping",
      cost: 5,
      background_color: "#002224",
      isForDancing: true,
      is_enabled: false, // disabled on boot
    };

    this.dancers = [];

    this.fufilledRedemption((data) => this.start(data));
  }

  async start(data) {
    logger.log("Triggered...");

    const newDancer = await this.streamingService.getUser(
      data?.user?.username
    );

    if (!newDancer) {
      logger.error("No user found");
      return;
    }

    newDancer.id = randomID();
    this.dancers.push(newDancer);
    this.io.emit("data", { dancers: this.dancers });

    // 3 minutes (+ wait for it to fade out on client)
    await setTimeout(1000 * 60 * 3 + 5000);

    // remove from array
    this.dancers = this.dancers.filter((dancer) => {
      return dancer.id !== newDancer.id;
    });

    this.io.emit("data", { dancers: this.dancers });
  }
}

export default DanceWithMeRedemption;
