import "../fixtures";
import Util from "common/util";
import * as can from "common/can";
import { ContentTypeMp4AvcMain, ContentTypeMp4HvcMain } from "common/media";

let chai = require("chai/chai");
let assert = chai.assert;

describe("common/util", () => {
  it("should return duration 3ns", () => {
    const duration = Util.formatDuration(-3);
    assert.equal(duration, "3ns");
  });
  it("should return duration 0s", () => {
    const duration = Util.formatDuration(0);
    assert.equal(duration, "0s");
  });
  it("should return duration 2µs", () => {
    const duration = Util.formatDuration(2000);
    assert.equal(duration, "2µs");
  });
  it("should return duration 4ms", () => {
    const duration = Util.formatDuration(4000000);
    assert.equal(duration, "4ms");
  });
  it("should return duration 6s", () => {
    const duration = Util.formatDuration(6000000000);
    assert.equal(duration, "0:06");
  });
  it("should return duration 10min", () => {
    const duration = Util.formatDuration(600000000000);
    assert.equal(duration, "10:00");
  });
  it("should return formatted milliseconds", () => {
    const short = Util.formatNs(45065875);
    assert.equal(short, "45 ms");
    const long = Util.formatNs(45065875453454);
    assert.equal(long, "45,065,875 ms");
  });
  it("should return formatted camera name", () => {
    const iPhone15Pro = Util.formatCamera({ Make: "Apple", Model: "iPhone 15 Pro" }, 23, "Apple", "iPhone 15 Pro");
    assert.equal(iPhone15Pro, "iPhone 15 Pro");

    const iPhone14 = Util.formatCamera({ Make: "Apple", Model: "iPhone 14" }, 22, "Apple", "iPhone 14");
    assert.equal(iPhone14, "iPhone 14");

    const iPhone13 = Util.formatCamera(null, 21, "Apple", "iPhone 13");
    assert.equal(iPhone13, "iPhone 13");
  });
  it("should return matching video format name", () => {
    const avc = Util.videoFormat("avc1", ContentTypeMp4AvcMain);
    assert.equal(avc, "avc");

    const hevc = Util.videoFormat("hvc1", ContentTypeMp4HvcMain);
    if (can.useMp4Hvc) {
      assert.equal(hevc, "hevc");
    } else {
      assert.equal(hevc, "avc");
    }

    const webm = Util.videoFormat("", "video/webm");
    if (can.useWebM) {
      assert.equal(webm, "webm");
    } else {
      assert.equal(webm, "avc");
    }
  });
  it("should convert -1 to roman", () => {
    const roman = Util.arabicToRoman(-1);
    assert.equal(roman, "");
  });
  it("should convert 2500 to roman", () => {
    const roman = Util.arabicToRoman(2500);
    assert.equal(roman, "MMD");
  });
  it("should convert 112 to roman", () => {
    const roman = Util.arabicToRoman(112);
    assert.equal(roman, "CXII");
  });
  it("should convert 9 to roman", () => {
    const roman = Util.arabicToRoman(9);
    assert.equal(roman, "IX");
  });
  it("should truncate xxx", () => {
    const result = Util.truncate("teststring");
    assert.equal(result, "teststring");
  });
  it("should truncate xxx", () => {
    const result = Util.truncate("teststring for mocha", 5, "ng");
    assert.equal(result, "tesng");
  });
  it("should encode html", () => {
    const result = Util.encodeHTML("Micha & Theresa > < 'Lilly'");
    assert.equal(result, "Micha &amp; Theresa &gt; &lt; &apos;Lilly&apos;");
  });
  it("should encode link", () => {
    const result = Util.encodeHTML("Try this: https://photoswipe.com/options/?foo=bar&bar=baz. It's a link!");
    assert.equal(
      result,
      `Try this: <a href="https://photoswipe.com/options/" target="_blank">https://photoswipe.com/options/</a> It&apos;s a link!`
    );
  });
});
