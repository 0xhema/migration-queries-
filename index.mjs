import { ethers } from "ethers";
import fs from "fs";
import Papa from "papaparse";
//import squidgrowABI from "./squidgrow.json" assert { type: "json" };
import { Contract, Provider } from "ethers-multicall";

const rpc =
  "https://solemn-intensive-cherry.bsc.quiknode.pro/7bf8aa990b30696a05e955dbda41a6cc1a408f69/";
const provider = new ethers.providers.JsonRpcProvider(rpc);
const ethcallProvider = new Provider(provider);
const squidgrowAddress = "0x88479186BAC914E4313389a64881F5ed0153C765";
const BATCH_SIZE = 100;
const WAIT_TIME_MS = 5000; // Wait for 5 seconds between batches

let squidgrowabi = [
  "function viewisBot(address _address) public view returns (bool)",
];
let botArray = [];
const squidgrow = new Contract(squidgrowAddress, squidgrowabi);

async function processBatch(addresses) {
  const calls = addresses.map((row) =>
    squidgrow.viewisBot(row[0].toString().trim())
  );
  const isBotArray = await ethcallProvider.all(calls);

  for (let i = 0; i < isBotArray.length; i++) {
    const address = addresses[i][0].toString().trim();
    const tokens = addresses[i][1].toString().trim();

    if (isBotArray[i]) {
      console.log(`${address} is a bot.`);
      botArray.push({ address, tokens });
    }
  }

  // Write to CSV after processing each batch
  const outputPath = "./botAddresses.csv";
  const csvContent =
    "Address,Tokens\n" +
    botArray.map((entry) => `${entry.address},${entry.tokens}`).join("\n");
  fs.writeFileSync(outputPath, csvContent);
  console.log(`Updated bot addresses and tokens written to ${outputPath}`);
}

async function processAddresses() {
  try {
    const data = fs.readFileSync("./balances.csv", "utf8");
    await ethcallProvider.init();

    Papa.parse(data, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        let totalAddresses = results.data.length;
        console.log(
          `Processing ${totalAddresses} addresses in batches of ${BATCH_SIZE}...`
        );

        for (let i = 0; i < totalAddresses; i += BATCH_SIZE) {
          let batch = results.data.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch starting with index ${i}...`);
          await processBatch(batch);
          console.log(`Batch starting with index ${i} processed.`);

          if (i + BATCH_SIZE < totalAddresses) {
            console.log(
              `Waiting for ${WAIT_TIME_MS / 1000} seconds before next batch...`
            );
            await new Promise((res) => setTimeout(res, WAIT_TIME_MS));
          }
        }
        console.log("All batches processed.");
      },
    });
  } catch (err) {
    console.error(`An error occurred: ${err.message}`);
  }
}

processAddresses();
