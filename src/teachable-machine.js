require("@tensorflow/tfjs-node");
const tf = require("@tensorflow/tfjs");
const fetch = require("node-fetch");
const { Readable } = require("stream");
const PImage = require("pureimage");
const bufferFromBase64 = require("./helpers/buffer-from-base64");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const retryOperation = (operation, delay, times) =>
  new Promise((resolve, reject) => {
    return operation()
      .then(({ cb }) => {
        return resolve(cb());
      })
      .catch(({ message }) => {
        if (times - 1 > 0) {
          return wait(delay)
            .then(
              retryOperation.bind(null, operation, delay, times - 1)
            )
            .then(resolve)
            .catch(reject);
        }

        return reject(message);
      });
  });

const bufferToStream = (binary) => {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });

  return readableInstanceStream;
};

const predict = async (imgElement, model) => {
  const logits = tf.tidy(() => {
    // tf.browser.fromPixels() returns a Tensor from an image element.
    let img = tf.browser.fromPixels(imgElement).toFloat();
    img = tf.image.resizeNearestNeighbor(img, [
      model.inputs[0].shape[1],
      model.inputs[0].shape[2],
    ]);

    const offset = tf.scalar(127.5);
    // Normalize the image from [0, 255] to [-1, 1].
    const normalized = img.sub(offset).div(offset);

    // Reshape to a single-element batch so we can pass it to predict.
    const batched = normalized.reshape([
      1,
      model.inputs[0].shape[1],
      model.inputs[0].shape[2],
      model.inputs[0].shape[3],
    ]);

    return model.predict(batched);
  });

  const predictions = await getTopKClasses(logits, model.classes);

  return predictions;
};

const getTopKClasses = async (logits, classes) => {
  const values = await logits.data();
  const topK = Math.min(classes.length, values.length);

  const valuesAndIndices = [];
  for (let i = 0; i < values.length; i++) {
    valuesAndIndices.push({ value: values[i], index: i });
  }

  valuesAndIndices.sort((a, b) => {
    return b.value - a.value;
  });

  const topkValues = new Float32Array(topK);
  const topkIndices = new Int32Array(topK);
  for (let i = 0; i < topK; i++) {
    topkValues[i] = valuesAndIndices[i].value;
    topkIndices[i] = valuesAndIndices[i].index;
  }

  const topClassesAndProbs = [];
  for (let i = 0; i < topkIndices.length; i++) {
    topClassesAndProbs.push({
      class: classes[topkIndices[i]],
      score: topkValues[i],
    });
  }
  return topClassesAndProbs;
};

class TeachableMachine {
  constructor(params) {
    this.loadModel(params);
  }

  async loadModel({ modelUrl }) {
    if (!modelUrl || modelUrl === "") {
      console.error(
        "[@sashido/teachablemachine-node] -",
        "Missing model URL!"
      );
      this.error = "Missing model URL!";
      return null;
    }

    try {
      const modelURL = `${modelUrl}model.json`;
      const response = await fetch(`${modelUrl}metadata.json`);
      const body = await response.text();
      this.model = await tf.loadLayersModel(modelURL);
      this.model.classes = JSON.parse(body).labels;
      // console.log('@@@', this.model)
    } catch (e) {
      console.error("[@sashido/teachablemachine-node] -", e);
    }
  }

  async checkModel(cb) {
    const { model } = this;

    if (model) {
      return Promise.resolve({ cb });
    }

    return Promise.reject({ message: "Loading model" });
  }

  async classify(params) {
    if (this.error) {
      return Promise.reject({ error: this.error });
    }

    return retryOperation(
      () => this.checkModel(() => this.inference(params)),
      1000,
      20
    ); // method, delay, retries
  }

  async getImageBuffer({ imageUrl, base64ImageString }) {
    if (imageUrl) {
      const data = await fetch(imageUrl);

      const contentType = data.headers.get("Content-Type");
      return {
        buffer: await data.buffer(),
        contentType,
      };
    }

    if (base64ImageString) {
      return bufferFromBase64(base64ImageString);
    }
  }

  async inference({ imageUrl, base64ImageString }) {
    try {
      const { buffer, contentType } = await this.getImageBuffer({
        imageUrl,
        base64ImageString,
      });
      const stream = bufferToStream(buffer);
      let imageBitmap;
      if (/png/.test(contentType)) {
        imageBitmap = await PImage.decodePNGFromStream(stream);
      }
      if (/jpe?g/.test(contentType)) {
        imageBitmap = await PImage.decodeJPEGFromStream(stream);
      }

      const predictions = await predict(imageBitmap, this.model);
      return predictions;
    } catch (error) {
      return Promise.reject({ error });
    }
  }
}

// const OLD_HERBERT_MODEL =
//   "https://teachablemachine.withgoogle.com/models/r3XWcpK0R/";
const HERBERT_MODEL =
  "https://teachablemachine.withgoogle.com/models/SF6Vq47UF/";
const model = new TeachableMachine({
  modelUrl: HERBERT_MODEL,
});

async function isImageClassified({
  image,
  classification,
  threshold,
}) {
  const predictions = await model.classify({
    base64ImageString: image,
  });

  if (!predictions) {
    return false;
  }

  const isClassificationPrediction = [...predictions].find(
    (p) => p.class === classification
  );

  if (!isClassificationPrediction) {
    return false;
  }

  if (isClassificationPrediction.score > threshold) {
    return true;
  } else {
    return false;
  }
}

/*

async function detectHerbert(image) {
  const isHerbert = await isImageClassified({
    image,
    classification: "Herbert",
    threshold: 0.9,
  });

  if (isHerbert) {
    turnOnOverlay("Holy Fuck It's Herbert", 3000);
    return obs.showSource({
      scene: "Overlays",
      source: "Crowd Cheering",
    });
  }

  return obs.hideSource({
    scene: "Overlays",
    source: "Crowd Cheering",
  });
}

setInterval(async () => {
  try {
    const image = await obs.getWebcamImage("Raw Webcam");
    detectHerbert(image);
  } catch (e) {
    // didn't find the image
  }
}, 3000);

*/

module.exports = { isImageClassified };
