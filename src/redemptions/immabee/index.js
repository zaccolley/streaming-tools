import obs from "../../obs/index.js";
import createBeeImage from "./create-bee-image.js";

import BaseRedemption from "../base-redemption.js";

import Logger from "../../helpers/logger.js";
const logger = new Logger("🐝 Redemption: Imma Bee");

class ImmaBeeRedemption extends BaseRedemption {
  constructor({ streamingService, alerts }) {
    const title = "imma bee";

    super({ streamingService, title });

    this.streamingService = streamingService;
    this.alerts = alerts;
    this.data = {
      id: "975f6903-f026-4112-988a-a13d03a78049",
      title,
      prompt: "imma bee imma bee imma bee imma bee imma bee imma bee",
      cost: 300,
      background_color: "#FFF400",
      should_redemptions_skip_request_queue: false,
      isNotForPNGTuber: true,
    };

    this.unfufilledRedemption((data) => this.start(data));
  }

  async start(redemption) {
    logger.log("Triggered...");

    try {
      const image = await obs.getWebcamImage();
      await createBeeImage(image);
      this.alerts.send({
        type: "immabee",
        audioUrl: "/assets/alerts/immabee.mp3",
        duration: 4000,
      });
      this.streamingService.chat.sendMessage(
        `shoutout darren dobson for the bee images https://linktr.ee/DarrenDobson`
      );
      await this.streamingService.fulfilRedemptionReward(redemption);
    } catch (e) {
      logger.error(JSON.stringify(e));
      this.streamingService.chat.sendMessage(
        `Couldn't find their face...`
      );
      await this.streamingService.cancelRedemptionReward(redemption);
    }
  }
}

export default ImmaBeeRedemption;
